export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('cloudflare:scheduled', async ({ controller, env }) => {
    if (controller.cron !== '0 * * * *') return;

    const { DB } = env as { DB: D1Database };
    const refreshedAt = Date.now();
    const since = refreshedAt - 24 * 60 * 60 * 1000;
    await DB.batch([
      DB.prepare('DELETE FROM featured_categories'),
      DB.prepare(
        `
        INSERT INTO featured_categories (rank, category_id, activity_count, refreshed_at)
        SELECT row_number() OVER (ORDER BY recent_posts DESC, last_activity DESC, category_id) AS rank,
               category_id, recent_posts, ?
        FROM (
          SELECT c.id AS category_id,
                 count(p.id) AS recent_posts,
                 max(coalesce(p.created_at, t.created_at)) AS last_activity
          FROM categories c
          JOIN forums f ON f.id = c.forum_id AND f.visibility = 'public'
          LEFT JOIN threads t ON t.category_id = c.id AND t.is_deleted = 0
          LEFT JOIN posts p ON p.thread_id = t.id AND p.is_deleted = 0 AND p.created_at >= ?
          GROUP BY c.id
          ORDER BY recent_posts DESC, last_activity DESC, c.id
          LIMIT 8
        )
      `
      ).bind(refreshedAt, since),
    ]);
    console.log({ event: 'featured_categories_refreshed', refreshedAt });
  });
});
