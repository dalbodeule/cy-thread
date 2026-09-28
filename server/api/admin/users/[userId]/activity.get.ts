import { desc, eq, sql } from 'drizzle-orm';
import { getQuery } from 'h3';
import { userSuspensions, users } from '~~/server/db/schema';
import requireGlobalAdmin from '~~/server/utils/requireGlobalAdmin';

interface ActivityRow {
  kind: 'thread' | 'comment';
  id: number;
  threadId: number;
  forumSlug: string;
  forumName: string;
  title: string;
  excerpt: string | null;
  createdAt: number;
}

export default defineEventHandler(async (event) => {
  const userId = Number(getRouterParam(event, 'userId'));
  if (!Number.isSafeInteger(userId) || userId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'Provide a valid user ID' });
  }
  const { db } = await requireGlobalAdmin(event);
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw createError({ statusCode: 404, statusMessage: 'User not found' });

  const query = getQuery(event);
  const search = typeof query.q === 'string' ? query.q.trim().slice(0, 100) : '';
  const kind = query.kind === 'thread' || query.kind === 'comment' ? query.kind : 'all';
  const requestedPage = Number(query.page);
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 10_000) : 1;
  const pageSize = 20;
  const kindFilter = kind === 'all' ? sql`` : sql`AND kind = ${kind}`;
  const searchFilter = search
    ? sql`AND (instr(lower(title), lower(${search})) > 0
        OR instr(lower(coalesce(excerpt, '')), lower(${search})) > 0)`
    : sql``;
  const activity = sql`
    SELECT 'thread' AS kind, t.id, t.id AS threadId, f.slug AS forumSlug,
           f.name AS forumName, t.title,
           substr(starter.markdown, 1, 240) AS excerpt, t.created_at AS createdAt
    FROM threads t JOIN forums f ON f.id = t.forum_id
    LEFT JOIN posts starter ON starter.id = (
      SELECT p.id FROM posts p WHERE p.thread_id = t.id AND p.parent_post_id IS NULL
        AND p.is_deleted = 0 ORDER BY p.id LIMIT 1
    )
    WHERE t.author_user_id = ${userId} AND t.is_deleted = 0
    UNION ALL
    SELECT 'comment' AS kind, p.id, t.id AS threadId, f.slug AS forumSlug,
           f.name AS forumName, t.title,
           substr(p.markdown, 1, 240) AS excerpt, p.created_at AS createdAt
    FROM posts p JOIN threads t ON t.id = p.thread_id
      JOIN forums f ON f.id = t.forum_id
    WHERE p.author_user_id = ${userId} AND p.parent_post_id IS NOT NULL
      AND p.is_deleted = 0 AND t.is_deleted = 0
  `;

  const [totalRows, items, sanctions] = await Promise.all([
    db.all<{ count: number }>(sql`
      SELECT count(*) AS count FROM (${activity}) WHERE 1 = 1 ${kindFilter} ${searchFilter}
    `),
    db.all<ActivityRow>(sql`
      SELECT * FROM (${activity}) WHERE 1 = 1 ${kindFilter} ${searchFilter}
      ORDER BY createdAt DESC, id DESC
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
    `),
    db
      .select({
        id: userSuspensions.id,
        reason: userSuspensions.reason,
        duration: userSuspensions.duration,
        createdAt: userSuspensions.createdAt,
        expiresAt: userSuspensions.expiresAt,
        revokedAt: userSuspensions.revokedAt,
      })
      .from(userSuspensions)
      .where(eq(userSuspensions.userId, userId))
      .orderBy(desc(userSuspensions.id))
      .limit(10),
  ]);

  const now = Date.now();
  const activeSuspension = sanctions.find(
    (item) => !item.revokedAt && (!item.expiresAt || item.expiresAt.getTime() > now)
  );
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email || user.contactEmail,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      isGlobalAdmin: user.isGlobalAdmin,
    },
    activeSuspension: activeSuspension ?? null,
    sanctions,
    activity: { items, total: totalRows[0]?.count ?? 0, page, pageSize },
  };
});
