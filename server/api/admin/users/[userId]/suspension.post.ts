import { and, eq, isNull } from 'drizzle-orm';
import { mailOutbox, userSuspensions, users } from '~~/server/db/schema';
import requireGlobalAdmin from '~~/server/utils/requireGlobalAdmin';
import { recipientAddress, sanctionMail } from '~~/server/utils/mail';
import {
  calculateSuspensionExpiry,
  suspensionDurations,
  type SuspensionDuration,
} from '~~/server/utils/suspensionDuration';

export default defineEventHandler(async (event) => {
  const targetId = Number(getRouterParam(event, 'userId'));
  const body = await readBody<{ duration?: unknown; reason?: unknown }>(event);
  const duration = body?.duration;
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
  if (
    !Number.isSafeInteger(targetId) ||
    targetId < 1 ||
    !suspensionDurations.includes(duration as SuspensionDuration) ||
    reason.length < 2 ||
    reason.length > 500
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Provide a duration and reason (2–500 characters)',
    });
  }

  const { db, userId: actorUserId } = await requireGlobalAdmin(event);
  if (targetId === actorUserId) {
    throw createError({ statusCode: 403, statusMessage: 'You cannot suspend your own account' });
  }
  const target = await db.query.users.findFirst({ where: eq(users.id, targetId) });
  if (!target) throw createError({ statusCode: 404, statusMessage: 'User not found' });
  if (target.isGlobalAdmin) {
    throw createError({ statusCode: 403, statusMessage: 'Global admins cannot be suspended' });
  }

  const now = new Date();
  const expiresAt = calculateSuspensionExpiry(now, duration as SuspensionDuration);
  const revoke = db
    .update(userSuspensions)
    .set({ revokedAt: now, revokedByUserId: actorUserId })
    .where(and(eq(userSuspensions.userId, targetId), isNull(userSuspensions.revokedAt)));
  const insert = db.insert(userSuspensions).values({
    userId: targetId,
    actorUserId,
    reason,
    duration: duration as SuspensionDuration,
    createdAt: now,
    expiresAt,
  });
  const email = recipientAddress(target);
  if (email) {
    await db.batch([
      revoke,
      insert,
      db
        .insert(mailOutbox)
        .values(
          sanctionMail(targetId, email, '전체 사이트', duration as string, reason, expiresAt)
        ),
    ]);
  } else {
    await db.batch([revoke, insert]);
  }
  return {
    userId: targetId,
    duration,
    reason,
    expiresAt: expiresAt?.toISOString() ?? null,
    notificationQueued: Boolean(email),
  };
});
