import { desc, eq } from 'drizzle-orm';
import { forumRequests, users } from '~~/server/db/schema';
import requireGlobalAdmin from '~~/server/utils/requireGlobalAdmin';

export default defineEventHandler(async (event) => {
  const { db } = await requireGlobalAdmin(event);
  return db
    .select({
      id: forumRequests.id,
      name: forumRequests.name,
      slug: forumRequests.slug,
      status: forumRequests.status,
      requester: users.name,
      requesterEmail: users.email,
      createdAt: forumRequests.createdAt,
    })
    .from(forumRequests)
    .innerJoin(users, eq(forumRequests.requesterUserId, users.id))
    .where(eq(forumRequests.status, 'pending'))
    .orderBy(desc(forumRequests.createdAt))
    .limit(100);
});
