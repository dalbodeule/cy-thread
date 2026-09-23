import { eq } from 'drizzle-orm';
import { forumAdmins, forumFollowers, forums } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const userId = Number(session.user.id);
  if (!Number.isInteger(userId) || userId < 1) {
    throw createError({ statusCode: 401, statusMessage: 'Sign in is required' });
  }

  const db = useDrizzle(event.context.cloudflare.env.DB);
  const [owned, administered, followed] = await Promise.all([
    db
      .select({ id: forums.id, slug: forums.slug, name: forums.name })
      .from(forums)
      .where(eq(forums.ownerUserId, userId)),
    db
      .select({ id: forums.id, slug: forums.slug, name: forums.name })
      .from(forumAdmins)
      .innerJoin(forums, eq(forumAdmins.forumId, forums.id))
      .where(eq(forumAdmins.userId, userId)),
    db
      .select({ id: forums.id, slug: forums.slug, name: forums.name })
      .from(forumFollowers)
      .innerJoin(forums, eq(forumFollowers.forumId, forums.id))
      .where(eq(forumFollowers.userId, userId)),
  ]);
  return [
    ...new Map([...owned, ...administered, ...followed].map((forum) => [forum.id, forum])).values(),
  ];
});
