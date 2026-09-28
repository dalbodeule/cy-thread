import { eq } from 'drizzle-orm';
import { forums } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';
import requireForumModerator from '~~/server/utils/requireForumModerator';
import {
  normalizeForumCss,
  readForumAppearance,
  updateForumSettingsJson,
} from '~~/server/utils/forumAppearance';

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug');
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Forum slug is required' });
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const forum = await db.query.forums.findFirst({ where: eq(forums.slug, slug) });
  if (!forum) throw createError({ statusCode: 404, statusMessage: 'Forum not found' });
  const actor = await requireForumModerator(event, forum.id);
  if (!['global', 'owner', 'admin'].includes(actor.role))
    throw createError({ statusCode: 403, statusMessage: 'Forum admin access is required' });

  const body = await readBody<Record<string, unknown>>(event);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const description = typeof body?.description === 'string' ? body.description.trim() : '';
  const iconText = typeof body?.iconText === 'string' ? body.iconText.trim() : '';
  const iconBackground = typeof body?.iconBackground === 'string' ? body.iconBackground : '';
  const iconColor = typeof body?.iconColor === 'string' ? body.iconColor : '';
  const cssInput = typeof body?.cssCustom === 'string' ? body.cssCustom : '';
  const allowDarkMode = body?.allowDarkMode;
  if (
    name.length < 2 ||
    name.length > 60 ||
    description.length > 240 ||
    !iconText ||
    [...iconText].length > 2 ||
    !/^#[0-9a-fA-F]{6}$/.test(iconBackground) ||
    !/^#[0-9a-fA-F]{6}$/.test(iconColor) ||
    typeof allowDarkMode !== 'boolean'
  ) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid Forum appearance settings' });
  }
  let cssCustom: string;
  try {
    cssCustom = normalizeForumCss(cssInput);
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: 'Use only the supported Forum color variables and six-digit hex colors',
    });
  }
  const settingsJson = updateForumSettingsJson(forum.settingsJson, {
    description,
    iconText,
    iconBackground,
    iconColor,
    allowDarkMode,
  });
  await db.update(forums).set({ name, settingsJson, cssCustom }).where(eq(forums.id, forum.id));
  return {
    name,
    slug,
    visibility: forum.visibility,
    ...readForumAppearance(settingsJson, cssCustom),
  };
});
