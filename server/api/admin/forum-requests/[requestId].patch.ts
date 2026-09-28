import { and, eq } from 'drizzle-orm';
import { forumRequests, forums } from '~~/server/db/schema';
import requireGlobalAdmin from '~~/server/utils/requireGlobalAdmin';

export default defineEventHandler(async (event) => {
  const requestId = Number(getRouterParam(event, 'requestId'));
  const body = await readBody<{ decision?: unknown }>(event);
  if (
    !Number.isInteger(requestId) ||
    requestId < 1 ||
    !['approve', 'reject'].includes(String(body?.decision))
  ) {
    throw createError({ statusCode: 400, statusMessage: 'Choose approve or reject' });
  }
  const { db, userId } = await requireGlobalAdmin(event);
  const request = await db.query.forumRequests.findFirst({
    where: and(eq(forumRequests.id, requestId), eq(forumRequests.status, 'pending')),
  });
  if (!request) throw createError({ statusCode: 404, statusMessage: 'Pending request not found' });

  if (body.decision === 'reject') {
    const [updated] = await db
      .update(forumRequests)
      .set({ status: 'rejected', reviewedByUserId: userId, reviewedAt: new Date() })
      .where(and(eq(forumRequests.id, requestId), eq(forumRequests.status, 'pending')))
      .returning({ id: forumRequests.id });
    if (!updated) throw createError({ statusCode: 409, statusMessage: 'Request already reviewed' });
    return { id: requestId, status: 'rejected' };
  }

  if (await db.query.forums.findFirst({ where: eq(forums.slug, request.slug) })) {
    throw createError({ statusCode: 409, statusMessage: 'Community address is already taken' });
  }
  const database = event.context.cloudflare.env.DB;
  const forumBySlug = '(SELECT id FROM forums WHERE slug = ?)';
  try {
    await database.batch([
      database
        .prepare(
          "INSERT INTO forums (slug, name, owner_user_id, visibility) SELECT slug, name, requester_user_id, 'public' FROM forum_requests WHERE id = ? AND status = 'pending'"
        )
        .bind(requestId),
      database
        .prepare(
          `INSERT INTO forum_admins (forum_id, user_id, role) VALUES (${forumBySlug}, ?, 'owner')`
        )
        .bind(request.slug, request.requesterUserId),
      ...[
        ['소개와 공지', 'announcements', 0],
        ['질문과 답변', 'questions', 1],
        ['자유 이야기', 'lounge', 2],
      ].map(([name, slug, order]) =>
        database
          .prepare(
            `INSERT INTO categories (forum_id, name, slug, sort_order) VALUES (${forumBySlug}, ?, ?, ?)`
          )
          .bind(request.slug, name, slug, order)
      ),
      database
        .prepare(
          "UPDATE forum_requests SET status = 'approved', reviewed_by_user_id = ?, reviewed_at = ? WHERE id = ? AND status = 'pending'"
        )
        .bind(userId, Date.now(), requestId),
    ]);
  } catch (error) {
    console.error('Unable to approve community request', error);
    throw createError({
      statusCode: 409,
      statusMessage: 'Community request could not be approved',
    });
  }
  return { id: requestId, slug: request.slug, status: 'approved' };
});
