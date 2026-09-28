import { eq } from 'drizzle-orm';
import { users } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event);
  const userId = Number(session.user?.id);
  if (!Number.isInteger(userId) || userId < 1) return { isGlobalAdmin: false };
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  return { isGlobalAdmin: Boolean(user?.isGlobalAdmin) };
});
