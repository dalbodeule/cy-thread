// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  nitro: {
    preset: "cloudflare_module",
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
    '@nuxtjs/turnstile'
  ]
})