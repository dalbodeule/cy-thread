import { and, eq } from 'drizzle-orm';
import { forumMembers, forums } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';
import requireForumModerator from '~~/server/utils/requireForumModerator';

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug');
  const userId = Number(getRouterParam(event, 'userId'));
  const body = await readBody<{ status?: unknown }>(event);
  const status = body?.status === 'approved' || body?.status === 'rejected' ? body.status : '';
  if (!Number.isInteger(userId) || !status)
    throw createError({ statusCode: 400, statusMessage: 'Invalid membership decision' });
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const forum = slug ? await db.query.forums.findFirst({ where: eq(forums.slug, slug) }) : null;
  if (!forum) throw createError({ statusCode: 404, statusMessage: 'Forum not found' });
  const actor = await requireForumModerator(event, forum.id);
  if (!['global', 'owner', 'admin'].includes(actor.role))
    throw createError({ statusCode: 403, statusMessage: 'Forum admin access is required' });
  await db
    .update(forumMembers)
    .set({ status, reviewedByUserId: actor.userId, reviewedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(forumMembers.forumId, forum.id), eq(forumMembers.userId, userId)));
  return { status };
});
