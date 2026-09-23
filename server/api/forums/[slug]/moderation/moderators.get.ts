import { and, eq, inArray } from 'drizzle-orm';
import { forumAdmins, forums, users } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';
import requireForumModerator from '~~/server/utils/requireForumModerator';

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug');
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Forum slug is required' });
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const forum = await db.query.forums.findFirst({ where: eq(forums.slug, slug) });
  if (!forum) throw createError({ statusCode: 404, statusMessage: 'Community not found' });
  await requireForumModerator(event, forum.id);

  const appointed = await db
    .select({ id: users.id, name: users.name, email: users.email, role: forumAdmins.role })
    .from(forumAdmins)
    .innerJoin(users, eq(forumAdmins.userId, users.id))
    .where(and(eq(forumAdmins.forumId, forum.id), inArray(forumAdmins.role, ['admin', 'mod'])));
  const owner = await db.query.users.findFirst({ where: eq(users.id, forum.ownerUserId) });
  return [
    ...(owner ? [{ id: owner.id, name: owner.name, email: owner.email, role: 'owner' }] : []),
    ...appointed,
  ];
});
