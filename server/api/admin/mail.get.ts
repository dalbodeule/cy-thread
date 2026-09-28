import { eq, desc, sql } from 'drizzle-orm';
import { mailCampaigns, mailOutbox } from '~~/server/db/schema';
import requireGlobalAdmin from '~~/server/utils/requireGlobalAdmin';

export default defineEventHandler(async (event) => {
  const { db } = await requireGlobalAdmin(event);
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
    .orderBy(desc(mailCampaigns.id))
    .limit(30);
});
