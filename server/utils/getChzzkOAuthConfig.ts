import type { H3Event } from 'h3';

interface ChzzkOAuthConfig {
  clientId: string;
  clientSecret: string;
}

export default function getChzzkOAuthConfig(event: H3Event): ChzzkOAuthConfig {
  const oauth = useRuntimeConfig(event).oauth as { chzzk?: ChzzkOAuthConfig };
  return oauth.chzzk ?? { clientId: '', clientSecret: '' };
}
