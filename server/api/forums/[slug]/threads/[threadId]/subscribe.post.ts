import { and, eq } from 'drizzle-orm';
import { forums, threadSubscriptions, threads } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';
import { requireForumReadable } from '~~/server/utils/forumAccess';

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const userId = Number(session.user.id);
  const slug = getRouterParam(event, 'slug');
  const threadId = Number(getRouterParam(event, 'threadId'));
  const body = await readBody<{ subscribed?: unknown }>(event);
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const forum = await db.query.forums.findFirst({ where: eq(forums.slug, slug || '') });
  const thread = await db.query.threads.findFirst({ where: eq(threads.id, threadId) });
  if (!forum || !thread || thread.forumId !== forum.id)
    throw createError({ statusCode: 404, statusMessage: 'Thread not found' });
  await requireForumReadable(event, forum);
  const subscribed = body?.subscribed === true;
  if (subscribed)
    await db.insert(threadSubscriptions).values({ threadId, userId }).onConflictDoNothing();
  else
    await db
      .delete(threadSubscriptions)
      .where(
        and(eq(threadSubscriptions.threadId, threadId), eq(threadSubscriptions.userId, userId))
      );
  return { subscribed };
});
