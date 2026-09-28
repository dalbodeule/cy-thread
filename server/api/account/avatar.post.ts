import { eq } from 'drizzle-orm';
import { users } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';

const maxSize = 2 * 1024 * 1024;
const formats: Record<string, { extension: string; valid: (data: Uint8Array) => boolean }> = {
  'image/jpeg': {
    extension: 'jpg',
    valid: (data) => data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff,
  },
  'image/png': {
    extension: 'png',
    valid: (data) => data.subarray(0, 8).join(',') === '137,80,78,71,13,10,26,10',
  },
  'image/webp': {
    extension: 'webp',
    valid: (data) =>
      String.fromCharCode(...data.subarray(0, 4)) === 'RIFF' &&
      String.fromCharCode(...data.subarray(8, 12)) === 'WEBP',
  },
};

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const userId = Number(session.user.id);
  const form = await readMultipartFormData(event);
  const file = form?.find((part) => part.name === 'file' && part.filename);
  const format = file?.type ? formats[file.type] : undefined;
  if (!file?.data?.length || !format || !format.valid(file.data)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'JPG, PNG 또는 WebP 사진을 선택해 주세요.',
    });
  }
  if (file.data.length > maxSize) {
    throw createError({ statusCode: 413, statusMessage: '사진은 2 MB 이하여야 합니다.' });
  }
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const account = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!account) throw createError({ statusCode: 404, statusMessage: 'Account not found' });
  const key = `avatars/${userId}/${crypto.randomUUID()}.${format.extension}`;
  const avatarUrl = `/api/account/avatar/${userId}?v=${encodeURIComponent(key.split('/').at(-1) || '')}`;
  const bucket = event.context.cloudflare.env.BLOB;
  await bucket.put(key, file.data, {
    httpMetadata: { contentType: file.type, cacheControl: 'public, max-age=31536000, immutable' },
  });
  try {
    await db
      .update(users)
      .set({ uploadedAvatarKey: key, avatarSource: 'upload', avatarUrl })
      .where(eq(users.id, userId));
    await setUserSession(event, {
      user: {
        id: account.id,
        name: account.name || '멤버',
        email: account.email || account.contactEmail || '',
        avatarUrl,
      },
    });
  } catch (error) {
    await bucket.delete(key);
    throw error;
  }
  if (account.uploadedAvatarKey && account.uploadedAvatarKey !== key) {
    event.waitUntil(
      bucket
        .delete(account.uploadedAvatarKey)
        .catch((error: unknown) => console.warn('Old avatar cleanup failed', error))
    );
  }
  setResponseStatus(event, 201);
  return { avatarUrl, source: 'upload' };
});
