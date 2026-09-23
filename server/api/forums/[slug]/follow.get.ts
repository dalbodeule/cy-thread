import { and, eq } from 'drizzle-orm';
import { forumFollowers, forums } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event);
  const userId = Number(session.user?.id);
  if (!Number.isInteger(userId) || userId < 1) return { following: false };

  const slug = getRouterParam(event, 'slug');
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Forum slug is required' });
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const forum = await db.query.forums.findFirst({ where: eq(forums.slug, slug) });
  if (!forum || forum.visibility !== 'public') {
    throw createError({ statusCode: 404, statusMessage: 'Community not found' });
  }

  const follower = await db.query.forumFollowers.findFirst({
    where: and(eq(forumFollowers.forumId, forum.id), eq(forumFollowers.userId, userId)),
  });
  return { following: Boolean(follower) };
});
