import { and, eq, inArray, sql } from 'drizzle-orm';
import { forumAdmins, forums, users } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';
import requireForumModerator from '~~/server/utils/requireForumModerator';

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug');
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Forum slug is required' });
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const forum = await db.query.forums.findFirst({ where: eq(forums.slug, slug) });
  if (!forum) throw createError({ statusCode: 404, statusMessage: 'Community not found' });
  const actor = await requireForumModerator(event, forum.id);

  const appointed = await db
    .select({
      id: users.id,
      name: users.name,
      email: sql<string | null>`coalesce(${users.email}, ${users.contactEmail})`,
      role: forumAdmins.role,
    })
    .from(forumAdmins)
    .innerJoin(users, eq(forumAdmins.userId, users.id))
    .where(and(eq(forumAdmins.forumId, forum.id), inArray(forumAdmins.role, ['admin', 'mod'])));
  const owner = await db.query.users.findFirst({ where: eq(users.id, forum.ownerUserId) });
  let members = [
    ...(owner
      ? [
          {
            id: owner.id,
            name: owner.name,
            email: owner.email || owner.contactEmail,
            role: 'owner',
          },
        ]
      : []),
    ...appointed,
  ];
  if (actor.role === 'global') {
    members = members.filter((member) => member.id !== actor.userId);
    members.unshift({
      id: actor.userId,
      name: actor.user?.name ?? null,
      email: actor.user?.email || actor.user?.contactEmail || null,
      role: 'global',
    });
  }
  return members;
});
