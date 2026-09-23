import { and, eq } from 'drizzle-orm';
import { forumAdmins, forums, posts, threads } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const actorUserId = Number(session.user.id);
  const slug = getRouterParam(event, 'slug');
  const threadId = Number(getRouterParam(event, 'threadId'));
  if (
    !slug ||
    !Number.isInteger(actorUserId) ||
    actorUserId < 1 ||
    !Number.isInteger(threadId) ||
    threadId < 1
  ) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid community or thread' });
  }

  const db = useDrizzle(event.context.cloudflare.env.DB);
  const [forum, thread] = await Promise.all([
    db.query.forums.findFirst({ where: eq(forums.slug, slug) }),
    db.query.threads.findFirst({ where: eq(threads.id, threadId) }),
  ]);
  if (!forum || !thread || thread.forumId !== forum.id || thread.isDeleted) {
    throw createError({ statusCode: 404, statusMessage: 'Thread not found' });
  }

  const admin =
    thread.authorUserId === actorUserId || forum.ownerUserId === actorUserId
      ? true
      : Boolean(
          await db.query.forumAdmins.findFirst({
            where: and(eq(forumAdmins.forumId, forum.id), eq(forumAdmins.userId, actorUserId)),
          })
        );
  if (!admin)
    throw createError({
      statusCode: 403,
      statusMessage: 'Only the author or a community moderator can delete this thread',
    });

  const now = new Date();
  await db.batch([
    db
      .update(threads)
      .set({ isDeleted: true, updatedAt: now, isPinned: false })
      .where(and(eq(threads.id, threadId), eq(threads.isDeleted, false))),
    db.update(posts).set({ isDeleted: true, updatedAt: now }).where(eq(posts.threadId, threadId)),
  ]);

  return { id: threadId, deleted: true };
});
