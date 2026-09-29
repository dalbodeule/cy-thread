import { desc, eq, sql } from 'drizzle-orm';
import { forums, notifications, users } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const userId = Number(session.user.id);
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const rows = await db
    .select({
      id: notifications.id,
      kind: notifications.kind,
      message: notifications.message,
      threadId: notifications.threadId,
      forumId: notifications.forumId,
      forumSlug: forums.slug,
      actorName: users.name,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .leftJoin(users, eq(notifications.actorUserId, users.id))
    .leftJoin(forums, eq(notifications.forumId, forums.id))
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(50);
  const unread = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(sql`${notifications.userId} = ${userId} AND ${notifications.readAt} IS NULL`);
  return { items: rows, unread: Number(unread[0]?.count || 0) };
});
