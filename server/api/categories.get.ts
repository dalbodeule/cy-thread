import { and, asc, eq, or, sql } from 'drizzle-orm';
import { categories, forums, threads } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';
import { setResponseHeader } from 'h3';

export default defineEventHandler(async (event) => {
  setResponseHeader(
    event,
    'Cache-Control',
    'public, max-age=30, s-maxage=60, stale-while-revalidate=300'
  );
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const query = String(getQuery(event).q ?? '')
    .trim()
    .slice(0, 80);
  const forumSlug = String(getQuery(event).forum ?? '')
    .trim()
    .slice(0, 50);
  const rawOffset = Number(getQuery(event).offset);
  const offset = Number.isFinite(rawOffset)
    ? Math.min(10_000, Math.max(0, Math.floor(rawOffset)))
    : 0;
  const filters = [eq(forums.visibility, 'public')];
  if (forumSlug) filters.push(eq(forums.slug, forumSlug));
  if (query) {
    const escape = String.fromCharCode(92);
    const pattern = `%${query
      .replaceAll(escape, escape + escape)
      .replaceAll('%', escape + '%')
      .replaceAll('_', escape + '_')}%`;
    filters.push(
      or(
        sql`${categories.name} LIKE ${pattern} ESCAPE ${escape}`,
        sql`${categories.slug} LIKE ${pattern} ESCAPE ${escape}`
      )!
    );
  }
  return db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      forumSlug: forums.slug,
      forumName: forums.name,
      threadCount: sql<number>`(select count(*) from ${threads} where ${threads.categoryId} = ${categories.id} and ${threads.isDeleted} = 0)`,
    })
    .from(categories)
    .innerJoin(forums, eq(categories.forumId, forums.id))
    .where(and(...filters))
    .orderBy(asc(forums.name), asc(categories.name))
    .limit(30)
    .offset(offset);
});
