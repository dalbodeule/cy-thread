import { and, eq, isNull, lt } from 'drizzle-orm';
import { attachments, forums } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';
import requireForumModerator from '~~/server/utils/requireForumModerator';

const abandonedAfterMs = 24 * 60 * 60 * 1000;

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug');
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Forum slug is required' });

  const db = useDrizzle(event.context.cloudflare.env.DB);
  const forum = await db.query.forums.findFirst({ where: eq(forums.slug, slug) });
  if (!forum) throw createError({ statusCode: 404, statusMessage: 'Community not found' });
  await requireForumModerator(event, forum.id);

  const cutoff = new Date(Date.now() - abandonedAfterMs);
  const abandoned = await db
    .select({ id: attachments.id, r2Key: attachments.r2Key })
    .from(attachments)
    .where(
      and(
        eq(attachments.forumId, forum.id),
        isNull(attachments.postId),
        isNull(attachments.deletedAt),
        lt(attachments.createdAt, cutoff)
      )
    );

  let removed = 0;
  for (const attachment of abandoned) {
    try {
      await event.context.cloudflare.env.BLOB.delete(attachment.r2Key);
      await db.delete(attachments).where(eq(attachments.id, attachment.id));
      removed += 1;
    } catch (error) {
      console.error('Failed to remove abandoned community attachment', {
        attachmentId: attachment.id,
        error,
      });
    }
  }

  return { removed, failed: abandoned.length - removed };
});
