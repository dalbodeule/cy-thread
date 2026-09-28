import { and, eq } from 'drizzle-orm';
import { forumAdmins, forums, users } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';
import requireForumModerator from '~~/server/utils/requireForumModerator';

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug');
  const body = await readBody<{ email?: unknown; role?: unknown }>(event);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const role = body?.role;
  const numericId = /^\d+$/.test(email) ? Number(email) : null;
  const memberId = numericId && Number.isSafeInteger(numericId) ? numericId : null;
  if (!slug || email.length > 254 || (!memberId && (email.length < 5 || !email.includes('@')))) {
    throw createError({ statusCode: 400, statusMessage: 'Provide a member email or user ID' });
  }
  if (role !== 'admin' && role !== 'mod') {
    throw createError({ statusCode: 400, statusMessage: 'Role must be admin or mod' });
  }

  const db = useDrizzle(event.context.cloudflare.env.DB);
  const forum = await db.query.forums.findFirst({ where: eq(forums.slug, slug) });
  if (!forum) throw createError({ statusCode: 404, statusMessage: 'Community not found' });
  const actor = await requireForumModerator(event, forum.id);
  if (!['global', 'owner', 'admin'].includes(actor.role)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Admin access is required to appoint moderators',
    });
  }
  if (role === 'admin' && actor.role !== 'owner' && actor.role !== 'global') {
    throw createError({ statusCode: 403, statusMessage: 'Only the owner can appoint an admin' });
  }

  const member = await db.query.users.findFirst({
    where: memberId ? eq(users.id, memberId) : eq(users.email, email),
  });
  if (!member)
    throw createError({ statusCode: 404, statusMessage: 'Sign in once before appointment' });
  if (member.id === forum.ownerUserId) {
    throw createError({ statusCode: 400, statusMessage: 'The owner already has full access' });
  }
  const existing = await db.query.forumAdmins.findFirst({
    where: and(eq(forumAdmins.forumId, forum.id), eq(forumAdmins.userId, member.id)),
  });
  if (existing?.role === 'admin' && actor.role !== 'owner' && actor.role !== 'global') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Only the owner can change an admin role',
    });
  }

  await db
    .insert(forumAdmins)
    .values({ forumId: forum.id, userId: member.id, role })
    .onConflictDoUpdate({
      target: [forumAdmins.forumId, forumAdmins.userId],
      set: { role },
    });
  return { id: member.id, name: member.name, email: member.email || member.contactEmail, role };
});
