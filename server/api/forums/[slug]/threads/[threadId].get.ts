import { and, asc, eq } from 'drizzle-orm';
import { categories, forumAdmins, forums, posts, threads, users } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug');
  const threadId = Number(getRouterParam(event, 'threadId'));
  if (!slug || !Number.isInteger(threadId) || threadId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid community or thread' });
  }

  const db = useDrizzle(event.context.cloudflare.env.DB);
  const [thread] = await db
    .select({
      id: threads.id,
      title: threads.title,
      isLocked: threads.isLocked,
      isPinned: threads.isPinned,
      category: categories.name,
      categorySlug: categories.slug,
      forumId: forums.id,
      authorId: users.id,
      author: users.name,
      authorAvatarUrl: users.avatarUrl,
      createdAt: threads.createdAt,
    })
    .from(threads)
    .innerJoin(forums, eq(threads.forumId, forums.id))
    .innerJoin(categories, eq(threads.categoryId, categories.id))
    .innerJoin(users, eq(threads.authorUserId, users.id))
    .where(
      and(
        eq(forums.slug, slug),
        eq(threads.id, threadId),
        eq(threads.isDeleted, false),
        eq(forums.visibility, 'public')
      )
    )
    .limit(1);

  if (!thread) throw createError({ statusCode: 404, statusMessage: 'Thread not found' });

  const replies = await db
    .select({
      id: posts.id,
      authorId: users.id,
      author: users.name,
      authorAvatarUrl: users.avatarUrl,
      markdown: posts.markdown,
      createdAt: posts.createdAt,
    })
    .from(posts)
    .innerJoin(users, eq(posts.authorUserId, users.id))
    .where(and(eq(posts.threadId, threadId), eq(posts.isDeleted, false)))
    .orderBy(asc(posts.createdAt), asc(posts.id));

  const session = await getUserSession(event);
  const viewerId = Number(session.user?.id);
  const isAuthor = Number(thread.authorId) === viewerId;
  let canModerate = false;
  if (Number.isInteger(viewerId) && viewerId > 0) {
    const [forum, admin] = await Promise.all([
      db.query.forums.findFirst({ where: eq(forums.id, thread.forumId) }),
      db.query.forumAdmins.findFirst({
        where: and(eq(forumAdmins.forumId, thread.forumId), eq(forumAdmins.userId, viewerId)),
      }),
    ]);
    canModerate = forum?.ownerUserId === viewerId || Boolean(admin);
  }

  return {
    ...thread,
    isAuthor,
    canModerate,
    replies: replies.map((reply) => ({ ...reply, isAuthor: Number(reply.authorId) === viewerId })),
  };
});
