import { and, eq, isNull, or } from 'drizzle-orm';
import { attachments, forums, posts } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug');
  const attachmentId = Number(getRouterParam(event, 'attachmentId'));
  if (!slug || !Number.isInteger(attachmentId) || attachmentId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid attachment' });
  }

  const db = useDrizzle(event.context.cloudflare.env.DB);
  const session = await getUserSession(event);
  const viewerId = Number(session.user?.id);
  const currentUserId = Number.isInteger(viewerId) && viewerId > 0 ? viewerId : -1;
  const [attachment] = await db
    .select({
      r2Key: attachments.r2Key,
      mime: attachments.mime,
      authorUserId: attachments.authorUserId,
      postId: attachments.postId,
    })
    .from(attachments)
    .innerJoin(forums, eq(attachments.forumId, forums.id))
    .leftJoin(posts, eq(attachments.postId, posts.id))
    .where(
      and(
        eq(forums.slug, slug),
        eq(forums.visibility, 'public'),
        eq(attachments.id, attachmentId),
        isNull(attachments.deletedAt),
        or(
          eq(posts.isDeleted, false),
          and(isNull(attachments.postId), eq(attachments.authorUserId, currentUserId))
        )
      )
    )
    .limit(1);
  if (!attachment) throw createError({ statusCode: 404, statusMessage: 'Image not found' });

  const image = await event.context.cloudflare.env.BLOB.get(attachment.r2Key);
  if (!image) throw createError({ statusCode: 404, statusMessage: 'Image file not found' });
  setResponseHeader(event, 'Content-Type', attachment.mime);
  setResponseHeader(
    event,
    'Cache-Control',
    attachment.postId === null ? 'private, no-store' : 'public, max-age=31536000, immutable'
  );
  setResponseHeader(event, 'X-Content-Type-Options', 'nosniff');
  return new Response(image.body);
});
