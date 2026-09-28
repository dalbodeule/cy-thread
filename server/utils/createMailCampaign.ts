import type { H3Event } from 'h3';
import { eq } from 'drizzle-orm';
import { forums, mailCampaigns } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';
import requireForumModerator from '~~/server/utils/requireForumModerator';
import requireGlobalAdmin from '~~/server/utils/requireGlobalAdmin';

export default async function createMailCampaign(event: H3Event, forumSlug?: string) {
  const body = await readBody<{
    audience?: unknown;
    selectedIds?: unknown;
    subject?: unknown;
    body?: unknown;
    forumSlug?: unknown;
  }>(event);
  const audience = body?.audience;
  const subject = typeof body?.subject === 'string' ? body.subject.trim() : '';
  const content = typeof body?.body === 'string' ? body.body.trim() : '';
  const selectedIds = Array.isArray(body?.selectedIds)
    ? [...new Set(body.selectedIds.map(Number))]
    : [];
  if (
    !['all', 'forum', 'selected'].includes(String(audience)) ||
    subject.length < 3 ||
    subject.length > 150 ||
    content.length < 5 ||
    content.length > 10000 ||
    /\{\{[^{}]+\}\}/.test(content) ||
    (audience === 'selected' &&
      (!selectedIds.length ||
        selectedIds.length > 500 ||
        selectedIds.some((id) => !Number.isSafeInteger(id) || id < 1)))
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid recipients, subject, or message',
    });
  }

  const db = useDrizzle(event.context.cloudflare.env.DB);
  let forumId: number | null = null;
  let userId: number;
  if (forumSlug) {
    if (audience !== 'forum')
      throw createError({
        statusCode: 403,
        statusMessage: 'Forum managers can only email their Forum',
      });
    const forum = await db.query.forums.findFirst({ where: eq(forums.slug, forumSlug) });
    if (!forum) throw createError({ statusCode: 404, statusMessage: 'Forum not found' });
    const moderator = await requireForumModerator(event, forum.id);
    if (!['global', 'owner', 'admin'].includes(moderator.role))
      throw createError({ statusCode: 403, statusMessage: 'Forum admin access is required' });
    userId = moderator.userId;
    forumId = forum.id;
  } else {
    const admin = await requireGlobalAdmin(event);
    userId = admin.userId;
    if (audience === 'forum') {
      const slug = typeof body.forumSlug === 'string' ? body.forumSlug.trim() : '';
      const forum = await db.query.forums.findFirst({ where: eq(forums.slug, slug) });
      if (!forum) throw createError({ statusCode: 404, statusMessage: 'Forum not found' });
      forumId = forum.id;
    }
  }
  const [campaign] = await db
    .insert(mailCampaigns)
    .values({
      createdByUserId: userId,
      forumId,
      audience: String(audience),
      selectedIdsJson: audience === 'selected' ? JSON.stringify(selectedIds) : null,
      subject,
      body: content,
    })
    .returning({ id: mailCampaigns.id });
  if (!campaign)
    throw createError({ statusCode: 500, statusMessage: 'Could not create mail campaign' });
  setResponseStatus(event, 201);
  return { id: campaign.id, status: 'queued' };
}
