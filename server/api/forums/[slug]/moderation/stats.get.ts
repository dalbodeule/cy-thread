import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { forums, posts, reports, threads } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';
import requireForumModerator from '~~/server/utils/requireForumModerator';

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug');
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Forum slug is required' });
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const forum = await db.query.forums.findFirst({ where: eq(forums.slug, slug) });
  if (!forum) throw createError({ statusCode: 404, statusMessage: 'Community not found' });
  await requireForumModerator(event, forum.id);

  const since = new Date(Date.now() - 29 * 86_400_000);
  const [active, openReports, dailyThreads, dailyPosts] = await Promise.all([
    db
      .select({ count: sql<number>`count(distinct ${posts.authorUserId})` })
      .from(posts)
      .innerJoin(threads, eq(posts.threadId, threads.id))
      .where(
        and(
          eq(threads.forumId, forum.id),
          eq(threads.isDeleted, false),
          eq(posts.isDeleted, false),
          gte(posts.createdAt, since)
        )
      ),
    db
      .select({ count: sql<number>`count(*)` })
      .from(reports)
      .where(and(eq(reports.forumId, forum.id), eq(reports.status, 'open'))),
    db
      .select({
        day: sql<string>`date(${threads.createdAt} / 1000, 'unixepoch')`,
        count: sql<number>`count(*)`,
      })
      .from(threads)
      .where(
        and(
          eq(threads.forumId, forum.id),
          eq(threads.isDeleted, false),
          gte(threads.createdAt, since)
        )
      )
      .groupBy(sql`date(${threads.createdAt} / 1000, 'unixepoch')`)
      .orderBy(desc(sql`date(${threads.createdAt} / 1000, 'unixepoch')`))
      .limit(30),
    db
      .select({
        day: sql<string>`date(${posts.createdAt} / 1000, 'unixepoch')`,
        count: sql<number>`count(*)`,
      })
      .from(posts)
      .innerJoin(threads, eq(posts.threadId, threads.id))
      .where(
        and(
          eq(threads.forumId, forum.id),
          eq(threads.isDeleted, false),
          eq(posts.isDeleted, false),
          gte(posts.createdAt, since)
        )
      )
      .groupBy(sql`date(${posts.createdAt} / 1000, 'unixepoch')`)
      .orderBy(desc(sql`date(${posts.createdAt} / 1000, 'unixepoch')`))
      .limit(30),
  ]);
  const daily = new Map<string, { day: string; threads: number; posts: number }>();
  for (const item of dailyThreads)
    daily.set(item.day, { day: item.day, threads: item.count, posts: 0 });
  for (const item of dailyPosts)
    daily.set(item.day, {
      ...(daily.get(item.day) || { day: item.day, threads: 0, posts: 0 }),
      posts: item.count,
    });
  const filledDays = Array.from({ length: 30 }, (_, index) => {
    const day = new Date(Date.now() - (29 - index) * 86_400_000).toISOString().slice(0, 10);
    return daily.get(day) || { day, threads: 0, posts: 0 };
  });
  return {
    activeMembers30d: active[0]?.count ?? 0,
    openReports: openReports[0]?.count ?? 0,
    daily: filledDays,
  };
});
