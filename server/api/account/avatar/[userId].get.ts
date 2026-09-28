import { eq } from 'drizzle-orm';
import { users } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';

export default defineEventHandler(async (event) => {
  const userId = Number(getRouterParam(event, 'userId'));
  if (!Number.isSafeInteger(userId) || userId < 1)
    throw createError({ statusCode: 400, statusMessage: 'Invalid user' });
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const account = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { uploadedAvatarKey: true },
  });
  if (!account?.uploadedAvatarKey)
    throw createError({ statusCode: 404, statusMessage: 'Avatar not found' });
  const image = await event.context.cloudflare.env.BLOB.get(account.uploadedAvatarKey);
  if (!image) throw createError({ statusCode: 404, statusMessage: 'Avatar not found' });
  return new Response(image.body, {
    headers: {
      'Content-Type': image.httpMetadata?.contentType || 'application/octet-stream',
      'Cache-Control': 'public, max-age=60',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});
