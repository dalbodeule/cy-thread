import { and, desc, eq } from 'drizzle-orm';
import { categories, forums, posts, threads } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const userId = Number(session.user.id);
  if (!Number.isInteger(userId) || userId < 1) {
    throw createError({ statusCode: 401, statusMessage: 'Sign in is required' });
  }
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const [writtenThreads, writtenPosts] = await Promise.all([
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
      .where(and(eq(threads.authorUserId, userId), eq(threads.isDeleted, false)))
      .orderBy(desc(threads.createdAt))
      .limit(50),
    db
      .select({
        id: posts.id,
        threadId: threads.id,
        threadTitle: threads.title,
        forumSlug: forums.slug,
        forumName: forums.name,
        createdAt: posts.createdAt,
      })
      .from(posts)
      .innerJoin(threads, eq(posts.threadId, threads.id))
      .innerJoin(forums, eq(threads.forumId, forums.id))
      .where(
        and(
          eq(posts.authorUserId, userId),
          eq(posts.isDeleted, false),
          eq(threads.isDeleted, false)
        )
      )
      .orderBy(desc(posts.createdAt))
      .limit(100),
  ]);
  return { threads: writtenThreads, posts: writtenPosts };
});
