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
  const rules = typeof body?.rules === 'string' ? body.rules.trim() : '';
  const welcomeMessage = typeof body?.welcomeMessage === 'string' ? body.welcomeMessage.trim() : '';
  const visibility =
    body?.visibility === 'private' ? 'private' : body?.visibility === 'public' ? 'public' : '';
  const commentAccess =
    body?.commentAccess === 'guest' ||
    body?.commentAccess === 'members' ||
    body?.commentAccess === 'forum_members'
      ? body.commentAccess
      : '';
  const membershipQuestions = Array.isArray(body?.membershipQuestions)
    ? body.membershipQuestions.filter((item): item is string => typeof item === 'string')
    : [];
  const moderationKeywords = Array.isArray(body?.moderationKeywords)
    ? body.moderationKeywords.filter((item): item is string => typeof item === 'string')
    : [];
  const resourceLinks = Array.isArray(body?.resourceLinks)
    ? body.resourceLinks.filter((item): item is { title: string; url: string } =>
        Boolean(
          item &&
          typeof item === 'object' &&
          typeof item.title === 'string' &&
          typeof item.url === 'string'
        )
      )
    : [];
  if (
    name.length < 2 ||
    name.length > 60 ||
    description.length > 240 ||
    !iconText ||
    [...iconText].length > 2 ||
    !/^#[0-9a-fA-F]{6}$/.test(iconBackground) ||
    !/^#[0-9a-fA-F]{6}$/.test(iconColor) ||
    typeof allowDarkMode !== 'boolean' ||
    rules.length > 5000 ||
    welcomeMessage.length > 1000 ||
    !visibility ||
    !commentAccess ||
    membershipQuestions.length > 5 ||
    membershipQuestions.some((item) => item.trim().length < 3 || item.trim().length > 240) ||
    moderationKeywords.length > 50 ||
    moderationKeywords.some((item) => item.trim().length < 2 || item.trim().length > 80) ||
    resourceLinks.length > 10 ||
    resourceLinks.some(
      (item) =>
        item.title.trim().length < 1 ||
        item.title.trim().length > 80 ||
        !/^https?:\/\//i.test(item.url.trim()) ||
        item.url.trim().length > 500
    )
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
    rules,
    welcomeMessage,
    commentAccess,
    membershipQuestions: membershipQuestions.map((item) => item.trim()),
    moderationKeywords: moderationKeywords.map((item) => item.trim().toLowerCase()),
    resourceLinks: resourceLinks.map((item) => ({
      title: item.title.trim(),
      url: item.url.trim(),
    })),
  });
  await db
    .update(forums)
    .set({ name, visibility, settingsJson, cssCustom })
    .where(eq(forums.id, forum.id));
  return {
    name,
    slug,
    visibility,
    ...readForumAppearance(settingsJson, cssCustom),
  };
});
