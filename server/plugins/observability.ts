import { getMethod, getRequestURL, getResponseStatus } from 'h3';

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('afterResponse', (event) => {
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
