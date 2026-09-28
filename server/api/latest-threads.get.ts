export default defineEventHandler(async (event) => {
  const db = event.context.cloudflare.env.DB as D1Database;
  const result = await db
    .prepare(
      `
    SELECT t.id, t.title, t.last_post_at AS lastPostAt,
           f.slug AS forumSlug, f.name AS forumName,
           c.name AS categoryName,
           u.name AS authorName,
           (SELECT substr(p.markdown, 1, 240) FROM posts p WHERE p.thread_id = t.id AND p.is_deleted = 0 ORDER BY p.id LIMIT 1) AS excerpt
    FROM threads t
    JOIN forums f ON f.id = t.forum_id AND f.visibility = 'public'
    JOIN categories c ON c.id = t.category_id
    JOIN users u ON u.id = t.author_user_id
    WHERE t.is_deleted = 0
    ORDER BY t.last_post_at DESC, t.id DESC
    LIMIT 12
  `
    )
    .all<{
      id: number;
      title: string;
      lastPostAt: number;
      forumSlug: string;
      forumName: string;
      categoryName: string;
      authorName: string | null;
      excerpt: string | null;
    }>();
  return result.results || [];
});
