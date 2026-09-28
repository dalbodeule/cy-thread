import { desc, eq, sql } from 'drizzle-orm';
import { forums, mailCampaigns, mailOutbox } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';
import requireForumModerator from '~~/server/utils/requireForumModerator';

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug');
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const forum = await db.query.forums.findFirst({ where: eq(forums.slug, slug || '') });
  if (!forum) throw createError({ statusCode: 404, statusMessage: 'Forum not found' });
  const actor = await requireForumModerator(event, forum.id);
  if (!['global', 'owner', 'admin'].includes(actor.role))
    throw createError({ statusCode: 403, statusMessage: 'Forum admin access is required' });
  return db
    .select({
      id: mailCampaigns.id,
      subject: mailCampaigns.subject,
      audience: mailCampaigns.audience,
      status: mailCampaigns.status,
      queuedCount: mailCampaigns.queuedCount,
      createdAt: mailCampaigns.createdAt,
      sentCount: sql<number>`(select count(*) from ${mailOutbox} where ${mailOutbox.campaignId} = ${mailCampaigns.id} and ${mailOutbox.status} = 'sent')`,
      failedCount: sql<number>`(select count(*) from ${mailOutbox} where ${mailOutbox.campaignId} = ${mailCampaigns.id} and ${mailOutbox.status} = 'failed')`,
    })
    .from(mailCampaigns)
    .where(eq(mailCampaigns.forumId, forum.id))
    .orderBy(desc(mailCampaigns.id))
    .limit(30);
});
