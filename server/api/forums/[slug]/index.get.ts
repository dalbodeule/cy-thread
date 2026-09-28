import { eq } from 'drizzle-orm';
import { forums } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';
import { readForumAppearance } from '~~/server/utils/forumAppearance';
import requireForumModerator from '~~/server/utils/requireForumModerator';

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug');
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Forum slug is required' });
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const forum = await db.query.forums.findFirst({ where: eq(forums.slug, slug) });
  if (!forum) {
    throw createError({ statusCode: 404, statusMessage: 'Community not found' });
  }
  if (forum.visibility !== 'public') await requireForumModerator(event, forum.id);
  return {
    id: forum.id,
    slug: forum.slug,
    name: forum.name,
    ...readForumAppearance(forum.settingsJson, forum.cssCustom),
  };
});
