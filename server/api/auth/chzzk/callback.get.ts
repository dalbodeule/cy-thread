import { and, eq } from 'drizzle-orm';
import { deleteCookie, getCookie, getQuery, sendRedirect } from 'h3';
import { oauthAccounts, users } from '~~/server/db/schema';
import getChzzkOAuthConfig from '~~/server/utils/getChzzkOAuthConfig';
import useDrizzle from '~~/server/utils/useDrizzle';

interface ChzzkResponse<T> {
  code?: number;
  message?: string | null;
  content?: T;
}
interface ChzzkToken {
  accessToken?: string;
}
interface ChzzkUser {
  channelId?: string;
  channelName?: string;
}
interface ChzzkChannel {
  channelId?: string;
  channelName?: string;
  channelImageUrl?: string;
}
interface ChzzkChannels {
  data?: ChzzkChannel[];
}

async function readChzzkResponse<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(`CHZZK returned HTTP ${response.status}`);
  const body = (await response.json()) as ChzzkResponse<T>;
  if (body.code !== 200 || !body.content)
    throw new Error(`CHZZK API returned ${body.code ?? 'an invalid response'}`);
  return body.content;
}

async function getChzzkChannel(channelId: string, clientId: string, clientSecret: string) {
  const url = new URL('https://openapi.chzzk.naver.com/open/v1/channels');
  url.searchParams.set('channelIds', channelId);
  const channels = await readChzzkResponse<ChzzkChannels>(
    await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(10_000),
      headers: {
        Accept: 'application/json',
        'User-Agent': 'CY-Thread OAuth client',
        'Client-Id': clientId,
        'Client-Secret': clientSecret,
      },
    })
  );
  return channels.data?.find((channel) => channel.channelId === channelId);
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const code = typeof query.code === 'string' ? query.code : '';
  const state = typeof query.state === 'string' ? query.state : '';
  const cookieState = getCookie(event, 'chzzk_oauth_state');
  deleteCookie(event, 'chzzk_oauth_state', { path: '/api/auth/chzzk' });
  if (!code || !state || !cookieState || state !== cookieState || code.length > 2048) {
    return sendRedirect(event, '/login?auth=error');
  }
  const { clientId, clientSecret } = getChzzkOAuthConfig(event);
  if (!clientId || !clientSecret) return sendRedirect(event, '/login?auth=error');

  try {
    const token = await readChzzkResponse<ChzzkToken>(
      await fetch('https://openapi.chzzk.naver.com/auth/v1/token', {
        method: 'POST',
        signal: AbortSignal.timeout(10_000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grantType: 'authorization_code',
          clientId,
          clientSecret,
          code,
          state,
        }),
      })
    );
    if (!token.accessToken) throw new Error('CHZZK did not return an access token');
    const profile = await readChzzkResponse<ChzzkUser>(
      await fetch('https://openapi.chzzk.naver.com/open/v1/users/me', {
        signal: AbortSignal.timeout(10_000),
        headers: { Authorization: `Bearer ${token.accessToken}`, Accept: 'application/json' },
      })
    );
    const channelId = profile.channelId?.trim();
    if (!channelId) throw new Error('CHZZK did not return a channel ID');
    let channel: ChzzkChannel | undefined;
    try {
      channel = await getChzzkChannel(channelId, clientId, clientSecret);
    } catch (error) {
      console.warn('CHZZK channel lookup failed', error);
    }
    const channelName = channel?.channelName?.trim() || profile.channelName?.trim() || 'CHZZK 멤버';
    const imageUrl = channel?.channelImageUrl?.trim();
    const avatarUrl = imageUrl && /^https:\/\//i.test(imageUrl) ? imageUrl : null;

    const db = useDrizzle(event.context.cloudflare.env.DB);
    const currentSession = await getUserSession(event);
    const currentUserId = Number(currentSession.user?.id);
    const linked = await db.query.oauthAccounts.findFirst({
      where: and(eq(oauthAccounts.provider, 'chzzk'), eq(oauthAccounts.providerUserId, channelId)),
    });
    if (
      linked &&
      Number.isInteger(currentUserId) &&
      currentUserId > 0 &&
      linked.userId !== currentUserId
    ) {
      throw new Error('CHZZK account is already linked to another user');
    }

    let userId = linked?.userId;
    if (!userId) {
      const canLinkCurrent = Number.isInteger(currentUserId) && currentUserId > 0;
      let createdUserId: number | undefined;
      if (canLinkCurrent) userId = currentUserId;
      else {
        const [created] = await db
          .insert(users)
          .values({ name: channelName, avatarUrl, providerAvatarUrl: avatarUrl })
          .returning({ id: users.id });
        if (!created) throw new Error('Unable to create CHZZK user');
        userId = created.id;
        createdUserId = created.id;
      }
      const [account] = await db
        .insert(oauthAccounts)
        .values({ userId, provider: 'chzzk', providerUserId: channelId })
        .onConflictDoNothing()
        .returning({ userId: oauthAccounts.userId });
      if (!account) {
        if (createdUserId) await db.delete(users).where(eq(users.id, createdUserId));
        const concurrent = await db.query.oauthAccounts.findFirst({
          where: and(
            eq(oauthAccounts.provider, 'chzzk'),
            eq(oauthAccounts.providerUserId, channelId)
          ),
        });
        if (!concurrent || (canLinkCurrent && concurrent.userId !== currentUserId)) {
          throw new Error('CHZZK account could not be linked');
        }
        userId = concurrent.userId;
      }
    }
    let user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) throw new Error('CHZZK user not found');
    if (avatarUrl && !user.providerAvatarUrl) {
      const [updated] = await db
        .update(users)
        .set({
          providerAvatarUrl: avatarUrl,
          ...(user.avatarSource === 'provider' && !user.avatarUrl ? { avatarUrl } : {}),
        })
        .where(eq(users.id, userId))
        .returning();
      if (updated) user = updated;
    }
    await setUserSession(event, {
      user: {
        id: user.id,
        name: user.name || channelName,
        email: user.email || user.contactEmail || '',
        avatarUrl: user.avatarUrl,
      },
    });
    return sendRedirect(event, user.email || user.contactEmail ? '/' : '/account/email');
  } catch (error) {
    console.error('CHZZK login failed', error);
    return sendRedirect(event, '/login?auth=error');
  }
});
