import { eq } from 'drizzle-orm';
import { users } from '~~/server/db/schema';
import { gravatarUrl } from '~~/server/utils/gravatar';
import useDrizzle from '~~/server/utils/useDrizzle';

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const userId = Number(session.user.id);
  const body = await readBody<{ source?: unknown }>(event);
  const source = body?.source;
  if (!['provider', 'upload', 'gravatar'].includes(String(source))) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid avatar source' });
  }
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const account = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!account) throw createError({ statusCode: 404, statusMessage: 'Account not found' });
  let avatarUrl: string | null = null;
  if (source === 'provider') avatarUrl = account.providerAvatarUrl;
  if (source === 'upload') {
    if (!account.uploadedAvatarKey)
      throw createError({ statusCode: 400, statusMessage: 'Upload a photo first' });
    avatarUrl = `/api/account/avatar/${userId}?v=${encodeURIComponent(account.uploadedAvatarKey.split('/').at(-1) || '')}`;
  }
  if (source === 'gravatar') {
    const email = account.email || (account.contactEmailVerifiedAt ? account.contactEmail : null);
    if (!email)
      throw createError({
        statusCode: 400,
        statusMessage: 'A verified email is required for Gravatar',
      });
    avatarUrl = await gravatarUrl(email);
  }
  await db
    .update(users)
    .set({ avatarSource: String(source), avatarUrl })
    .where(eq(users.id, userId));
  await setUserSession(event, {
    user: {
      id: account.id,
      name: account.name || '멤버',
      email: account.email || account.contactEmail || '',
      avatarUrl,
    },
  });
  return { source, avatarUrl };
});
