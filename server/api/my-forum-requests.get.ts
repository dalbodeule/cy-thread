import { count, desc, eq, max } from 'drizzle-orm';
import { forumRequests } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const userId = Number(session.user.id);
  if (!Number.isInteger(userId) || userId < 1) throw createError({ statusCode: 401 });
  const rawPage = Number(getQuery(event).page);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, 10000) : 1;
  const pageSize = 10;
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const where = eq(forumRequests.requesterUserId, userId);
  const [items, totalRows, blockedRows] = await Promise.all([
    db
      .select({
        id: forumRequests.id,
        name: forumRequests.name,
        slug: forumRequests.slug,
        description: forumRequests.description,
        status: forumRequests.status,
        createdAt: forumRequests.createdAt,
        reviewedAt: forumRequests.reviewedAt,
        reapplyBlockedUntil: forumRequests.reapplyBlockedUntil,
      })
      .from(forumRequests)
      .where(where)
      .orderBy(desc(forumRequests.createdAt), desc(forumRequests.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(forumRequests).where(where),
    db
      .select({ until: max(forumRequests.reapplyBlockedUntil) })
      .from(forumRequests)
      .where(where),
  ]);
  const total = totalRows[0]?.total || 0;
  const until = blockedRows[0]?.until;
  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    reapplyBlockedUntil: until && until > new Date() ? until : null,
  };
});
