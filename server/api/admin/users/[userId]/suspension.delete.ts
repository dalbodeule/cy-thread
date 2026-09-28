import { and, eq, gt, isNull, or } from 'drizzle-orm';
import { userSuspensions } from '~~/server/db/schema';
import requireGlobalAdmin from '~~/server/utils/requireGlobalAdmin';

export default defineEventHandler(async (event) => {
  const targetId = Number(getRouterParam(event, 'userId'));
  if (!Number.isSafeInteger(targetId) || targetId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'Provide a valid user ID' });
  }
  const { db, userId: actorUserId } = await requireGlobalAdmin(event);
  const now = new Date();
  await db
    .update(userSuspensions)
    .set({ revokedAt: now, revokedByUserId: actorUserId })
    .where(
      and(
        eq(userSuspensions.userId, targetId),
        isNull(userSuspensions.revokedAt),
        or(isNull(userSuspensions.expiresAt), gt(userSuspensions.expiresAt, now))
      )
    );
  return { userId: targetId, suspended: false };
});
