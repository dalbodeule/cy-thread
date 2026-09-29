import { and, eq } from 'drizzle-orm';
import { forumMembers, forums } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event);
  const userId = Number(session.user?.id);
  if (!Number.isInteger(userId) || userId < 1) return { status: 'anonymous' };
  const slug = getRouterParam(event, 'slug');
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const forum = slug ? await db.query.forums.findFirst({ where: eq(forums.slug, slug) }) : null;
  if (!forum) throw createError({ statusCode: 404, statusMessage: 'Forum not found' });
  const membership = await db.query.forumMembers.findFirst({
    where: and(eq(forumMembers.forumId, forum.id), eq(forumMembers.userId, userId)),
  });
  return {
    status: membership?.status || 'none',
    answers: membership?.answersJson ? JSON.parse(membership.answersJson) : [],
  };
});
