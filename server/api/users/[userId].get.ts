import { and, desc, eq, sql } from 'drizzle-orm';
import { categories, forums, posts, threads, userBlocks, users } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';

export default defineEventHandler(async (event) => {
  const userId = Number(getRouterParam(event, 'userId'));
  if (!Number.isInteger(userId) || userId < 1)
    throw createError({ statusCode: 400, statusMessage: 'Invalid user' });
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const session = await getUserSession(event);
  const viewerId = Number(session.user?.id);
  const [user, writtenThreads, writtenPosts, block] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { id: true, name: true, avatarUrl: true, createdAt: true },
    }),
    db
      .select({
        id: threads.id,
        title: threads.title,
        forumSlug: forums.slug,
        forumName: forums.name,
        category: categories.name,
        createdAt: threads.createdAt,
      })
      .from(threads)
      .innerJoin(forums, eq(threads.forumId, forums.id))
      .innerJoin(categories, eq(threads.categoryId, categories.id))
      .where(
        and(
          eq(threads.authorUserId, userId),
          eq(threads.isDeleted, false),
          eq(forums.visibility, 'public')
        )
      )
      .orderBy(desc(threads.createdAt))
      .limit(30),
    db
      .select({
        id: posts.id,
        threadId: threads.id,
        threadTitle: threads.title,
        forumSlug: forums.slug,
        forumName: forums.name,
        createdAt: posts.createdAt,
        excerpt: sql<string>`substr(${posts.markdown}, 1, 180)`,
      })
      .from(posts)
      .innerJoin(threads, eq(posts.threadId, threads.id))
      .innerJoin(forums, eq(threads.forumId, forums.id))
      .where(
        and(
          eq(posts.authorUserId, userId),
          eq(posts.isDeleted, false),
          eq(threads.isDeleted, false),
          eq(forums.visibility, 'public')
        )
      )
      .orderBy(desc(posts.createdAt))
      .limit(50),
    Number.isInteger(viewerId) && viewerId > 0
      ? db.query.userBlocks.findFirst({
          where: and(eq(userBlocks.blockerUserId, viewerId), eq(userBlocks.blockedUserId, userId)),
        })
      : Promise.resolve(null),
  ]);
  if (!user) throw createError({ statusCode: 404, statusMessage: 'User not found' });
  return { ...user, isBlocked: Boolean(block), threads: writtenThreads, posts: writtenPosts };
});
