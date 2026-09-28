<script setup lang="ts">
const props = defineProps<{ slug: string }>();
const { user, loggedIn } = useUserSession();
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
</script>
<template>
  <header class="page-topbar">
    <ForumBrand :slug="slug" />
    <nav class="page-nav" aria-label="Forum 메뉴">
      <NuxtLink to="/">둘러보기</NuxtLink>
      <NuxtLink :to="`${forumPath}/threads`">게시글</NuxtLink>
      <NuxtLink v-if="canModerate" :to="`${forumPath}/admin`">운영 관리</NuxtLink>
    </nav>
    <HeaderAccountActions :is-global-admin="isGlobalAdmin" />
  </header>
</template>
