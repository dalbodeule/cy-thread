<script setup lang="ts">
useSeoMeta({
  title: 'mori.space | 함께 나누는 커뮤니티',
  description: '관심사를 중심으로 Forum을 만들고 이야기를 나누는 공간, mori.space',
  ogSiteName: 'mori.space',
  ogType: 'website',
  twitterCard: 'summary',
});
const { loggedIn } = useUserSession();
const route = useRoute();
const { mode, systemDark, forumAllowsDark } = useTheme();
const suspension = ref<{ reason: string; expiresAt: string | null } | null>(null);
onMounted(async () => {
  const stored = localStorage.getItem('cy-thread-theme');
  if (stored === 'light' || stored === 'dark' || stored === 'system') mode.value = stored;
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  systemDark.value = media.matches;
  media.addEventListener('change', (event) => {
    systemDark.value = event.matches;
  });
  if (!loggedIn.value) return;
  try {
    const result = await $fetch<{
      suspension: { reason: string; expiresAt: string | null } | null;
    }>('/api/account/suspension');
    suspension.value = result.suspension;
  } catch {
    /* Page content remains available if status cannot be loaded. */
  }
});
watch(
  () => route.path,
  async (path) => {
    const match = /^\/forums\/([^/]+)/.exec(path);
    if (!match) {
      forumAllowsDark.value = true;
      return;
    }
    try {
      const forum = await $fetch<{ allowDarkMode: boolean }>(
        `/api/forums/${encodeURIComponent(decodeURIComponent(match[1]!))}`
      );
      if (route.path === path) forumAllowsDark.value = forum.allowDarkMode !== false;
    } catch {
      forumAllowsDark.value = true;
    }
  },
  { immediate: true }
);
</script>

<template>
  <div v-if="suspension" class="account-suspension-banner" role="status">
    <strong>{{
      suspension.expiresAt
        ? `계정 활동 정지 · ${new Date(suspension.expiresAt).toLocaleString('ko-KR')}까지`
        : '계정 활동 영구 정지'
    }}</strong>
    <span>사유: {{ suspension.reason }} · 글쓰기와 기타 변경 작업이 제한됩니다.</span>
  </div>
  <NuxtPage />
</template>
