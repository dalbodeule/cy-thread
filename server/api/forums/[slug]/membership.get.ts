import { and, eq } from 'drizzle-orm';
import { forumMembers, forums } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';
import { getForumViewer } from '~~/server/utils/forumAccess';

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event);
  const userId = Number(session.user?.id);
  if (!Number.isInteger(userId) || userId < 1) return { status: 'anonymous', canRead: false };
  const slug = getRouterParam(event, 'slug');
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const forum = slug ? await db.query.forums.findFirst({ where: eq(forums.slug, slug) }) : null;
  if (!forum) throw createError({ statusCode: 404, statusMessage: 'Forum not found' });
  const [membership, viewer] = await Promise.all([
    db.query.forumMembers.findFirst({
      where: and(eq(forumMembers.forumId, forum.id), eq(forumMembers.userId, userId)),
    }),
    getForumViewer(event, forum.id),
  ]);
  const canRead =
    forum.visibility === 'public' ||
    Boolean(
      viewer && (viewer.isMember || viewer.isModerator || viewer.userId === forum.ownerUserId)
    );
  return {
    status: membership?.status || 'none',
    canRead,
    answers: membership?.answersJson ? JSON.parse(membership.answersJson) : [],
  };
});
