import { getMethod, getRequestURL, getResponseStatus, setResponseHeader } from 'h3';

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', (event) => {
    event.context.requestStartedAt = Date.now();
  });
  nitroApp.hooks.hook('afterResponse', (event) => {
    const startedAt = Number(event.context.requestStartedAt || Date.now());
    const durationMs = Math.max(0, Date.now() - startedAt);
    setResponseHeader(event, 'Server-Timing', `app;dur=${durationMs}`);
    if (durationMs >= 1000) {
      console.warn({
        event: 'slow_response',
        durationMs,
        method: getMethod(event),
        path: getRequestURL(event).pathname,
      });
    }
    const status = getResponseStatus(event);
    if (status === 429) {
      console.warn({ event: 'rate_limited_response', status, method: getMethod(event) });
    } else if (status >= 500) {
      console.error({
        event: 'server_error_response',
        status,
        method: getMethod(event),
        path: getRequestURL(event).pathname,
      });
    }
  });
});
