import { getMethod, getRequestHeader, getRequestURL, setResponseHeader } from 'h3';

const mutatingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const maxApiBodyBytes = 1024 * 1024;
const maxUploadBodyBytes = 5 * 1024 * 1024 + 64 * 1024;
const limiterFor = (method: string, path: string) => {
  if (method === 'GET') return 'READ_LIMITER';
  if (method === 'POST' && path === '/api/forums') return 'COMMUNITY_CREATE_LIMITER';
  if (path.endsWith('/moderation/attachments/cleanup')) return 'UPLOAD_CLEANUP_LIMITER';
  if (path.endsWith('/attachments')) return 'UPLOAD_LIMITER';
  if (path.endsWith('/report')) return 'REPORT_LIMITER';
  if (
    (method === 'POST' && /^\/api\/forums\/[^/]+\/threads(?:\/\d+\/posts)?$/.test(path)) ||
    (method === 'PATCH' && /\/threads\/\d+(?:\/posts\/\d+)?$/.test(path))
  ) {
    return 'CONTENT_WRITE_LIMITER';
  }
  if (path.includes('/moderation/')) return 'MODERATION_LIMITER';
  return 'GENERAL_WRITE_LIMITER';
};

type RateLimitBinding = {
  limit: (options: { key: string }) => Promise<{ success: boolean }>;
};

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname;
  if (path.startsWith('/api/')) {
    setResponseHeader(event, 'Cache-Control', 'no-store');
  }

  setResponseHeader(event, 'X-Content-Type-Options', 'nosniff');
  setResponseHeader(event, 'X-Frame-Options', 'DENY');
  setResponseHeader(event, 'Referrer-Policy', 'strict-origin-when-cross-origin');
  setResponseHeader(event, 'Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  setResponseHeader(event, 'Content-Security-Policy', "frame-ancestors 'none'");

  const method = getMethod(event);
  const isMutation = path.startsWith('/api/') && mutatingMethods.has(method);
  const isPublicThreadRead =
    method === 'GET' && /^\/api\/forums\/[^/]+\/threads(?:\/\d+)?$/.test(path);
  if (!isMutation && !isPublicThreadRead) return;

  if (isMutation) {
    const contentLength = Number(getRequestHeader(event, 'content-length'));
    const maxBodyBytes =
      path.endsWith('/attachments') && method === 'POST' ? maxUploadBodyBytes : maxApiBodyBytes;
    if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
      throw createError({ statusCode: 413, statusMessage: 'Request body is too large' });
    }

    const origin = getRequestHeader(event, 'origin');
    if (!origin) {
      throw createError({ statusCode: 403, statusMessage: 'Request origin is required' });
    }

    let requestOrigin: string;
    try {
      requestOrigin = new URL(origin).origin;
    } catch {
      throw createError({ statusCode: 403, statusMessage: 'Invalid request origin' });
    }

    if (requestOrigin !== getRequestURL(event).origin) {
      throw createError({ statusCode: 403, statusMessage: 'Cross-origin request is not allowed' });
    }
  }

  const session = await getUserSession(event);
  const userId = Number(session.user?.id);
  let rateLimitKey: string;
  if (Number.isInteger(userId) && userId > 0) {
    rateLimitKey = `user:${userId}`;
  } else if (isPublicThreadRead) {
    const clientIp = getRequestHeader(event, 'cf-connecting-ip');
    if (!clientIp) return;
    rateLimitKey = `anonymous:${clientIp}`;
  } else {
    return;
  }

  const bindingName = limiterFor(method, path);
  const environment = event.context.cloudflare?.env as Record<string, unknown> | undefined;
  const limiter = environment?.[bindingName] as RateLimitBinding | undefined;
  if (!limiter) {
    if (import.meta.dev) return;
    throw createError({ statusCode: 503, statusMessage: 'Request limiting is unavailable' });
  }

  let allowed: boolean;
  try {
    ({ success: allowed } = await limiter.limit({ key: rateLimitKey }));
  } catch (error) {
    console.error(`Rate limiter ${bindingName} failed`, error);
    return;
  }
  if (!allowed) {
    setResponseHeader(event, 'Retry-After', '60');
    throw createError({ statusCode: 429, statusMessage: 'Too many requests. Try again shortly.' });
  }
});
