import { eq } from 'drizzle-orm';
import { users } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';

export default defineEventHandler(async (event) => {
  const body = await readBody<{ token?: unknown }>(event);
  const token = typeof body?.token === 'string' ? body.token : '';
  if (!/^[a-f0-9]{48}$/.test(token))
    throw createError({ statusCode: 400, statusMessage: 'Invalid unsubscribe link' });
  const db = useDrizzle(event.context.cloudflare.env.DB);
  await db
    .update(users)
    .set({ mailNotificationsEnabled: false })
    .where(eq(users.mailUnsubscribeToken, token));
  return { ok: true };
});
