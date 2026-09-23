import type { Config } from 'tailwindcss';

export default <Partial<Config>>{
  content: {
    files: ['./app/**/*.{vue,ts,js}', './server/**/*.{ts,js}', './components/**/*.{vue,ts,js}'],
  },
  theme: {
    extend: {
      colors: {
        cy: {
          ink: '#283a31',
          forest: '#31664d',
          leaf: '#84ad59',
          canvas: '#f9faf7',
          line: '#e8ece7',
          muted: '#89948c',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'Noto Sans KR', 'sans-serif'],
        display: ['Manrope', 'Noto Sans KR', 'sans-serif'],
      },
      borderRadius: {
        card: '8px',
      },
      boxShadow: {
        soft: '0 12px 35px rgb(53 75 53 / 12%)',
      },
    },
  },
};
