import { asc, eq, sql } from 'drizzle-orm';
import { categories, featuredCategories, forums, threads } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';
import { setResponseHeader } from 'h3';

export default defineEventHandler(async (event) => {
  setResponseHeader(
    event,
    'Cache-Control',
    'public, max-age=30, s-maxage=60, stale-while-revalidate=300'
  );
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const selected = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      forumSlug: forums.slug,
      forumName: forums.name,
      activityCount: featuredCategories.activityCount,
      refreshedAt: featuredCategories.refreshedAt,
      threadCount: sql<number>`(select count(*) from ${threads} where ${threads.categoryId} = ${categories.id} and ${threads.isDeleted} = 0)`,
    })
    .from(featuredCategories)
    .innerJoin(categories, eq(featuredCategories.categoryId, categories.id))
    .innerJoin(forums, eq(categories.forumId, forums.id))
    .where(eq(forums.visibility, 'public'))
    .orderBy(asc(featuredCategories.rank))
    .limit(8);
  if (selected.length) return selected;
  return db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      forumSlug: forums.slug,
      forumName: forums.name,
      activityCount: sql<number>`0`,
      refreshedAt: sql<number>`0`,
      threadCount: sql<number>`(select count(*) from ${threads} where ${threads.categoryId} = ${categories.id} and ${threads.isDeleted} = 0)`,
    })
    .from(categories)
    .innerJoin(forums, eq(categories.forumId, forums.id))
    .where(eq(forums.visibility, 'public'))
    .orderBy(asc(categories.id))
    .limit(8);
});
