import { eq } from 'drizzle-orm';
import type { H3Event } from 'h3';
import { users } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';

export default async function requireGlobalAdmin(event: H3Event) {
  const session = await requireUserSession(event);
  const userId = Number(session.user.id);
  if (!Number.isInteger(userId) || userId < 1) {
    throw createError({ statusCode: 401, statusMessage: 'Sign in is required' });
  }
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user?.isGlobalAdmin) {
    throw createError({ statusCode: 403, statusMessage: 'Global admin access is required' });
  }
  return { db, userId, user };
}
