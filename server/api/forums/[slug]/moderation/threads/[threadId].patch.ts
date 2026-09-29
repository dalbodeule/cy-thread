import { and, eq } from 'drizzle-orm';
import { forums, moderationLogs, threads } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';
import requireForumModerator from '~~/server/utils/requireForumModerator';

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug');
  const threadId = Number(getRouterParam(event, 'threadId'));
  const body = await readBody<{ isLocked?: unknown; isPinned?: unknown }>(event);
  if (!slug || !Number.isInteger(threadId) || threadId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid community or thread' });
  }
  const updates: { isLocked?: boolean; isPinned?: boolean } = {};
  if (typeof body?.isLocked === 'boolean') updates.isLocked = body.isLocked;
  if (typeof body?.isPinned === 'boolean') updates.isPinned = body.isPinned;
  if (!Object.keys(updates).length) {
    throw createError({ statusCode: 400, statusMessage: 'Provide isLocked or isPinned' });
  }

  const db = useDrizzle(event.context.cloudflare.env.DB);
  const forum = await db.query.forums.findFirst({ where: eq(forums.slug, slug) });
  if (!forum) throw createError({ statusCode: 404, statusMessage: 'Community not found' });
  const { userId } = await requireForumModerator(event, forum.id);
  const [thread] = await db
    .update(threads)
    .set(updates)
    .where(
      and(eq(threads.id, threadId), eq(threads.forumId, forum.id), eq(threads.isDeleted, false))
    )
    .returning({ id: threads.id, isLocked: threads.isLocked, isPinned: threads.isPinned });
  if (!thread) throw createError({ statusCode: 404, statusMessage: 'Thread not found' });
  for (const [key, value] of Object.entries(updates)) {
    await db.insert(moderationLogs).values({
      forumId: forum.id,
      actorUserId: userId,
      targetType: 'thread',
      targetId: thread.id,
      action: `${key}_${value ? 'on' : 'off'}`,
    });
  }
  return thread;
});
