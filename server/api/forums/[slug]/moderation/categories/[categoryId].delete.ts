import { and, eq } from 'drizzle-orm';
import { categories, forums, threads } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';
import requireForumModerator from '~~/server/utils/requireForumModerator';

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug');
  const categoryId = Number(getRouterParam(event, 'categoryId'));
  if (!slug || !Number.isInteger(categoryId) || categoryId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid community or category' });
  }
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const forum = await db.query.forums.findFirst({ where: eq(forums.slug, slug) });
  if (!forum) throw createError({ statusCode: 404, statusMessage: 'Community not found' });
  await requireForumModerator(event, forum.id);
  const category = await db.query.categories.findFirst({
    where: and(eq(categories.id, categoryId), eq(categories.forumId, forum.id)),
  });
  if (!category) throw createError({ statusCode: 404, statusMessage: 'Category not found' });
  const [thread] = await db
    .select({ id: threads.id })
    .from(threads)
    .where(eq(threads.categoryId, categoryId))
    .limit(1);
  if (thread)
    throw createError({
      statusCode: 409,
      statusMessage: "Move or remove this category's threads before deleting it",
    });

  await db.delete(categories).where(eq(categories.id, categoryId));
  return { id: categoryId, deleted: true };
});
