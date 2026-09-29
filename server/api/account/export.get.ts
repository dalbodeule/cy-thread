import { desc, eq } from 'drizzle-orm';
import { posts, reports, threads, users } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const userId = Number(session.user.id);
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const [account, writtenThreads, writtenPosts, submittedReports] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { id: true, name: true, email: true, contactEmail: true, createdAt: true },
    }),
    db
      .select()
      .from(threads)
      .where(eq(threads.authorUserId, userId))
      .orderBy(desc(threads.createdAt))
      .limit(1000),
    db
      .select()
      .from(posts)
      .where(eq(posts.authorUserId, userId))
      .orderBy(desc(posts.createdAt))
      .limit(5000),
    db
      .select()
      .from(reports)
      .where(eq(reports.reporterUserId, userId))
      .orderBy(desc(reports.createdAt))
      .limit(1000),
  ]);
  if (!account) throw createError({ statusCode: 404, statusMessage: 'Account not found' });
  setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8');
  setResponseHeader(
    event,
    'Content-Disposition',
    'attachment; filename="mori-space-account-export.json"'
  );
  return {
    exportedAt: new Date().toISOString(),
    account,
    threads: writtenThreads,
    posts: writtenPosts,
    reports: submittedReports,
  };
});
