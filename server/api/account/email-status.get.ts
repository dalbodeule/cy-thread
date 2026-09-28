import { eq } from 'drizzle-orm';
import { users } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const userId = Number(session.user.id);
  if (!Number.isSafeInteger(userId) || userId < 1) throw createError({ statusCode: 401 });
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const account = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!account) throw createError({ statusCode: 404 });
  return {
    identityEmail: account.email,
    contactEmail: account.contactEmail,
    contactEmailVerified: Boolean(account.contactEmailVerifiedAt),
  };
});
