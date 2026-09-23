import { and, eq } from 'drizzle-orm';
import { forumBans, forumFollowers, forums } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const userId = Number(session.user.id);
  if (!Number.isInteger(userId) || userId < 1) {
    throw createError({ statusCode: 401, statusMessage: 'Sign in is required' });
  }

  const body = await readBody<{ following?: unknown }>(event);
  if (typeof body?.following !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: 'following must be a boolean' });
  }

  const slug = getRouterParam(event, 'slug');
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Forum slug is required' });
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const forum = await db.query.forums.findFirst({ where: eq(forums.slug, slug) });
  if (!forum || forum.visibility !== 'public') {
    throw createError({ statusCode: 404, statusMessage: 'Community not found' });
  }

  const ban = await db.query.forumBans.findFirst({
    where: and(eq(forumBans.forumId, forum.id), eq(forumBans.userId, userId)),
  });
  if (ban)
    throw createError({ statusCode: 403, statusMessage: 'You cannot follow this community' });

  if (body.following) {
    await db.insert(forumFollowers).values({ forumId: forum.id, userId }).onConflictDoNothing();
  } else {
    await db
      .delete(forumFollowers)
      .where(and(eq(forumFollowers.forumId, forum.id), eq(forumFollowers.userId, userId)));
  }

  return { following: body.following };
});
