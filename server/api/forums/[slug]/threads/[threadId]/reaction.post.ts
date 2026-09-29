import { and, count, eq, isNull } from 'drizzle-orm';
import { forums, posts, reactions, threads } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';
import { requireForumReadable } from '~~/server/utils/forumAccess';

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug');
  const threadId = Number(getRouterParam(event, 'threadId'));
  const body = await readBody<{ target?: unknown; targetId?: unknown; reacted?: unknown }>(event);
  const target = body?.target === 'post' ? 'post' : 'thread';
  const targetId = Number(body?.targetId ?? threadId);
  const reacted = body?.reacted === true;
  if (!slug || !Number.isInteger(threadId) || threadId < 1 || !Number.isInteger(targetId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid reaction target' });
  }
  const session = await requireUserSession(event);
  const userId = Number(session.user?.id);
  if (!Number.isInteger(userId) || userId < 1) {
    throw createError({ statusCode: 401, statusMessage: 'Login required' });
  }

  const db = useDrizzle(event.context.cloudflare.env.DB);
  const forum = await db.query.forums.findFirst({ where: eq(forums.slug, slug) });
  const thread = await db.query.threads.findFirst({ where: eq(threads.id, threadId) });
  if (!forum || !thread || thread.forumId !== forum.id || thread.isDeleted) {
    throw createError({ statusCode: 404, statusMessage: 'Thread not found' });
  }
  await requireForumReadable(event, forum);

  const targetWhere =
    target === 'post'
      ? and(eq(posts.id, targetId), eq(posts.threadId, threadId), eq(posts.isDeleted, false))
      : eq(threads.id, threadId);
  if (target === 'post') {
    const post = await db.query.posts.findFirst({ where: targetWhere });
    if (!post) throw createError({ statusCode: 404, statusMessage: 'Post not found' });
  }

  const reactionWhere =
    target === 'post'
      ? and(
          eq(reactions.userId, userId),
          eq(reactions.postId, targetId),
          isNull(reactions.threadId),
          eq(reactions.kind, 'like')
        )
      : and(
          eq(reactions.userId, userId),
          eq(reactions.threadId, threadId),
          isNull(reactions.postId),
          eq(reactions.kind, 'like')
        );
  await db.delete(reactions).where(reactionWhere);
  if (reacted) {
    await db.insert(reactions).values({
      userId,
      threadId: target === 'thread' ? threadId : null,
      postId: target === 'post' ? targetId : null,
      kind: 'like',
    });
  }
  const countWhere =
    target === 'post'
      ? and(eq(reactions.postId, targetId), eq(reactions.kind, 'like'))
      : and(eq(reactions.threadId, threadId), eq(reactions.kind, 'like'));
  const [{ total }] = await db.select({ total: count() }).from(reactions).where(countWhere);
  return { reacted, count: Number(total) };
});
