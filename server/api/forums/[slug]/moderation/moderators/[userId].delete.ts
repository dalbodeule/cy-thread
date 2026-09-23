import { and, eq } from 'drizzle-orm';
import { forumAdmins, forums } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';
import requireForumModerator from '~~/server/utils/requireForumModerator';

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug');
  const userId = Number(getRouterParam(event, 'userId'));
  if (!slug || !Number.isInteger(userId) || userId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid community or member' });
  }
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const forum = await db.query.forums.findFirst({ where: eq(forums.slug, slug) });
  if (!forum) throw createError({ statusCode: 404, statusMessage: 'Community not found' });
  const actor = await requireForumModerator(event, forum.id);
  if (actor.role !== 'owner' && actor.role !== 'admin') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Admin access is required to remove moderators',
    });
  }
  if (userId === forum.ownerUserId) {
    throw createError({ statusCode: 400, statusMessage: 'The owner cannot be removed' });
  }
  const target = await db.query.forumAdmins.findFirst({
    where: and(eq(forumAdmins.forumId, forum.id), eq(forumAdmins.userId, userId)),
  });
  if (!target) throw createError({ statusCode: 404, statusMessage: 'Moderator not found' });
  if (target.role === 'admin' && actor.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Only the owner can remove an admin' });
  }
  await db
    .delete(forumAdmins)
    .where(and(eq(forumAdmins.forumId, forum.id), eq(forumAdmins.userId, userId)));
  return { id: userId, removed: true };
});
