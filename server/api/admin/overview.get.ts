import { sql } from 'drizzle-orm';
import requireGlobalAdmin from '~~/server/utils/requireGlobalAdmin';

interface Totals {
  users: number;
  forums: number;
  threads: number;
  posts: number;
  openReports: number;
  pendingRequests: number;
}

interface DailyRow {
  day: string;
  users: number;
  forums: number;
  threads: number;
  posts: number;
}

export default defineEventHandler(async (event) => {
  const { db } = await requireGlobalAdmin(event);
  const today = new Date().toISOString().slice(0, 10);
  const since = Date.parse(`${today}T00:00:00.000Z`) - 29 * 86_400_000;

  const [totalsRows, dailyRows, activeRows] = await Promise.all([
    db.all<Totals>(sql`
      SELECT
        (SELECT count(*) FROM users) AS users,
        (SELECT count(*) FROM forums) AS forums,
        (SELECT count(*) FROM threads WHERE is_deleted = 0) AS threads,
        (SELECT count(*) FROM posts p JOIN threads t ON t.id = p.thread_id
          WHERE p.is_deleted = 0 AND t.is_deleted = 0) AS posts,
        (SELECT count(*) FROM reports WHERE status = 'open') AS openReports,
        (SELECT count(*) FROM forum_requests WHERE status = 'pending') AS pendingRequests
    `),
    db.all<DailyRow>(sql`
      SELECT day, sum(users) AS users, sum(forums) AS forums,
             sum(threads) AS threads, sum(posts) AS posts
      FROM (
        SELECT date(created_at / 1000, 'unixepoch') AS day,
               count(*) AS users, 0 AS forums, 0 AS threads, 0 AS posts
        FROM users WHERE created_at >= ${since} GROUP BY day
        UNION ALL
        SELECT date(created_at / 1000, 'unixepoch') AS day,
               0, count(*), 0, 0
        FROM forums WHERE created_at >= ${since} GROUP BY day
        UNION ALL
        SELECT date(created_at / 1000, 'unixepoch') AS day,
               0, 0, count(*), 0
        FROM threads WHERE is_deleted = 0 AND created_at >= ${since} GROUP BY day
        UNION ALL
        SELECT date(p.created_at / 1000, 'unixepoch') AS day,
               0, 0, 0, count(*)
        FROM posts p JOIN threads t ON t.id = p.thread_id
        WHERE p.is_deleted = 0 AND t.is_deleted = 0 AND p.created_at >= ${since}
        GROUP BY day
      ) GROUP BY day ORDER BY day
    `),
    db.all<{ count: number }>(sql`
      SELECT count(*) AS count FROM (
        SELECT author_user_id AS user_id FROM threads
          WHERE is_deleted = 0 AND created_at >= ${since}
        UNION
        SELECT p.author_user_id AS user_id FROM posts p
          JOIN threads t ON t.id = p.thread_id
          WHERE p.is_deleted = 0 AND t.is_deleted = 0 AND p.created_at >= ${since}
      )
    `),
  ]);

  const byDay = new Map(dailyRows.map((row) => [row.day, row]));
  const daily = Array.from({ length: 30 }, (_, index) => {
    const day = new Date(since + index * 86_400_000).toISOString().slice(0, 10);
    return byDay.get(day) ?? { day, users: 0, forums: 0, threads: 0, posts: 0 };
  });
  const last30d = daily.reduce(
    (sum, row) => ({
      users: sum.users + row.users,
      forums: sum.forums + row.forums,
      threads: sum.threads + row.threads,
      posts: sum.posts + row.posts,
    }),
    { users: 0, forums: 0, threads: 0, posts: 0 }
  );

  return {
    totals: totalsRows[0] ?? {
      users: 0,
      forums: 0,
      threads: 0,
      posts: 0,
      openReports: 0,
      pendingRequests: 0,
    },
    last30d: { ...last30d, activeMembers: activeRows[0]?.count ?? 0 },
    daily,
    timezone: 'UTC',
    generatedAt: new Date().toISOString(),
  };
});
