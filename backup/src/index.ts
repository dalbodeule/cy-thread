import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';

interface BackupEnv {
  ACCOUNT_ID: string;
  DATABASE_ID: string;
  D1_REST_API_TOKEN: string;
  SOURCE_BUCKET: R2Bucket;
  BACKUP_BUCKET: R2Bucket;
}

interface D1ExportResponse {
  success?: boolean;
  errors?: Array<{ message?: string }>;
  result?: {
    at_bookmark?: string;
    signed_url?: string;
    filename?: string;
  };
}

interface R2PageResult {
  cursor: string | null;
  copied: number;
}

const snapshotRetentionDays = 31;
const r2PageSize = 10;

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function readD1Response(response: Response): Promise<D1ExportResponse> {
  if (!response.ok) throw new Error(`D1 export API returned HTTP ${response.status}`);
  const body = (await response.json()) as D1ExportResponse;
  if (!body.success) {
    const message = body.errors
      ?.map((error) => error.message)
      .filter(Boolean)
      .join('; ');
    throw new Error(message || 'D1 export API request failed');
  }
  return body;
}

export class CommunityBackupWorkflow extends WorkflowEntrypoint<BackupEnv> {
  async run(event: Readonly<WorkflowEvent<unknown>>, step: WorkflowStep) {
    const backupDate = dateKey(event.timestamp);
    const prefix = `snapshots/${backupDate}`;
    const exportUrl = `https://api.cloudflare.com/client/v4/accounts/${this.env.ACCOUNT_ID}/d1/database/${this.env.DATABASE_ID}/export`;
    const exportHeaders = new Headers({
      Authorization: `Bearer ${this.env.D1_REST_API_TOKEN}`,
      'Content-Type': 'application/json',
    });

    const bookmark = await step.do('Start D1 export', async () => {
      const response = await fetch(exportUrl, {
        method: 'POST',
        headers: exportHeaders,
        body: JSON.stringify({ output_format: 'polling' }),
      });
      const body = await readD1Response(response);
      if (!body.result?.at_bookmark) throw new Error('D1 export did not return a bookmark');
      return body.result.at_bookmark;
    });

    let signedUrl: string | undefined;
    for (let attempt = 1; attempt <= 120; attempt += 1) {
      const poll = await step.do(`Check D1 export ${attempt}`, async () => {
        const response = await fetch(exportUrl, {
          method: 'POST',
          headers: exportHeaders,
          body: JSON.stringify({ current_bookmark: bookmark }),
        });
        const body = await readD1Response(response);
        return { signedUrl: body.result?.signed_url || null };
      });
      if (poll.signedUrl) {
        signedUrl = poll.signedUrl;
        break;
      }
      await step.sleep(`Wait for D1 export ${attempt}`, '30 seconds');
    }
    if (!signedUrl) throw new Error('D1 export did not become available within one hour');

    const d1Key = `${prefix}/database.sql`;
    const sqlSize = await step.do('Save D1 export to R2', async () => {
      const response = await fetch(signedUrl!);
      if (!response.ok || !response.body) {
        throw new Error(`Unable to download D1 export (HTTP ${response.status})`);
      }
      const saved = await this.env.BACKUP_BUCKET.put(d1Key, response.body, {
        httpMetadata: { contentType: 'application/sql' },
        customMetadata: { bookmark, backupDate },
      });
      return saved.size;
    });

    let cursor: string | undefined;
    let pageNumber = 0;
    let imageCount = 0;
    while (true) {
      pageNumber += 1;
      const page = await step.do<R2PageResult>(`Copy image batch ${pageNumber}`, async () => {
        const listed = await this.env.SOURCE_BUCKET.list({
          prefix: 'forums/',
          cursor,
          limit: r2PageSize,
          include: ['httpMetadata', 'customMetadata'],
        });
        const entries: Array<{
          sourceKey: string;
          backupKey: string;
          size: number;
          httpMetadata?: R2HTTPMetadata;
          customMetadata?: Record<string, string>;
        }> = [];

        for (const listedObject of listed.objects) {
          const sourceObject = await this.env.SOURCE_BUCKET.get(listedObject.key);
          if (!sourceObject)
            throw new Error(`Image disappeared during backup: ${listedObject.key}`);
          const backupKey = `${prefix}/images/${listedObject.key}`;
          const saved = await this.env.BACKUP_BUCKET.put(backupKey, sourceObject.body, {
            httpMetadata: sourceObject.httpMetadata,
            customMetadata: sourceObject.customMetadata,
          });
          if (saved.size !== listedObject.size) {
            throw new Error(`Image size mismatch during backup: ${listedObject.key}`);
          }
          entries.push({
            sourceKey: listedObject.key,
            backupKey,
            size: listedObject.size,
            httpMetadata: sourceObject.httpMetadata,
            customMetadata: sourceObject.customMetadata,
          });
        }

        const pageManifestKey = `${prefix}/r2-manifests/${String(pageNumber).padStart(6, '0')}.json`;
        await this.env.BACKUP_BUCKET.put(pageManifestKey, JSON.stringify(entries), {
          httpMetadata: { contentType: 'application/json' },
        });

        return {
          cursor: listed.truncated ? (listed.cursor ?? null) : null,
          copied: entries.length,
        };
      });
      imageCount += page.copied;
      if (!page.cursor) break;
      cursor = page.cursor;
    }

    await step.do('Mark backup complete', async () => {
      await this.env.BACKUP_BUCKET.put(
        `${prefix}/manifest.json`,
        JSON.stringify({
          completedAt: new Date().toISOString(),
          backupDate,
          database: { key: d1Key, bookmark, size: sqlSize },
          images: { prefix: `${prefix}/images/`, pageCount: pageNumber, count: imageCount },
          retentionDays: snapshotRetentionDays,
        }),
        { httpMetadata: { contentType: 'application/json' } }
      );
      return { backupDate, imageCount, bookmark };
    });

    const expiredDate = new Date(`${backupDate}T00:00:00.000Z`);
    expiredDate.setUTCDate(expiredDate.getUTCDate() - snapshotRetentionDays);
    const expiredPrefix = `snapshots/${dateKey(expiredDate)}/`;
    let expiredCursor: string | undefined;
    let cleanupPage = 0;
    while (true) {
      cleanupPage += 1;
      const deleted = await step.do(`Prune expired backup batch ${cleanupPage}`, async () => {
        const listed = await this.env.BACKUP_BUCKET.list({
          prefix: expiredPrefix,
          cursor: expiredCursor,
          limit: 1000,
        });
        if (listed.objects.length) {
          await this.env.BACKUP_BUCKET.delete(listed.objects.map((object) => object.key));
        }
        return { cursor: listed.truncated ? (listed.cursor ?? null) : null };
      });
      if (!deleted.cursor) break;
      expiredCursor = deleted.cursor;
    }
  }
}

export default {
  async fetch() {
    return new Response('Not found', { status: 404 });
  },
};
