type ThemeMode = 'light' | 'dark' | 'system';
export function useTheme() {
  const mode = useState<ThemeMode>('theme-mode', () => 'system');
  const forumAllowsDark = useState('forum-allows-dark', () => true);
  const systemDark = useState('system-dark', () => false);
  const effective = computed(() =>
    forumAllowsDark.value &&
    (mode.value === 'dark' || (mode.value === 'system' && systemDark.value))
      ? 'dark'
      : 'light'
  );
  function setMode(value: ThemeMode) {
    mode.value = value;
    if (import.meta.client) localStorage.setItem('cy-thread-theme', value);
  }
  if (import.meta.client) {
    watchEffect(() => {
      document.documentElement.dataset.theme = effective.value;
    });
  }
  return { mode, effective, forumAllowsDark, systemDark, setMode };
}
