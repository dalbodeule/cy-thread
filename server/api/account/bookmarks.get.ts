import { and, desc, eq } from 'drizzle-orm';
import { categories, forums, threadBookmarks, threads } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const userId = Number(session.user.id);
  const db = useDrizzle(event.context.cloudflare.env.DB);
  return db
    .select({
      id: threads.id,
      title: threads.title,
      forumSlug: forums.slug,
      forumName: forums.name,
      category: categories.name,
      savedAt: threadBookmarks.createdAt,
    })
    .from(threadBookmarks)
    .innerJoin(threads, eq(threadBookmarks.threadId, threads.id))
    .innerJoin(forums, eq(threads.forumId, forums.id))
    .innerJoin(categories, eq(threads.categoryId, categories.id))
    .where(
      and(
        eq(threadBookmarks.userId, userId),
        eq(threads.isDeleted, false),
        eq(forums.visibility, 'public')
      )
    )
    .orderBy(desc(threadBookmarks.createdAt))
    .limit(100);
});
