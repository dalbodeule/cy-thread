import { eq } from 'drizzle-orm';
import { users } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const body = await readBody<{ token?: unknown; 'List-Unsubscribe'?: unknown }>(event);
  const oneClickToken = typeof query.token === 'string' ? query.token : '';
  const token = oneClickToken || (typeof body?.token === 'string' ? body.token : '');
  if (oneClickToken && body?.['List-Unsubscribe'] !== 'One-Click')
    throw createError({ statusCode: 400, statusMessage: 'Invalid unsubscribe request' });
  if (!/^[a-f0-9]{48}$/.test(token))
    throw createError({ statusCode: 400, statusMessage: 'Invalid unsubscribe link' });
  const db = useDrizzle(event.context.cloudflare.env.DB);
  await db
    .update(users)
    .set({ mailNotificationsEnabled: false })
    .where(eq(users.mailUnsubscribeToken, token));
  return { ok: true };
});
