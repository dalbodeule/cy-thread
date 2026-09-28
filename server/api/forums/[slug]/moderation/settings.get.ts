import { eq } from 'drizzle-orm';
import { forums } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';
import requireForumModerator from '~~/server/utils/requireForumModerator';
import { readForumAppearance } from '~~/server/utils/forumAppearance';

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug');
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Forum slug is required' });
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const forum = await db.query.forums.findFirst({ where: eq(forums.slug, slug) });
  if (!forum) throw createError({ statusCode: 404, statusMessage: 'Forum not found' });
  const actor = await requireForumModerator(event, forum.id);
  if (!['global', 'owner', 'admin'].includes(actor.role))
    throw createError({ statusCode: 403, statusMessage: 'Forum admin access is required' });
  return {
    name: forum.name,
    slug: forum.slug,
    visibility: forum.visibility,
    ...readForumAppearance(forum.settingsJson, forum.cssCustom),
  };
});
