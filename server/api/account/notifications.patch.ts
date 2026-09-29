import { and, eq, isNull } from 'drizzle-orm';
import { notifications } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const userId = Number(session.user.id);
  const body = await readBody<{ id?: unknown; all?: unknown }>(event);
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const now = new Date();
  if (body?.all === true) {
    await db
      .update(notifications)
      .set({ readAt: now })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  } else {
    const id = Number(body?.id);
    if (!Number.isInteger(id) || id < 1)
      throw createError({ statusCode: 400, statusMessage: 'Notification id is required' });
    await db
      .update(notifications)
      .set({ readAt: now })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
  }
  return { ok: true };
});
