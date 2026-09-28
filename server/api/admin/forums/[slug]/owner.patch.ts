import { and, eq } from 'drizzle-orm';
import { forumAdmins, forums, users } from '~~/server/db/schema';
import requireGlobalAdmin from '~~/server/utils/requireGlobalAdmin';

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug');
  const body = await readBody<{ email?: unknown }>(event);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const numericId = /^\d+$/.test(email) ? Number(email) : null;
  const memberId = numericId && Number.isSafeInteger(numericId) ? numericId : null;
  if (!slug || email.length > 254 || (!memberId && !email.includes('@'))) {
    throw createError({ statusCode: 400, statusMessage: 'Provide a member email or user ID' });
  }
  const { db } = await requireGlobalAdmin(event);
  const [forum, nextOwner] = await Promise.all([
    db.query.forums.findFirst({ where: eq(forums.slug, slug) }),
    db.query.users.findFirst({ where: memberId ? eq(users.id, memberId) : eq(users.email, email) }),
  ]);
  if (!forum) throw createError({ statusCode: 404, statusMessage: 'Forum not found' });
  if (!nextOwner)
    throw createError({ statusCode: 404, statusMessage: 'Member must sign in first' });
  if (forum.ownerUserId === nextOwner.id) return { ownerUserId: nextOwner.id };
  await db.batch([
    db.update(forums).set({ ownerUserId: nextOwner.id }).where(eq(forums.id, forum.id)),
    db
      .delete(forumAdmins)
      .where(and(eq(forumAdmins.forumId, forum.id), eq(forumAdmins.userId, forum.ownerUserId))),
    db
      .insert(forumAdmins)
      .values({ forumId: forum.id, userId: nextOwner.id, role: 'owner' })
      .onConflictDoUpdate({
        target: [forumAdmins.forumId, forumAdmins.userId],
        set: { role: 'owner' },
      }),
  ]);
  return { ownerUserId: nextOwner.id };
});
