import { getRequestURL, sendRedirect, setCookie } from 'h3';
import getChzzkOAuthConfig from '~~/server/utils/getChzzkOAuthConfig';

export default defineEventHandler((event) => {
  const { clientId, clientSecret } = getChzzkOAuthConfig(event);
  if (!clientId || !clientSecret) {
    throw createError({ statusCode: 503, statusMessage: 'CHZZK login is not configured' });
  }
  const requestUrl = getRequestURL(event);
  const redirectUri = `${requestUrl.origin}/api/auth/chzzk/callback`;
  const state = crypto.randomUUID().replaceAll('-', '');
  setCookie(event, 'chzzk_oauth_state', state, {
    httpOnly: true,
    secure: requestUrl.protocol === 'https:',
    sameSite: 'lax',
    path: '/api/auth/chzzk',
    maxAge: 600,
  });
  const destination = new URL('https://chzzk.naver.com/account-interlock');
  destination.searchParams.set('clientId', clientId);
  destination.searchParams.set('redirectUri', redirectUri);
  destination.searchParams.set('state', state);
  return sendRedirect(event, destination.toString());
});
