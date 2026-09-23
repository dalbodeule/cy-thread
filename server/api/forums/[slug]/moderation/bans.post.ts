import { and, eq } from 'drizzle-orm';
import { forumBans, forumFollowers, forums, users } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';
import requireForumModerator from '~~/server/utils/requireForumModerator';

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug');
  const body = await readBody<{ userId?: unknown; banned?: unknown; reason?: unknown }>(event);
  const userId = Number(body?.userId);
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
  if (
    !slug ||
    !Number.isInteger(userId) ||
    userId < 1 ||
    typeof body?.banned !== 'boolean' ||
    reason.length > 500
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Provide a valid user, banned flag, and reason under 500 characters',
    });
  }

  const db = useDrizzle(event.context.cloudflare.env.DB);
  const forum = await db.query.forums.findFirst({ where: eq(forums.slug, slug) });
  if (!forum) throw createError({ statusCode: 404, statusMessage: 'Community not found' });
  await requireForumModerator(event, forum.id);
  if (forum.ownerUserId === userId) {
    throw createError({ statusCode: 400, statusMessage: 'The community owner cannot be banned' });
  }
  const target = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!target) throw createError({ statusCode: 404, statusMessage: 'Member not found' });

  if (body.banned) {
    await db
      .insert(forumBans)
      .values({ forumId: forum.id, userId, reason: reason || null })
      .onConflictDoUpdate({
        target: [forumBans.forumId, forumBans.userId],
        set: { reason: reason || null, createdAt: new Date() },
      });
    await db
      .delete(forumFollowers)
      .where(and(eq(forumFollowers.forumId, forum.id), eq(forumFollowers.userId, userId)));
  } else {
    await db
      .delete(forumBans)
      .where(and(eq(forumBans.forumId, forum.id), eq(forumBans.userId, userId)));
  }
  return { userId, banned: body.banned };
});
