type CleanupEnv = { DB: D1Database; BLOB: R2Bucket };

async function cleanupUnusedAttachments(env: CleanupEnv) {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const rows = await env.DB.prepare(
    'SELECT id, r2_key AS r2Key FROM attachments WHERE post_id IS NULL AND created_at < ? ORDER BY id LIMIT 100'
  )
    .bind(cutoff)
    .all<{ id: number; r2Key: string }>();
  for (const row of rows.results || []) {
    try {
      await env.BLOB.delete(row.r2Key);
      await env.DB.prepare('DELETE FROM attachments WHERE id = ? AND post_id IS NULL')
        .bind(row.id)
        .run();
    } catch (error) {
      console.warn('Unused attachment cleanup failed', { id: row.id, error });
    }
  }
}

async function cleanupStaleAvatars(env: CleanupEnv) {
  const listed = await env.BLOB.list({ prefix: 'avatars/', limit: 100 });
  for (const object of listed.objects || []) {
    const current = await env.DB.prepare(
      'SELECT 1 FROM users WHERE uploaded_avatar_key = ? LIMIT 1'
    )
      .bind(object.key)
      .first();
    if (!current && object.uploaded) {
      try {
        await env.BLOB.delete(object.key);
      } catch (error) {
        console.warn('Stale avatar cleanup failed', { key: object.key, error });
      }
    }
  }
}

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('cloudflare:scheduled', async ({ controller, env }) => {
    if (controller.cron !== '0 * * * *') return;
    const cleanupEnv = env as CleanupEnv;
    await cleanupUnusedAttachments(cleanupEnv);
    await cleanupStaleAvatars(cleanupEnv);
  });
});
