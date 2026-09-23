import { eq } from 'drizzle-orm';
import { categories, forums } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';
import requireForumModerator from '~~/server/utils/requireForumModerator';

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug');
  const body = await readBody<{ name?: unknown; slug?: unknown }>(event);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const categorySlug = typeof body?.slug === 'string' ? body.slug.trim().toLowerCase() : '';
  if (
    !slug ||
    name.length < 2 ||
    name.length > 50 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(categorySlug) ||
    categorySlug.length > 50
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Enter a category name and lowercase URL slug',
    });
  }

  const db = useDrizzle(event.context.cloudflare.env.DB);
  const forum = await db.query.forums.findFirst({ where: eq(forums.slug, slug) });
  if (!forum) throw createError({ statusCode: 404, statusMessage: 'Community not found' });
  await requireForumModerator(event, forum.id);
  const [category] = await db
    .insert(categories)
    .values({
      forumId: forum.id,
      name,
      slug: categorySlug,
      sortOrder: 100,
    })
    .onConflictDoNothing()
    .returning({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      sortOrder: categories.sortOrder,
    });
  if (!category)
    throw createError({
      statusCode: 409,
      statusMessage: 'That category address is already in use',
    });
  setResponseStatus(event, 201);
  return category;
});
