import { and, eq, isNull, or } from 'drizzle-orm';
import { attachments, forums, posts } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';
import { getForumViewer } from '~~/server/utils/forumAccess';
import { summarizeError } from '~~/server/utils/logError';

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
      forumId: forums.id,
      forumVisibility: forums.visibility,
      forumOwnerUserId: forums.ownerUserId,
    })
    .from(attachments)
    .innerJoin(forums, eq(attachments.forumId, forums.id))
    .leftJoin(posts, eq(attachments.postId, posts.id))
    .where(
      and(
        eq(forums.slug, slug),
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

  if (attachment.forumVisibility === 'private') {
    const viewer = await getForumViewer(event, attachment.forumId);
    if (
      !viewer ||
      (!viewer.isModerator && !viewer.isMember && attachment.forumOwnerUserId !== viewer.userId)
    ) {
      throw createError({ statusCode: 403, statusMessage: 'Forum membership is required' });
    }
  }

  const isPublished = attachment.postId !== null && attachment.forumVisibility === 'public';
  const cacheControl = isPublished ? 'public, max-age=60, s-maxage=60' : 'private, no-store';
  setResponseHeader(event, 'Content-Type', attachment.mime);
  setResponseHeader(event, 'Cache-Control', cacheControl);
  const cache = isPublished
    ? (globalThis.caches as (CacheStorage & { default: Cache }) | undefined)?.default
    : undefined;
  const cacheKey = new Request(getRequestURL(event).toString());
  const cached = await cache?.match(cacheKey).catch(() => undefined);
  if (cached) return cached;

  const image = await event.context.cloudflare.env.BLOB.get(attachment.r2Key);
  if (!image) throw createError({ statusCode: 404, statusMessage: 'Image file not found' });
  const response = new Response(image.body, {
    headers: {
      'Content-Type': attachment.mime,
      'Cache-Control': cacheControl,
      'X-Content-Type-Options': 'nosniff',
    },
  });
  if (cache) {
    event.waitUntil(
      cache.put(cacheKey, response.clone()).catch((error: unknown) => {
        console.warn({ event: 'published_image_cache_failed', ...summarizeError(error) });
      })
    );
  }
  return response;
});
