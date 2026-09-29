import { desc, eq } from 'drizzle-orm';
import { forums, moderationLogs, users } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';
import requireForumModerator from '~~/server/utils/requireForumModerator';

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug');
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const forum = await db.query.forums.findFirst({ where: eq(forums.slug, slug || '') });
  if (!forum) throw createError({ statusCode: 404, statusMessage: 'Community not found' });
  await requireForumModerator(event, forum.id);
  return db
    .select({
      id: moderationLogs.id,
      targetType: moderationLogs.targetType,
      targetId: moderationLogs.targetId,
      action: moderationLogs.action,
      reason: moderationLogs.reason,
      createdAt: moderationLogs.createdAt,
      actorName: users.name,
    })
    .from(moderationLogs)
    .innerJoin(users, eq(moderationLogs.actorUserId, users.id))
    .where(eq(moderationLogs.forumId, forum.id))
    .orderBy(desc(moderationLogs.createdAt))
    .limit(100);
});
