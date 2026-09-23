import { and, eq } from 'drizzle-orm';
import { forums, posts, reports, threads } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';
import verifyHuman from '~~/server/utils/verifyHuman';

const allowedReasons = ['spam', 'harassment', 'unsafe', 'other'] as const;

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const reporterUserId = Number(session.user.id);
  const slug = getRouterParam(event, 'slug');
  const threadId = Number(getRouterParam(event, 'threadId'));
  const postId = Number(getRouterParam(event, 'postId'));
  const body = await readBody<{ reason?: unknown; details?: unknown; turnstileToken?: unknown }>(
    event
  );
  const reason = typeof body?.reason === 'string' ? body.reason : '';
  const details = typeof body?.details === 'string' ? body.details.trim() : '';
  if (!Number.isInteger(reporterUserId) || reporterUserId < 1)
    throw createError({ statusCode: 401, statusMessage: 'Sign in is required' });
  if (
    !slug ||
    !Number.isInteger(threadId) ||
    threadId < 1 ||
    !Number.isInteger(postId) ||
    postId < 1
  )
    throw createError({ statusCode: 400, statusMessage: 'Invalid community, thread, or post' });
  if (!allowedReasons.includes(reason as (typeof allowedReasons)[number]) || details.length > 1000)
    throw createError({
      statusCode: 400,
      statusMessage: 'Choose a report reason and keep details under 1000 characters',
    });
  await verifyHuman(event, body?.turnstileToken);

  const db = useDrizzle(event.context.cloudflare.env.DB);
  const [forum, thread, post] = await Promise.all([
    db.query.forums.findFirst({ where: eq(forums.slug, slug) }),
    db.query.threads.findFirst({ where: eq(threads.id, threadId) }),
    db.query.posts.findFirst({
      where: and(eq(posts.id, postId), eq(posts.threadId, threadId), eq(posts.isDeleted, false)),
    }),
  ]);
  if (
    !forum ||
    forum.visibility !== 'public' ||
    !thread ||
    thread.forumId !== forum.id ||
    thread.isDeleted ||
    !post
  )
    throw createError({ statusCode: 404, statusMessage: 'Post not found' });
  if (post.authorUserId === reporterUserId)
    throw createError({ statusCode: 400, statusMessage: 'You cannot report your own post' });

  const existing = await db.query.reports.findFirst({
    where: and(
      eq(reports.forumId, forum.id),
      eq(reports.postId, postId),
      eq(reports.reporterUserId, reporterUserId),
      eq(reports.status, 'open')
    ),
  });
  if (existing) return { id: existing.id, submitted: false };
  const [report] = await db
    .insert(reports)
    .values({
      forumId: forum.id,
      reporterUserId,
      threadId,
      postId,
      reason,
      details: details || null,
    })
    .returning({ id: reports.id });
  if (!report) throw createError({ statusCode: 500, statusMessage: 'Unable to submit report' });
  setResponseStatus(event, 201);
  return { id: report.id, submitted: true };
});
