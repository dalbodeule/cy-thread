import { and, desc, eq, like, or, sql } from 'drizzle-orm';
import { categories, forums, posts, threadBookmarks, threads, users } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event);
  const viewerId = Number(session.user?.id);
  const bookmarkUserId = Number.isInteger(viewerId) && viewerId > 0 ? viewerId : -1;
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const slug = getRouterParam(event, 'slug');
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Forum slug is required' });

  const forum = await db.query.forums.findFirst({ where: eq(forums.slug, slug) });
  if (!forum || forum.visibility !== 'public') {
    throw createError({ statusCode: 404, statusMessage: 'Community not found' });
  }

  const query = String(getQuery(event).q ?? '')
    .trim()
    .slice(0, 100);
  const categorySlug = String(getQuery(event).category ?? '')
    .trim()
    .slice(0, 80);
  const sort = String(getQuery(event).sort ?? 'activity');
  const limit = Math.min(50, Math.max(1, Number(getQuery(event).limit) || 20));
  const offset = Math.max(0, Number(getQuery(event).offset) || 0);
  const filters = [eq(threads.forumId, forum.id), eq(threads.isDeleted, false)];
  if (categorySlug) filters.push(eq(categories.slug, categorySlug));
  if (query)
    filters.push(or(like(threads.title, `%${query}%`), like(posts.markdown, `%${query}%`))!);

  const result = await db
    .select({
      id: threads.id,
      title: threads.title,
      category: categories.name,
      categorySlug: categories.slug,
      author: users.name,
      authorAvatarUrl: users.avatarUrl,
      createdAt: threads.createdAt,
      lastPostAt: threads.lastPostAt,
      isPinned: threads.isPinned,
      isBookmarked: sql<boolean>`exists (
      select 1 from ${threadBookmarks}
      where ${threadBookmarks.threadId} = ${threads.id}
        and ${threadBookmarks.userId} = ${bookmarkUserId}
    )`,
      replyCount: sql<number>`(select count(*) from ${posts} as replies where replies.thread_id = ${threads.id} and replies.is_deleted = 0)`,
      excerpt: sql<string>`coalesce((select substr(${posts.markdown}, 1, 240) from ${posts} where ${posts.threadId} = ${threads.id} and ${posts.isDeleted} = 0 order by ${posts.createdAt} asc limit 1), '')`,
    })
    .from(threads)
    .innerJoin(categories, eq(threads.categoryId, categories.id))
    .innerJoin(users, eq(threads.authorUserId, users.id))
    .leftJoin(posts, and(eq(posts.threadId, threads.id), eq(posts.isDeleted, false)))
    .where(and(...filters))
    .groupBy(threads.id, categories.id, users.id)
    .orderBy(
      ...(sort === 'latest'
        ? [desc(threads.createdAt), desc(threads.id)]
        : [desc(threads.isPinned), desc(threads.lastPostAt), desc(threads.createdAt)])
    )
    .limit(limit)
    .offset(offset);

  return result.map((thread) => ({
    ...thread,
    isBookmarked: Boolean(thread.isBookmarked),
  }));
});
