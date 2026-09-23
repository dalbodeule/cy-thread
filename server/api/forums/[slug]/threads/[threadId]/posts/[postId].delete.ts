import { and, asc, eq, isNull } from 'drizzle-orm';
import { forumAdmins, forums, posts, threads } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const userId = Number(session.user.id);
  const slug = getRouterParam(event, 'slug');
  const threadId = Number(getRouterParam(event, 'threadId'));
  const postId = Number(getRouterParam(event, 'postId'));
  if (
    !slug ||
    !Number.isInteger(userId) ||
    userId < 1 ||
    !Number.isInteger(threadId) ||
    threadId < 1 ||
    !Number.isInteger(postId) ||
    postId < 1
  ) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid community, thread, or post' });
  }
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const [forum, thread, post, starter] = await Promise.all([
    db.query.forums.findFirst({ where: eq(forums.slug, slug) }),
    db.query.threads.findFirst({ where: eq(threads.id, threadId) }),
    db.query.posts.findFirst({
      where: and(eq(posts.id, postId), eq(posts.threadId, threadId), eq(posts.isDeleted, false)),
    }),
    db
      .select({ id: posts.id })
      .from(posts)
      .where(and(eq(posts.threadId, threadId), isNull(posts.parentPostId)))
      .orderBy(asc(posts.createdAt), asc(posts.id))
      .limit(1),
  ]);
  if (
    !forum ||
    forum.visibility !== 'public' ||
    !thread ||
    thread.forumId !== forum.id ||
    thread.isDeleted ||
    !post
  )
    throw createError({ statusCode: 404, statusMessage: 'Post not found' });
  if (starter[0]?.id === postId)
    throw createError({
      statusCode: 409,
      statusMessage: 'Delete the thread to remove its starter post',
    });
  const moderator =
    forum.ownerUserId === userId ||
    Boolean(
      await db.query.forumAdmins.findFirst({
        where: and(eq(forumAdmins.forumId, forum.id), eq(forumAdmins.userId, userId)),
      })
    );
  if (post.authorUserId !== userId && !moderator)
    throw createError({ statusCode: 403, statusMessage: 'You cannot delete this post' });
  await db
    .update(posts)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(eq(posts.id, postId));
  return { id: postId, deleted: true };
});
