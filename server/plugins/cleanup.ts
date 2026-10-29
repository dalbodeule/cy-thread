import { summarizeError } from '~~/server/utils/logError';

type CleanupEnv = { DB: D1Database; BLOB: R2Bucket };

async function cleanupUnusedAttachments(env: CleanupEnv) {
  const now = Date.now();
  const cutoff = now - 24 * 60 * 60 * 1000;
  const retryBefore = now - 6 * 60 * 60 * 1000;
  const rows = await env.DB.prepare(
    'SELECT id, r2_key AS r2Key FROM attachments WHERE post_id IS NULL AND created_at < ? AND (cleanup_attempted_at IS NULL OR cleanup_attempted_at < ?) ORDER BY COALESCE(cleanup_attempted_at, 0), created_at, id LIMIT 100'
  )
    .bind(cutoff, retryBefore)
    .all<{ id: number; r2Key: string }>();
  for (const row of rows.results || []) {
    try {
      await env.BLOB.delete(row.r2Key);
      await env.DB.prepare('DELETE FROM attachments WHERE id = ? AND post_id IS NULL')
        .bind(row.id)
        .run();
    } catch (error) {
      console.warn({
        event: 'unused_attachment_cleanup_failed',
        id: row.id,
        ...summarizeError(error),
      });
      await env.DB.prepare(
        'UPDATE attachments SET cleanup_attempted_at = ? WHERE id = ? AND post_id IS NULL'
      )
        .bind(now, row.id)
        .run()
        .catch((markError) =>
          console.warn({
            event: 'unused_attachment_cleanup_retry_record_failed',
            id: row.id,
            ...summarizeError(markError),
          })
        );
    }
  }
}

async function cleanupStaleAvatars(env: CleanupEnv) {
  let cursor: string | undefined;
  do {
    const listed = await env.BLOB.list({
      prefix: 'avatars/',
      limit: 100,
      ...(cursor ? { cursor } : {}),
    });
    const objects = listed.objects || [];
    const keys = objects.map((object) => object.key);
    if (keys.length) {
      const referenced = await env.DB.prepare(
        `SELECT uploaded_avatar_key AS key FROM users WHERE uploaded_avatar_key IN (${keys.map(() => '?').join(',')})`
      )
        .bind(...keys)
        .all<{ key: string }>();
      const currentKeys = new Set((referenced.results || []).map((row) => row.key));
      const stale = objects.filter((object) => object.uploaded && !currentKeys.has(object.key));
      const results = await Promise.allSettled(stale.map((object) => env.BLOB.delete(object.key)));
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.warn({
            event: 'stale_avatar_cleanup_failed',
            key: stale[index]?.key,
            ...summarizeError(result.reason),
          });
        }
      });
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
}

async function cleanupDeletedPostAttachments(env: CleanupEnv) {
  const now = Date.now();
  const cutoff = now - 30 * 24 * 60 * 60 * 1000;
  const retryBefore = now - 6 * 60 * 60 * 1000;
  const rows = await env.DB.prepare(
    'SELECT a.id, a.r2_key AS r2Key FROM attachments a INNER JOIN posts p ON p.id = a.post_id WHERE p.is_deleted = 1 AND p.updated_at < ? AND (a.cleanup_attempted_at IS NULL OR a.cleanup_attempted_at < ?) ORDER BY COALESCE(a.cleanup_attempted_at, 0), p.updated_at, a.id LIMIT 100'
  )
    .bind(cutoff, retryBefore)
    .all<{ id: number; r2Key: string }>();
  const candidates = rows.results || [];
  const results = await Promise.allSettled(
    candidates.map((attachment) => env.BLOB.delete(attachment.r2Key))
  );
  const deletedIds: number[] = [];
  const retryIds: number[] = [];
  results.forEach((result, index) => {
    const attachment = candidates[index];
    if (!attachment) return;
    if (result.status === 'fulfilled') deletedIds.push(attachment.id);
    else {
      retryIds.push(attachment.id);
      console.warn({
        event: 'deleted_post_attachment_cleanup_failed',
        id: attachment.id,
        ...summarizeError(result.reason),
      });
    }
  });
  if (retryIds.length) {
    await env.DB.prepare(
      `UPDATE attachments SET cleanup_attempted_at = ? WHERE id IN (${retryIds.map(() => '?').join(',')})`
    )
      .bind(now, ...retryIds)
      .run()
      .catch((error) =>
        console.warn({
          event: 'deleted_post_attachment_cleanup_retries_record_failed',
          ...summarizeError(error),
        })
      );
  }
  if (deletedIds.length) {
    try {
      await env.DB.prepare(
        `DELETE FROM attachments WHERE id IN (${deletedIds.map(() => '?').join(',')}) AND post_id IS NOT NULL AND EXISTS (SELECT 1 FROM posts p WHERE p.id = attachments.post_id AND p.is_deleted = 1 AND p.updated_at < ?)`
      )
        .bind(...deletedIds, cutoff)
        .run();
    } catch (error) {
      console.warn({
        event: 'deleted_post_attachment_metadata_cleanup_failed',
        ...summarizeError(error),
      });
      const results = await Promise.allSettled(
        deletedIds.map((id) =>
          env.DB.prepare('UPDATE attachments SET cleanup_attempted_at = ? WHERE id = ?')
            .bind(now, id)
            .run()
        )
      );
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.warn({
            event: 'deleted_post_attachment_cleanup_retry_record_failed',
            id: deletedIds[index],
            ...summarizeError(result.reason),
          });
        }
      });
    }
  }
}

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('cloudflare:scheduled', async ({ controller, env }) => {
    if (controller.cron !== '0 * * * *') return;
    const cleanupEnv = env as CleanupEnv;
    await cleanupUnusedAttachments(cleanupEnv);
    await cleanupStaleAvatars(cleanupEnv);
    await cleanupDeletedPostAttachments(cleanupEnv);
  });
});
