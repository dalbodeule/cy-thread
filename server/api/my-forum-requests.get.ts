import { desc, eq } from 'drizzle-orm';
import { forumRequests } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const userId = Number(session.user.id);
  if (!Number.isInteger(userId) || userId < 1) throw createError({ statusCode: 401 });
  const db = useDrizzle(event.context.cloudflare.env.DB);
  return db
    .select({
      id: forumRequests.id,
      name: forumRequests.name,
      slug: forumRequests.slug,
      status: forumRequests.status,
      createdAt: forumRequests.createdAt,
    })
    .from(forumRequests)
    .where(eq(forumRequests.requesterUserId, userId))
    .orderBy(desc(forumRequests.createdAt))
    .limit(20);
});
