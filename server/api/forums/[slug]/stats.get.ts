import { and, eq, sql } from 'drizzle-orm';
import {
  categories,
  forumAdmins,
  forumFollowers,
  forums,
  posts,
  threads,
} from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';

export default defineEventHandler(async (event) => {
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const slug = getRouterParam(event, 'slug');
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Forum slug is required' });

  const forum = await db.query.forums.findFirst({ where: eq(forums.slug, slug) });
  if (!forum || forum.visibility !== 'public') {
    throw createError({ statusCode: 404, statusMessage: 'Community not found' });
  }

  const [memberResult, threadResult, postResult, categoryResult] = await Promise.all([
    db.all<{ count: number }>(sql`SELECT count(*) AS count FROM (
      SELECT ${forums.ownerUserId} AS user_id FROM ${forums} WHERE ${forums.id} = ${forum.id}
      UNION SELECT ${forumAdmins.userId} FROM ${forumAdmins} WHERE ${forumAdmins.forumId} = ${forum.id}
      UNION SELECT ${forumFollowers.userId} FROM ${forumFollowers} WHERE ${forumFollowers.forumId} = ${forum.id}
      UNION SELECT ${threads.authorUserId} FROM ${threads}
        WHERE ${threads.forumId} = ${forum.id} AND ${threads.isDeleted} = 0
      UNION SELECT ${posts.authorUserId} FROM ${posts}
        INNER JOIN ${threads} ON ${posts.threadId} = ${threads.id}
        WHERE ${threads.forumId} = ${forum.id} AND ${threads.isDeleted} = 0 AND ${posts.isDeleted} = 0
    ) AS community_members`),
    db
      .select({ count: sql<number>`count(*)` })
      .from(threads)
      .where(and(eq(threads.forumId, forum.id), eq(threads.isDeleted, false))),
    db
      .select({ count: sql<number>`count(*)` })
      .from(posts)
      .innerJoin(threads, eq(posts.threadId, threads.id))
      .where(
        and(eq(threads.forumId, forum.id), eq(threads.isDeleted, false), eq(posts.isDeleted, false))
      ),
    db
      .select({ count: sql<number>`count(*)` })
      .from(categories)
      .where(eq(categories.forumId, forum.id)),
  ]);

  return {
    members: memberResult[0]?.count ?? 0,
    threads: threadResult[0]?.count ?? 0,
    posts: postResult[0]?.count ?? 0,
    categories: categoryResult[0]?.count ?? 0,
  };
});
