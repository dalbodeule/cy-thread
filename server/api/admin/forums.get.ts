import { sql } from 'drizzle-orm';
import { getQuery } from 'h3';
import requireGlobalAdmin from '~~/server/utils/requireGlobalAdmin';

interface ForumRow {
  id: number;
  slug: string;
  name: string;
  visibility: string;
  createdAt: number;
  ownerName: string | null;
  ownerEmail: string | null;
  threads: number;
  posts: number;
  openReports: number;
}

export default defineEventHandler(async (event) => {
  const { db } = await requireGlobalAdmin(event);
  const query = getQuery(event);
  const search = typeof query.q === 'string' ? query.q.trim().slice(0, 100) : '';
  const requestedPage = Number(query.page);
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 10_000) : 1;
  const pageSize = 20;
  const filter = search
    ? sql`WHERE instr(lower(f.name), lower(${search})) > 0
        OR instr(lower(f.slug), lower(${search})) > 0`
    : sql``;

  const [totalRows, items] = await Promise.all([
    db.all<{ count: number }>(sql`SELECT count(*) AS count FROM forums f ${filter}`),
    db.all<ForumRow>(sql`
      SELECT f.id, f.slug, f.name, f.visibility, f.created_at AS createdAt,
             u.name AS ownerName, u.email AS ownerEmail,
             (SELECT count(*) FROM threads t
               WHERE t.forum_id = f.id AND t.is_deleted = 0) AS threads,
             (SELECT count(*) FROM posts p JOIN threads t ON t.id = p.thread_id
               WHERE t.forum_id = f.id AND t.is_deleted = 0 AND p.is_deleted = 0) AS posts,
             (SELECT count(*) FROM reports r
               WHERE r.forum_id = f.id AND r.status = 'open') AS openReports
      FROM forums f JOIN users u ON u.id = f.owner_user_id
      ${filter}
      ORDER BY f.created_at DESC, f.id DESC
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
    `),
  ]);

  return { items, total: totalRows[0]?.count ?? 0, page, pageSize };
});
