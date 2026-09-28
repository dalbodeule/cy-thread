import { eq } from 'drizzle-orm';
import { users } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';

export default async function isGlobalAdmin(db: ReturnType<typeof useDrizzle>, userId: number) {
  if (!Number.isInteger(userId) || userId < 1) return false;
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  return Boolean(user?.isGlobalAdmin);
}
