import { and, desc, eq } from 'drizzle-orm';
import { forums, posts, reports, threads, users } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';
import requireForumModerator from '~~/server/utils/requireForumModerator';

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug');
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Forum slug is required' });
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const forum = await db.query.forums.findFirst({ where: eq(forums.slug, slug) });
  if (!forum) throw createError({ statusCode: 404, statusMessage: 'Community not found' });
  await requireForumModerator(event, forum.id);

  const query = getQuery(event);
  const status = String(query.status || 'open');
  if (
    !(['open', 'resolved', 'dismissed'] as const).includes(
      status as 'open' | 'resolved' | 'dismissed'
    )
  ) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid report status' });
  }
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 30));

  return db
    .select({
      id: reports.id,
      reason: reports.reason,
      details: reports.details,
      status: reports.status,
      createdAt: reports.createdAt,
      threadId: reports.threadId,
      postId: reports.postId,
      postBody: posts.markdown,
      postDeleted: posts.isDeleted,
      postAuthorUserId: posts.authorUserId,
      threadTitle: threads.title,
      threadAuthorUserId: threads.authorUserId,
      threadDeleted: threads.isDeleted,
      reporter: users.name,
    })
    .from(reports)
    .innerJoin(threads, eq(reports.threadId, threads.id))
    .innerJoin(users, eq(reports.reporterUserId, users.id))
    .leftJoin(posts, eq(reports.postId, posts.id))
    .where(and(eq(reports.forumId, forum.id), eq(reports.status, status)))
    .orderBy(desc(reports.createdAt))
    .limit(limit);
});
