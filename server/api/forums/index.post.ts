import { and, eq, gt } from 'drizzle-orm';
import { forumRequests, forums } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';
import verifyHuman from '~~/server/utils/verifyHuman';

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const requesterUserId = Number(session.user.id);
  if (!Number.isInteger(requesterUserId) || requesterUserId < 1) {
    throw createError({ statusCode: 401, statusMessage: 'Sign in is required' });
  }
  const body = await readBody<{
    name?: unknown;
    slug?: unknown;
    description?: unknown;
    turnstileToken?: unknown;
  }>(event);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const slug = typeof body?.slug === 'string' ? body.slug.trim().toLowerCase() : '';
  const description = typeof body?.description === 'string' ? body.description.trim() : '';
  if (name.length < 2 || name.length > 60 || /[\u0000-\u001f<>]/.test(name)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Community name must be 2 to 60 characters',
    });
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 50) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Use a lowercase URL slug up to 50 characters',
    });
  }
  if (
    description.length < 20 ||
    description.length > 2000 ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(description)
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: '상세 설명은 20자 이상 2,000자 이하로 입력해 주세요.',
    });
  }
  await verifyHuman(event, body?.turnstileToken);
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const blocked = await db.query.forumRequests.findFirst({
    where: and(
      eq(forumRequests.requesterUserId, requesterUserId),
      gt(forumRequests.reapplyBlockedUntil, new Date())
    ),
    columns: { reapplyBlockedUntil: true },
    orderBy: (requests, { desc }) => [desc(requests.reapplyBlockedUntil)],
  });
  if (blocked?.reapplyBlockedUntil) {
    throw createError({
      statusCode: 429,
      statusMessage: `${blocked.reapplyBlockedUntil.toLocaleString('ko-KR')}부터 다시 신청할 수 있어요.`,
    });
  }
  if (await db.query.forums.findFirst({ where: eq(forums.slug, slug) })) {
    throw createError({
      statusCode: 409,
      statusMessage: 'That community address is already taken',
    });
  }
  const pending = await db.query.forumRequests.findFirst({
    where: (requests, { and, eq }) => and(eq(requests.slug, slug), eq(requests.status, 'pending')),
  });
  if (pending) {
    throw createError({
      statusCode: 409,
      statusMessage: 'That community address is awaiting review',
    });
  }
  const [request] = await db
    .insert(forumRequests)
    .values({ requesterUserId, name, slug, description })
    .returning({ id: forumRequests.id });
  if (!request)
    throw createError({ statusCode: 500, statusMessage: 'Unable to request community' });
  setResponseStatus(event, 202);
  return { id: request.id, name, slug, description, status: 'pending' };
});
