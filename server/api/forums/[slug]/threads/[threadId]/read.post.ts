import { and, eq } from 'drizzle-orm';
import { forums, posts, threadReads, threads } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';
import { requireForumReadable } from '~~/server/utils/forumAccess';

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const userId = Number(session.user.id);
  const slug = getRouterParam(event, 'slug');
  const threadId = Number(getRouterParam(event, 'threadId'));
  const body = await readBody<{ postId?: unknown }>(event);
  const postId = Number(body?.postId);
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const forum = await db.query.forums.findFirst({ where: eq(forums.slug, slug || '') });
  const thread = await db.query.threads.findFirst({ where: eq(threads.id, threadId) });
  if (!forum || !thread || thread.forumId !== forum.id)
    throw createError({ statusCode: 404, statusMessage: 'Thread not found' });
  await requireForumReadable(event, forum);
  const post = Number.isInteger(postId)
    ? await db.query.posts.findFirst({
        where: and(eq(posts.id, postId), eq(posts.threadId, threadId)),
      })
    : null;
  const lastReadPostId = post ? post.id : null;
  await db
    .insert(threadReads)
    .values({ threadId, userId, lastReadPostId, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [threadReads.threadId, threadReads.userId],
      set: { lastReadPostId, updatedAt: new Date() },
    });
  return { lastReadPostId };
});
