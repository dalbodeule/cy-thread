import getChzzkOAuthConfig from '~~/server/utils/getChzzkOAuthConfig';

export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event);
  const chzzk = getChzzkOAuthConfig(event);

  return {
    google: Boolean(config.oauth.google.clientId && config.oauth.google.clientSecret),
    chzzk: Boolean(chzzk.clientId && chzzk.clientSecret),
  };
});
