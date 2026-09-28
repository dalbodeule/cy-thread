import { eq } from 'drizzle-orm';
import { users } from '~~/server/db/schema';
import { gravatarUrl } from '~~/server/utils/gravatar';
import useDrizzle from '~~/server/utils/useDrizzle';

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const userId = Number(session.user.id);
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const account = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!account) throw createError({ statusCode: 404, statusMessage: 'Account not found' });
  const verifiedEmail =
    account.email || (account.contactEmailVerifiedAt ? account.contactEmail : null);
  return {
    source: account.avatarSource,
    currentUrl: account.avatarUrl,
    providerUrl: account.providerAvatarUrl,
    uploadedUrl: account.uploadedAvatarKey
      ? `/api/account/avatar/${account.id}?v=${encodeURIComponent(account.uploadedAvatarKey.split('/').at(-1) || '')}`
      : null,
    gravatarUrl: verifiedEmail ? await gravatarUrl(verifiedEmail) : null,
  };
});
