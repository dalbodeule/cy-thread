export default defineSitemapEventHandler(async (event) => {
  const db = event.context.cloudflare.env.DB as D1Database;
  const [forumRows, threadRows] = await Promise.all([
    db.prepare("SELECT slug, created_at FROM forums WHERE visibility = 'public' ORDER BY id DESC LIMIT 10000").all<{ slug: string; created_at: number }>(),
    db.prepare("SELECT f.slug, t.id, t.last_post_at FROM threads t JOIN forums f ON f.id = t.forum_id WHERE f.visibility = 'public' AND t.is_deleted = 0 ORDER BY t.id DESC LIMIT 30000").all<{ slug: string; id: number; last_post_at: number }>(),
  ]);
  return [
    { loc: '/' }, { loc: '/explore' },
    ...(forumRows.results || []).map((forum) => ({ loc: `/forums/${encodeURIComponent(forum.slug)}/threads`, lastmod: new Date(forum.created_at).toISOString() })),
    ...(threadRows.results || []).map((thread) => ({ loc: `/forums/${encodeURIComponent(thread.slug)}/threads/${thread.id}`, lastmod: new Date(thread.last_post_at).toISOString() })),
  ];
});
