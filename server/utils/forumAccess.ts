import { and, eq } from 'drizzle-orm';
import { forumAdmins, forumMembers } from '~~/server/db/schema';
import type { forums } from '~~/server/db/schema';
import isGlobalAdmin from '~~/server/utils/isGlobalAdmin';

export type ForumViewer = { userId: number; isModerator: boolean; isMember: boolean };

export async function getForumViewer(event: Parameters<typeof getUserSession>[0], forumId: number) {
  const session = await getUserSession(event);
  const userId = Number(session.user?.id);
  if (!Number.isInteger(userId) || userId < 1) return null;
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const [admin, member, global] = await Promise.all([
    db.query.forumAdmins.findFirst({
      where: and(eq(forumAdmins.forumId, forumId), eq(forumAdmins.userId, userId)),
    }),
    db.query.forumMembers.findFirst({
      where: and(
        eq(forumMembers.forumId, forumId),
        eq(forumMembers.userId, userId),
        eq(forumMembers.status, 'approved')
      ),
    }),
    isGlobalAdmin(db, userId),
  ]);
  return {
    userId,
    isModerator: Boolean(admin) || Boolean(global),
    isMember: Boolean(member),
  } satisfies ForumViewer;
}

export async function requireForumReadable(
  event: Parameters<typeof getUserSession>[0],
  forum: typeof forums.$inferSelect
) {
  if (forum.visibility === 'public') return null;
  const viewer = await getForumViewer(event, forum.id);
  if (!viewer || (!viewer.isModerator && !viewer.isMember && forum.ownerUserId !== viewer.userId))
    throw createError({ statusCode: 403, statusMessage: 'Forum membership is required' });
  return viewer;
}

export async function requireForumCommentAccess(
  event: Parameters<typeof getUserSession>[0],
  forum: typeof forums.$inferSelect,
  commentAccess: 'guest' | 'members' | 'forum_members'
) {
  if (commentAccess === 'guest') return await getForumViewer(event, forum.id);
  const viewer = await getForumViewer(event, forum.id);
  if (!viewer)
    throw createError({ statusCode: 401, statusMessage: 'Sign in is required to comment' });
  if (
    commentAccess === 'forum_members' &&
    !viewer.isMember &&
    !viewer.isModerator &&
    viewer.userId !== forum.ownerUserId
  )
    throw createError({
      statusCode: 403,
      statusMessage: 'Forum membership is required to comment',
    });
  return viewer;
}
