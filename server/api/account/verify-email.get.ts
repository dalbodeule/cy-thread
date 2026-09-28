import { and, eq, gt } from 'drizzle-orm';
import { users } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';

export default defineEventHandler(async (event) => {
  const token = getQuery(event).token;
  if (typeof token !== 'string' || !/^[0-9a-f-]{36}$/.test(token)) {
    throw createError({ statusCode: 404, statusMessage: 'Verification link not found' });
  }
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const recipient = await db.query.users.findFirst({
    where: and(
      eq(users.contactEmailVerifyToken, token),
      gt(users.contactEmailVerifyExpiresAt, new Date())
    ),
    columns: { id: true },
  });
  if (!recipient)
    throw createError({ statusCode: 404, statusMessage: 'Verification link not found' });
  setResponseHeader(event, 'Cache-Control', 'no-store');
  return { valid: true };
});
