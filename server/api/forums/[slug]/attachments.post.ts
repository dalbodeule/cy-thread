import { and, eq } from 'drizzle-orm';
import { attachments, forumBans, forums } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';
import verifyHuman from '~~/server/utils/verifyHuman';

const maxImageSize = 5 * 1024 * 1024;
const signatures: Record<string, (data: Uint8Array) => boolean> = {
  'image/jpeg': (data) => data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff,
  'image/png': (data) => data.subarray(0, 8).join(',') === '137,80,78,71,13,10,26,10',
  'image/gif': (data) => String.fromCharCode(...data.subarray(0, 6)).startsWith('GIF8'),
  'image/webp': (data) =>
    String.fromCharCode(...data.subarray(0, 4)) === 'RIFF' &&
    String.fromCharCode(...data.subarray(8, 12)) === 'WEBP',
};
const extensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const authorUserId = Number(session.user.id);
  if (!Number.isInteger(authorUserId) || authorUserId < 1) {
    throw createError({ statusCode: 401, statusMessage: 'Sign in is required' });
  }

  const slug = getRouterParam(event, 'slug');
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Forum slug is required' });
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const forum = await db.query.forums.findFirst({ where: eq(forums.slug, slug) });
  if (!forum || forum.visibility !== 'public') {
    throw createError({ statusCode: 404, statusMessage: 'Community not found' });
  }
  const ban = await db.query.forumBans.findFirst({
    where: and(eq(forumBans.forumId, forum.id), eq(forumBans.userId, authorUserId)),
  });
  if (ban)
    throw createError({ statusCode: 403, statusMessage: 'You cannot upload to this community' });

  const form = await readMultipartFormData(event);
  const file = form?.find((part) => part.name === 'file' && part.filename);
  const mime = file?.type;
  const signatureMatches = mime ? signatures[mime] : undefined;
  const extension = mime ? extensions[mime] : undefined;
  if (!file?.data?.length || !mime || !signatureMatches || !extension) {
    throw createError({ statusCode: 400, statusMessage: 'Upload a JPG, PNG, GIF, or WebP image' });
  }
  if (file.data.length > maxImageSize) {
    throw createError({ statusCode: 413, statusMessage: 'Images must be 5 MB or smaller' });
  }
  if (!signatureMatches(file.data)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Image contents do not match the file type',
    });
  }
  const turnstileToken = form
    ?.find((part) => part.name === 'turnstileToken')
    ?.data?.toString('utf8');
  await verifyHuman(event, turnstileToken);

  const key = `forums/${forum.id}/uploads/${crypto.randomUUID()}.${extension}`;
  const bucket = event.context.cloudflare.env.BLOB;
  await bucket.put(key, file.data, {
    httpMetadata: { contentType: mime, cacheControl: 'public, max-age=31536000, immutable' },
  });
  try {
    const [attachment] = await db
      .insert(attachments)
      .values({
        forumId: forum.id,
        authorUserId,
        r2Key: key,
        mime,
        size: file.data.length,
      })
      .returning({ id: attachments.id });
    if (!attachment) throw new Error('Attachment row was not created');
    setResponseStatus(event, 201);
    return {
      id: attachment.id,
      url: `/api/forums/${encodeURIComponent(slug)}/attachments/${attachment.id}`,
    };
  } catch (error) {
    await bucket.delete(key);
    throw error;
  }
});
