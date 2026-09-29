// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'
import prettierPlugin from 'eslint-config-prettier';


export default withNuxt(prettierPlugin, {
  ignores: ['.kilo/**', '.nuxt/**', '.output/**'],
  rules: {
    // Nuxt page/layout filenames are route-driven and may legitimately be single-word.
    'vue/multi-word-component-names': 'off',
    'no-control-regex': 'off',
    '@typescript-eslint/consistent-type-imports': 'off',
    '@typescript-eslint/triple-slash-reference': 'off',
  },
}
)
