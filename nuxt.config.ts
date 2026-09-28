// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-09-28',
  css: ['~/assets/css/main.css'],
  site: { url: 'https://community.mori.space', name: 'mori.space' },
  sitemap: { sources: ['/api/__sitemap__/urls'] },
  robots: {
    disallow: ['/admin', '/account', '/login', '/mail', '/forums/*/admin', '/forums/*/reports'],
  },
  routeRules: {
    '/admin/**': { robots: false },
    '/admin': { robots: false },
    '/account/**': { robots: false },
    '/account': { robots: false },
    '/login': { robots: false },
    '/mail/**': { robots: false },
    '/mail': { robots: false },
    '/forums/*/admin/**': { robots: false },
    '/forums/*/admin': { robots: false },
    '/forums/*/reports': { robots: false },
  },
  devtools: { enabled: true },
  runtimeConfig: {
    turnstile: { secretKey: '' },
    public: { turnstile: { siteKey: '' } },
    session: {
      password: process.env.SESSION_PASSWORD ?? '',
      // Keep the sealed token bounded while renewing the browser's idle timeout.
      maxAge: 60 * 60 * 24 * 365,
      cookie: {
        maxAge: 60 * 60 * 24 * 30,
        expires: undefined,
      },
    },
    oauth: {
      google: {
        clientId: '',
        clientSecret: '',
      },
      chzzk: {
        clientId: '',
        clientSecret: '',
      },
    },
  },
  turnstile: { siteKey: '' },
  nitro: {
    preset: 'cloudflare_module',
  },
  modules: [
    '@pinia/nuxt',
    'pinia-plugin-persistedstate',
    '@nuxt/eslint',
    '@nuxtjs/tailwindcss',
    '@vueuse/nuxt',
    '@nuxtjs/sitemap',
    '@nuxtjs/robots',
    'dayjs-nuxt',
    'nuxt-auth-utils',
    '@nuxtjs/turnstile',
  ],
});
