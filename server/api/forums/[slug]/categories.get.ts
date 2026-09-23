import { asc, eq, sql } from 'drizzle-orm';
import { categories, forums, threads } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';

export default defineEventHandler(async (event) => {
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const slug = getRouterParam(event, 'slug');
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Forum slug is required' });

  const forum = await db.query.forums.findFirst({ where: eq(forums.slug, slug) });
  if (!forum || forum.visibility !== 'public') {
    throw createError({ statusCode: 404, statusMessage: 'Community not found' });
  }

  return db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      sortOrder: categories.sortOrder,
      threadCount: sql<number>`coalesce(sum(case when ${threads.isDeleted} = 0 then 1 else 0 end), 0)`,
      deletedThreadCount: sql<number>`coalesce(sum(case when ${threads.isDeleted} = 1 then 1 else 0 end), 0)`,
    })
    .from(categories)
    .leftJoin(threads, eq(threads.categoryId, categories.id))
    .where(eq(categories.forumId, forum.id))
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder), asc(categories.name));
});
