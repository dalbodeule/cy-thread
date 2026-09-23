import { and, eq } from 'drizzle-orm';
import { categories, forums } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';
import requireForumModerator from '~~/server/utils/requireForumModerator';

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug');
  const categoryId = Number(getRouterParam(event, 'categoryId'));
  const body = await readBody<{ name?: unknown; slug?: unknown; sortOrder?: unknown }>(event);
  if (!slug || !Number.isInteger(categoryId) || categoryId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid community or category' });
  }
  const updates: { name?: string; slug?: string; sortOrder?: number } = {};
  if (
    typeof body?.name === 'string' &&
    body.name.trim().length >= 2 &&
    body.name.trim().length <= 50
  )
    updates.name = body.name.trim();
  if (
    typeof body?.slug === 'string' &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.slug.trim().toLowerCase())
  )
    updates.slug = body.slug.trim().toLowerCase();
  if (
    typeof body?.sortOrder === 'number' &&
    Number.isInteger(body.sortOrder) &&
    body.sortOrder >= 0 &&
    body.sortOrder <= 1000
  )
    updates.sortOrder = body.sortOrder;
  if (!Object.keys(updates).length)
    throw createError({
      statusCode: 400,
      statusMessage: 'Provide a valid category name, slug, or sort order',
    });

  const db = useDrizzle(event.context.cloudflare.env.DB);
  const forum = await db.query.forums.findFirst({ where: eq(forums.slug, slug) });
  if (!forum) throw createError({ statusCode: 404, statusMessage: 'Community not found' });
  await requireForumModerator(event, forum.id);
  if (updates.slug) {
    const duplicate = await db.query.categories.findFirst({
      where: and(eq(categories.forumId, forum.id), eq(categories.slug, updates.slug)),
    });
    if (duplicate && duplicate.id !== categoryId) {
      throw createError({
        statusCode: 409,
        statusMessage: 'That category address is already in use',
      });
    }
  }
  const [category] = await db
    .update(categories)
    .set(updates)
    .where(and(eq(categories.id, categoryId), eq(categories.forumId, forum.id)))
    .returning({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      sortOrder: categories.sortOrder,
    });
  if (!category) throw createError({ statusCode: 404, statusMessage: 'Category not found' });
  return category;
});
