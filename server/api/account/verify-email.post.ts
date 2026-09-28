import { and, eq, gt } from 'drizzle-orm';
import { users } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';

export default defineEventHandler(async (event) => {
  const body = await readBody<{ token?: unknown }>(event);
  const token = typeof body?.token === 'string' ? body.token : '';
  if (!/^[0-9a-f-]{36}$/.test(token))
    throw createError({ statusCode: 400, statusMessage: 'Invalid verification link' });
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const result = await db
    .update(users)
    .set({
      contactEmailVerifiedAt: new Date(),
      contactEmailVerifyToken: null,
      contactEmailVerifyExpiresAt: null,
    })
    .where(
      and(
        eq(users.contactEmailVerifyToken, token),
        gt(users.contactEmailVerifyExpiresAt, new Date())
      )
    )
    .returning({ id: users.id });
  if (!result.length)
    throw createError({
      statusCode: 400,
      statusMessage: 'Verification link expired or already used',
    });
  return { verified: true };
});
