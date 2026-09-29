import { count, eq } from 'drizzle-orm';
import { forums, pollVotes, threads } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';
import { requireForumReadable } from '~~/server/utils/forumAccess';
import { parsePollOptions } from '~~/server/utils/threadFormat';

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug');
  const threadId = Number(getRouterParam(event, 'threadId'));
  const body = await readBody<{ optionIndex?: unknown }>(event);
  const optionIndex = Number(body?.optionIndex);
  if (!slug || !Number.isInteger(threadId) || !Number.isInteger(optionIndex)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid poll vote' });
  }
  const session = await requireUserSession(event);
  const userId = Number(session.user?.id);
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const forum = await db.query.forums.findFirst({ where: eq(forums.slug, slug) });
  const thread = await db.query.threads.findFirst({ where: eq(threads.id, threadId) });
  if (!forum || !thread || thread.forumId !== forum.id || thread.isDeleted) {
    throw createError({ statusCode: 404, statusMessage: 'Thread not found' });
  }
  await requireForumReadable(event, forum);
  const options = parsePollOptions(thread.pollJson);
  if (thread.format !== 'poll' || optionIndex < 0 || optionIndex >= options.length) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid poll option' });
  }
  await db
    .insert(pollVotes)
    .values({ threadId, userId, optionIndex })
    .onConflictDoUpdate({
      target: [pollVotes.threadId, pollVotes.userId],
      set: { optionIndex },
    });
  const rows = await db
    .select({ optionIndex: pollVotes.optionIndex, count: count() })
    .from(pollVotes)
    .where(eq(pollVotes.threadId, threadId))
    .groupBy(pollVotes.optionIndex);
  const counts = options.map((_, index) =>
    Number(rows.find((row) => row.optionIndex === index)?.count || 0)
  );
  return { optionIndex, counts };
});
