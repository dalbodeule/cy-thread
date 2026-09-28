import { eq } from 'drizzle-orm';
import { forumRequests, forums } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const requesterUserId = Number(session.user.id);
  if (!Number.isInteger(requesterUserId) || requesterUserId < 1) {
    throw createError({ statusCode: 401, statusMessage: 'Sign in is required' });
  }
  const body = await readBody<{ name?: unknown; slug?: unknown }>(event);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const slug = typeof body?.slug === 'string' ? body.slug.trim().toLowerCase() : '';
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
  const db = useDrizzle(event.context.cloudflare.env.DB);
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
    .values({ requesterUserId, name, slug })
    .returning({ id: forumRequests.id });
  if (!request)
    throw createError({ statusCode: 500, statusMessage: 'Unable to request community' });
  setResponseStatus(event, 202);
  return { id: request.id, name, slug, status: 'pending' };
});
