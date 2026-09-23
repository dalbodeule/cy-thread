import { and, eq } from 'drizzle-orm';
import { forums, threadBookmarks, threads } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const userId = Number(session.user.id);
  if (!Number.isInteger(userId) || userId < 1) {
    throw createError({ statusCode: 401, statusMessage: 'Sign in is required' });
  }

  const threadId = Number(getRouterParam(event, 'threadId'));
  if (!Number.isInteger(threadId) || threadId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid thread id' });
  }
  const body = await readBody<{ bookmarked?: unknown }>(event);
  if (typeof body?.bookmarked !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: 'bookmarked must be a boolean' });
  }

  const slug = getRouterParam(event, 'slug');
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Forum slug is required' });
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const forum = await db.query.forums.findFirst({ where: eq(forums.slug, slug) });
  if (!forum || forum.visibility !== 'public') {
    throw createError({ statusCode: 404, statusMessage: 'Community not found' });
  }
  const thread = await db.query.threads.findFirst({
    where: and(eq(threads.id, threadId), eq(threads.forumId, forum.id)),
  });
  if (!thread || thread.isDeleted)
    throw createError({ statusCode: 404, statusMessage: 'Thread not found' });

  if (body.bookmarked) {
    await db.insert(threadBookmarks).values({ threadId, userId }).onConflictDoNothing();
  } else {
    await db
      .delete(threadBookmarks)
      .where(and(eq(threadBookmarks.threadId, threadId), eq(threadBookmarks.userId, userId)));
  }
  return { bookmarked: body.bookmarked };
});
