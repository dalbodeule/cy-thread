import { sql } from 'drizzle-orm';
import { getQuery } from 'h3';
import requireGlobalAdmin from '~~/server/utils/requireGlobalAdmin';

interface UserRow {
  id: number;
  name: string | null;
  email: string | null;
  canReceiveMail: number;
  avatarUrl: string | null;
  createdAt: number;
  isGlobalAdmin: number;
  threadCount: number;
  commentCount: number;
  lastActivityAt: number | null;
  lastThreadId: number | null;
  lastThreadTitle: string | null;
  lastCommentThreadId: number | null;
  lastCommentExcerpt: string | null;
  suspensionId: number | null;
  suspensionReason: string | null;
  suspensionExpiresAt: number | null;
}

export default defineEventHandler(async (event) => {
  const { db } = await requireGlobalAdmin(event);
  const query = getQuery(event);
  const search = typeof query.q === 'string' ? query.q.trim().slice(0, 100) : '';
  const status = query.status === 'suspended' ? 'suspended' : 'all';
  const requestedPage = Number(query.page);
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 10_000) : 1;
  const pageSize = 20;
  const now = Date.now();
  const searchFilter = search
    ? sql`AND (
        instr(lower(coalesce(u.name, '')), lower(${search})) > 0 OR
        instr(lower(coalesce(u.email, '')), lower(${search})) > 0 OR
        instr(lower(coalesce(u.contact_email, '')), lower(${search})) > 0 OR
        EXISTS (SELECT 1 FROM threads t WHERE t.author_user_id = u.id AND t.is_deleted = 0
          AND instr(lower(t.title), lower(${search})) > 0) OR
        EXISTS (SELECT 1 FROM posts p JOIN threads t ON t.id = p.thread_id
          WHERE p.author_user_id = u.id AND p.is_deleted = 0 AND t.is_deleted = 0
          AND instr(lower(p.markdown), lower(${search})) > 0)
      )`
    : sql``;
  const statusFilter =
    status === 'suspended'
      ? sql`AND EXISTS (SELECT 1 FROM user_suspensions s WHERE s.user_id = u.id
        AND s.revoked_at IS NULL AND (s.expires_at IS NULL OR s.expires_at > ${now}))`
      : sql``;

  const [totalRows, rows] = await Promise.all([
    db.all<{ count: number }>(sql`
      SELECT count(*) AS count FROM users u WHERE 1 = 1 ${searchFilter} ${statusFilter}
    `),
    db.all<UserRow>(sql`
      SELECT u.id, u.name, coalesce(u.email, u.contact_email) AS email, u.avatar_url AS avatarUrl,
             CASE WHEN u.mail_notifications_enabled = 1 AND
               (nullif(u.email, '') IS NOT NULL OR
                (u.contact_email_verified_at IS NOT NULL AND nullif(u.contact_email, '') IS NOT NULL))
               THEN 1 ELSE 0 END AS canReceiveMail,
             u.created_at AS createdAt, u.is_global_admin AS isGlobalAdmin,
             (SELECT count(*) FROM threads t WHERE t.author_user_id = u.id
               AND t.is_deleted = 0) AS threadCount,
             (SELECT count(*) FROM posts p JOIN threads t ON t.id = p.thread_id
               WHERE p.author_user_id = u.id AND p.parent_post_id IS NOT NULL
               AND p.is_deleted = 0 AND t.is_deleted = 0) AS commentCount,
             max(
               coalesce((SELECT max(t.created_at) FROM threads t
                 WHERE t.author_user_id = u.id AND t.is_deleted = 0), 0),
               coalesce((SELECT max(p.created_at) FROM posts p
                 JOIN threads t ON t.id = p.thread_id
                 WHERE p.author_user_id = u.id AND p.parent_post_id IS NOT NULL
                   AND p.is_deleted = 0 AND t.is_deleted = 0), 0)
             ) AS lastActivityAt,
             (SELECT t.id FROM threads t WHERE t.author_user_id = u.id AND t.is_deleted = 0
               ORDER BY t.created_at DESC, t.id DESC LIMIT 1) AS lastThreadId,
             (SELECT t.title FROM threads t WHERE t.author_user_id = u.id AND t.is_deleted = 0
               ORDER BY t.created_at DESC, t.id DESC LIMIT 1) AS lastThreadTitle,
             (SELECT p.thread_id FROM posts p JOIN threads t ON t.id = p.thread_id
               WHERE p.author_user_id = u.id AND p.parent_post_id IS NOT NULL
                 AND p.is_deleted = 0 AND t.is_deleted = 0
               ORDER BY p.created_at DESC, p.id DESC LIMIT 1) AS lastCommentThreadId,
             (SELECT substr(p.markdown, 1, 120) FROM posts p JOIN threads t ON t.id = p.thread_id
               WHERE p.author_user_id = u.id AND p.parent_post_id IS NOT NULL
                 AND p.is_deleted = 0 AND t.is_deleted = 0
               ORDER BY p.created_at DESC, p.id DESC LIMIT 1) AS lastCommentExcerpt,
             s.id AS suspensionId, s.reason AS suspensionReason,
             s.expires_at AS suspensionExpiresAt
      FROM users u
      LEFT JOIN user_suspensions s ON s.id = (
        SELECT latest.id FROM user_suspensions latest
        WHERE latest.user_id = u.id AND latest.revoked_at IS NULL
          AND (latest.expires_at IS NULL OR latest.expires_at > ${now})
        ORDER BY latest.id DESC LIMIT 1
      )
      WHERE 1 = 1 ${searchFilter} ${statusFilter}
      ORDER BY u.created_at DESC, u.id DESC
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
    `),
  ]);
  return {
    items: rows.map((row) => ({
      ...row,
      isGlobalAdmin: Boolean(row.isGlobalAdmin),
      canReceiveMail: Boolean(row.canReceiveMail),
      lastActivityAt: row.lastActivityAt || null,
    })),
    total: totalRows[0]?.count ?? 0,
    page,
    pageSize,
  };
});
