// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-09-15',
  css: ['~/assets/css/main.css'],
  devtools: { enabled: true },
  runtimeConfig: {
    turnstile: { secretKey: '' },
    public: { turnstile: { siteKey: '' } },
    oauth: {
      google: {
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
