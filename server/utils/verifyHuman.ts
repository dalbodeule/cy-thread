import type { H3Event } from 'h3';

export default async function verifyHuman(event: H3Event, token: unknown) {
  const config = useRuntimeConfig(event);
  if (!config.turnstile.secretKey) {
    if (import.meta.dev) return;
    throw createError({ statusCode: 503, statusMessage: 'Spam protection is not configured' });
  }
  if (typeof token !== 'string' || !token) {
    throw createError({ statusCode: 400, statusMessage: 'Complete the spam check and try again' });
  }
  const result = await verifyTurnstileToken(token, event);
  if (!result.success)
    throw createError({ statusCode: 403, statusMessage: 'Spam check failed. Please try again' });
}
