import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [backupDate, ...flags] = process.argv.slice(2);
if (!/^\d{4}-\d{2}-\d{2}$/.test(backupDate || '')) {
  console.error('Usage: node scripts/restore-r2-snapshot.mjs YYYY-MM-DD --apply-r2');
  process.exit(2);
}

const outputDir = join(root, `restore-${backupDate}`);
const scratchDir = await mkdtemp(join(tmpdir(), 'community-r2-restore-'));
await mkdir(outputDir, { recursive: true });

function wrangler(args) {
  execFileSync('npx', ['wrangler', ...args], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, WRANGLER_LOG_PATH: join(scratchDir, 'wrangler.log') },
  });
}

async function getObject(bucket, key, destination) {
  wrangler([
    'r2',
    'object',
    'get',
    `${bucket}/${key}`,
    '--remote',
    '--file',
    destination,
    '--config',
    'wrangler.toml',
  ]);
}

try {
  const snapshotPrefix = `snapshots/${backupDate}`;
  const manifestPath = join(outputDir, 'manifest.json');
  await getObject('community-backups', `${snapshotPrefix}/manifest.json`, manifestPath);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest.backupDate !== backupDate || !manifest.database?.key || !manifest.images) {
    throw new Error('The snapshot manifest is invalid or incomplete');
  }

  const databasePath = join(outputDir, 'database.sql');
  await getObject('community-backups', manifest.database.key, databasePath);
  console.log(`D1 export saved to ${databasePath}`);

  if (!flags.includes('--apply-r2')) {
    console.log(
      'R2 objects were not changed. Re-run with --apply-r2 to copy this snapshot into the community bucket.'
    );
    process.exitCode = 0;
  } else {
    const answer = await new Promise((resolveAnswer) => {
      process.stdout.write(
        `This will restore ${manifest.images.count} images into the live community bucket, overwriting matching keys. Type RESTORE to continue: `
      );
      process.stdin.setEncoding('utf8');
      process.stdin.once('data', (value) => resolveAnswer(value.trim()));
    });
    if (answer !== 'RESTORE') throw new Error('R2 restore cancelled');

    let restored = 0;
    for (let page = 1; page <= manifest.images.pageCount; page += 1) {
      const pageName = `${String(page).padStart(6, '0')}.json`;
      const pagePath = join(scratchDir, pageName);
      await getObject('community-backups', `${snapshotPrefix}/r2-manifests/${pageName}`, pagePath);
      const entries = JSON.parse(await readFile(pagePath, 'utf8'));
      if (!Array.isArray(entries)) throw new Error(`Invalid image manifest page ${page}`);

      for (let index = 0; index < entries.length; index += 1) {
        const entry = entries[index];
        if (
          typeof entry.sourceKey !== 'string' ||
          !entry.sourceKey.startsWith('forums/') ||
          typeof entry.backupKey !== 'string' ||
          !entry.backupKey.startsWith(`${snapshotPrefix}/images/`)
        ) {
          throw new Error(`Unsafe key in image manifest page ${page}`);
        }
        const imagePath = join(scratchDir, `image-${page}-${index}`);
        await getObject('community-backups', entry.backupKey, imagePath);
        const args = [
          'r2',
          'object',
          'put',
          `community/${entry.sourceKey}`,
          '--remote',
          '--file',
          imagePath,
          '--force',
          '--config',
          'wrangler.toml',
        ];
        if (entry.httpMetadata?.contentType)
          args.push('--content-type', entry.httpMetadata.contentType);
        if (entry.httpMetadata?.cacheControl)
          args.push('--cache-control', entry.httpMetadata.cacheControl);
        wrangler(args);
        restored += 1;
      }
    }
    console.log(`Restored ${restored} images. Newer/unlisted objects were left untouched.`);
  }
} finally {
  await rm(scratchDir, { recursive: true, force: true });
}
