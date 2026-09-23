import { and, eq } from 'drizzle-orm';
import { forums, reports } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';
import requireForumModerator from '~~/server/utils/requireForumModerator';

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug');
  const reportId = Number(getRouterParam(event, 'reportId'));
  const body = await readBody<{ status?: unknown }>(event);
  if (!slug || !Number.isInteger(reportId) || reportId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid community or report' });
  }
  if (body?.status !== 'resolved' && body?.status !== 'dismissed') {
    throw createError({ statusCode: 400, statusMessage: 'Status must be resolved or dismissed' });
  }

  const db = useDrizzle(event.context.cloudflare.env.DB);
  const forum = await db.query.forums.findFirst({ where: eq(forums.slug, slug) });
  if (!forum) throw createError({ statusCode: 404, statusMessage: 'Community not found' });
  const { userId } = await requireForumModerator(event, forum.id);
  const [report] = await db
    .update(reports)
    .set({
      status: body.status,
      reviewedByUserId: userId,
      reviewedAt: new Date(),
    })
    .where(and(eq(reports.id, reportId), eq(reports.forumId, forum.id), eq(reports.status, 'open')))
    .returning({ id: reports.id });

  if (!report) throw createError({ statusCode: 404, statusMessage: 'Open report not found' });
  return { id: report.id, status: body.status };
});
