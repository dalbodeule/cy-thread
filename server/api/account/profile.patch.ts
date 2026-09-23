import { eq } from 'drizzle-orm';
import { users } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const userId = Number(session.user.id);
  const body = await readBody<{ name?: unknown }>(event);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!Number.isInteger(userId) || userId < 1) {
    throw createError({ statusCode: 401, statusMessage: 'Sign in is required' });
  }
  if (name.length < 2 || name.length > 40 || /[\u0000-\u001f<>]/.test(name)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Display name must be 2 to 40 characters',
    });
  }

  const db = useDrizzle(event.context.cloudflare.env.DB);
  const [user] = await db
    .update(users)
    .set({ name })
    .where(eq(users.id, userId))
    .returning({ id: users.id, name: users.name, email: users.email, avatarUrl: users.avatarUrl });
  if (!user) throw createError({ statusCode: 404, statusMessage: 'Account not found' });

  await setUserSession(event, {
    user: {
      id: user.id,
      name: user.name || name,
      email: user.email || session.user.email,
      avatarUrl: user.avatarUrl,
    },
  });
  return { name: user.name };
});
