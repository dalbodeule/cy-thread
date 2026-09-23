export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event);

  return {
    google: Boolean(config.oauth.google.clientId && config.oauth.google.clientSecret),
  };
});
