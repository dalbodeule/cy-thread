import { count, desc, eq } from 'drizzle-orm';
import { forumRequests, users } from '~~/server/db/schema';
import requireGlobalAdmin from '~~/server/utils/requireGlobalAdmin';

export default defineEventHandler(async (event) => {
  const { db } = await requireGlobalAdmin(event);
  const rawPage = Number(getQuery(event).page);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, 10000) : 1;
  const pageSize = 10;
  const pending = eq(forumRequests.status, 'pending');
  const [items, totalRows] = await Promise.all([
    db
      .select({
        id: forumRequests.id,
        name: forumRequests.name,
        slug: forumRequests.slug,
        description: forumRequests.description,
        requester: users.name,
        requesterEmail: users.email,
        createdAt: forumRequests.createdAt,
      })
      .from(forumRequests)
      .innerJoin(users, eq(forumRequests.requesterUserId, users.id))
      .where(pending)
      .orderBy(desc(forumRequests.createdAt), desc(forumRequests.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(forumRequests).where(pending),
  ]);
  const total = totalRows[0]?.total || 0;
  return { items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
});
