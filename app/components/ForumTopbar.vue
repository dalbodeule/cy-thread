<script setup lang="ts">
const props = defineProps<{ slug: string }>();
const { user, loggedIn, clear } = useUserSession();
const forumPath = computed(() => `/forums/${encodeURIComponent(props.slug)}`);
const canModerate = ref(false);
const isGlobalAdmin = ref(false);
async function loadRole() {
  const slug = props.slug;
  const userId = user.value?.id;
  canModerate.value = false;
  isGlobalAdmin.value = false;
  if (!loggedIn.value) return;
  const [moderator, admin] = await Promise.all([
    $fetch(`/api/forums/${encodeURIComponent(slug)}/moderation/moderators`)
      .then(() => true)
      .catch(() => false),
    $fetch<{ isGlobalAdmin: boolean }>('/api/admin/status').catch(() => ({
      isGlobalAdmin: false,
    })),
  ]);
  if (props.slug !== slug || !loggedIn.value || user.value?.id !== userId) return;
  canModerate.value = moderator;
  isGlobalAdmin.value = admin.isGlobalAdmin;
}
watch([() => props.slug, loggedIn, () => user.value?.id], () => void loadRole(), {
  immediate: true,
});
async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' });
  await clear();
  await navigateTo('/');
}
</script>
<template>
  <header class="page-topbar">
    <ForumBrand :slug="slug" />
    <nav class="page-nav">
      <NuxtLink to="/">둘러보기</NuxtLink>
      <NuxtLink :to="`${forumPath}/threads`">이야기 목록</NuxtLink>
      <NuxtLink v-if="canModerate" :to="`${forumPath}/admin`">운영 관리</NuxtLink>
    </nav>
    <div class="forum-header-actions">
      <ThemeControl />
      <template v-if="loggedIn">
        <NuxtLink class="forum-session-name" to="/account/profile"
          >{{ user?.name || '멤버' }} · 프로필</NuxtLink
        >
        <NuxtLink v-if="isGlobalAdmin" class="admin-tool-button" to="/admin"
          >관리도구</NuxtLink
        >
        <button class="text-button" @click="logout">로그아웃</button>
      </template>
      <NuxtLink v-else class="text-button" to="/login">로그인</NuxtLink>
    </div>
  </header>
</template>
