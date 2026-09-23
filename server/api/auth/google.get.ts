import { and, eq } from 'drizzle-orm';
import { oauthAccounts, users } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';

export default defineOAuthGoogleEventHandler({
  async onSuccess(event, { user }) {
    if (!user.sub || !user.email || user.email_verified !== true) {
      throw createError({ statusCode: 403, statusMessage: 'A verified Google email is required' });
    }

    const db = useDrizzle(event.context.cloudflare.env.DB);
    const providerUserId = String(user.sub);
    const linkedAccount = await db.query.oauthAccounts.findFirst({
      where: and(
        eq(oauthAccounts.provider, 'google'),
        eq(oauthAccounts.providerUserId, providerUserId)
      ),
    });

    let accountUserId = linkedAccount?.userId;
    if (!accountUserId) {
      const [accountUser] = await db
        .insert(users)
        .values({
          email: user.email,
          name: user.name || user.email.split('@')[0] || '멤버',
          avatarUrl: user.picture || null,
        })
        .onConflictDoUpdate({
          target: users.email,
          set: {
            name: user.name || user.email.split('@')[0] || '멤버',
            avatarUrl: user.picture || null,
          },
        })
        .returning({ id: users.id });

      if (!accountUser)
        throw createError({ statusCode: 500, statusMessage: 'Unable to create account' });
      accountUserId = accountUser.id;

      const [createdAccount] = await db
        .insert(oauthAccounts)
        .values({
          userId: accountUserId,
          provider: 'google',
          providerUserId,
        })
        .onConflictDoNothing()
        .returning({ userId: oauthAccounts.userId });

      if (!createdAccount) {
        const concurrentAccount = await db.query.oauthAccounts.findFirst({
          where: and(
            eq(oauthAccounts.provider, 'google'),
            eq(oauthAccounts.providerUserId, providerUserId)
          ),
        });
        if (!concurrentAccount)
          throw createError({ statusCode: 500, statusMessage: 'Unable to link Google account' });
        accountUserId = concurrentAccount.userId;
      }
    }

    const accountUser = await db.query.users.findFirst({ where: eq(users.id, accountUserId) });
    if (!accountUser)
      throw createError({ statusCode: 500, statusMessage: 'Account profile not found' });

    await setUserSession(event, {
      user: {
        id: accountUser.id,
        name: accountUser.name || '멤버',
        email: accountUser.email || user.email,
        avatarUrl: accountUser.avatarUrl,
      },
    });

    return sendRedirect(event, '/');
  },
  onError(event) {
    return sendRedirect(event, '/?auth=error');
  },
});
