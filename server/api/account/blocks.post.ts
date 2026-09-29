import { and, eq } from 'drizzle-orm';
import { userBlocks, users } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const blockerUserId = Number(session.user.id);
  const body = await readBody<{ userId?: unknown; blocked?: unknown }>(event);
  const blockedUserId = Number(body?.userId);
  if (!Number.isInteger(blockedUserId) || blockedUserId < 1 || blockedUserId === blockerUserId) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid user' });
  }
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const target = await db.query.users.findFirst({ where: eq(users.id, blockedUserId) });
  if (!target) throw createError({ statusCode: 404, statusMessage: 'User not found' });
  if (body?.blocked === false) {
    await db
      .delete(userBlocks)
      .where(
        and(
          eq(userBlocks.blockerUserId, blockerUserId),
          eq(userBlocks.blockedUserId, blockedUserId)
        )
      );
  } else {
    await db.insert(userBlocks).values({ blockerUserId, blockedUserId }).onConflictDoNothing();
  }
  return { blocked: body?.blocked !== false };
});
