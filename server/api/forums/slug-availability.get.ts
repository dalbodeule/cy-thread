import { and, eq } from 'drizzle-orm';
import { forumRequests, forums } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const slug = typeof query.slug === 'string' ? query.slug.trim().toLowerCase() : '';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 50) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid Forum address' });
  }
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const [forum, pending] = await Promise.all([
    db.query.forums.findFirst({ where: eq(forums.slug, slug), columns: { id: true } }),
    db.query.forumRequests.findFirst({
      where: and(eq(forumRequests.slug, slug), eq(forumRequests.status, 'pending')),
      columns: { id: true },
    }),
  ]);
  setResponseHeader(event, 'Cache-Control', 'no-store');
  return { slug, available: !forum && !pending };
});
