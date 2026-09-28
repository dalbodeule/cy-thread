import { and, desc, eq, gt, isNull, or } from 'drizzle-orm';
import { userSuspensions } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event);
  const userId = Number(session.user?.id);
  if (!Number.isInteger(userId) || userId < 1) return { suspension: null };
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const suspension = await db.query.userSuspensions.findFirst({
    where: and(
      eq(userSuspensions.userId, userId),
      isNull(userSuspensions.revokedAt),
      or(isNull(userSuspensions.expiresAt), gt(userSuspensions.expiresAt, new Date()))
    ),
    orderBy: desc(userSuspensions.id),
  });
  return {
    suspension: suspension ? { reason: suspension.reason, expiresAt: suspension.expiresAt } : null,
  };
});
