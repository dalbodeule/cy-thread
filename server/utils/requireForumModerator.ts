import { and, eq, inArray } from 'drizzle-orm';
import type { H3Event } from 'h3';
import { forumAdmins, forums } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';

export default async function requireForumModerator(event: H3Event, forumId: number) {
  const session = await requireUserSession(event);
  const userId = Number(session.user.id);
  if (!Number.isInteger(userId) || userId < 1) {
    throw createError({ statusCode: 401, statusMessage: 'Sign in is required' });
  }

  const db = useDrizzle(event.context.cloudflare.env.DB);
  const [forum, role] = await Promise.all([
    db.query.forums.findFirst({ where: eq(forums.id, forumId) }),
    db.query.forumAdmins.findFirst({
      where: and(
        eq(forumAdmins.forumId, forumId),
        eq(forumAdmins.userId, userId),
        inArray(forumAdmins.role, ['owner', 'admin', 'mod'])
      ),
    }),
  ]);

  if (!forum) throw createError({ statusCode: 404, statusMessage: 'Community not found' });
  if (forum.ownerUserId !== userId && !role) {
    throw createError({ statusCode: 403, statusMessage: 'Moderator access is required' });
  }

  return { db, forum, userId, role: forum.ownerUserId === userId ? 'owner' : role?.role || 'mod' };
}
