<script setup lang="ts">
const props = defineProps<{ slug: string }>();
type Category = { id: number; name: string; slug: string };
const route = useRoute();
const { user, loggedIn } = useUserSession();
const forumPath = computed(() => `/forums/${encodeURIComponent(props.slug)}`);
const threadsPath = computed(() => `${forumPath.value}/threads`);
const { data: categories } = await useFetch<Category[]>(
  () => `/api/forums/${encodeURIComponent(props.slug)}/categories`,
  { key: `forum-categories-${props.slug}` }
);
const activeCategory = computed(() =>
  route.path === threadsPath.value && typeof route.query.category === 'string'
    ? route.query.category
    : ''
);
const canModerate = ref(false);
const isGlobalAdmin = ref(false);
const mobileMenuOpen = ref(false);
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
watch(
  () => route.fullPath,
  () => {
    mobileMenuOpen.value = false;
  }
);
</script>
<template>
  <header class="page-topbar forum-topbar">
    <ForumBrand :slug="slug" />
    <nav class="page-nav forum-header-nav" aria-label="Forum 카테고리">
      <NuxtLink
        :to="threadsPath"
        :class="{ 'forum-nav-active': route.path === threadsPath && !activeCategory }"
        :aria-current="route.path === threadsPath && !activeCategory ? 'page' : undefined"
        >전체</NuxtLink
      >
      <NuxtLink
        v-for="item in categories || []"
        :key="item.id"
        :to="{ path: threadsPath, query: { category: item.slug } }"
        :class="{ 'forum-nav-active': activeCategory === item.slug }"
        :aria-current="activeCategory === item.slug ? 'page' : undefined"
        >{{ item.name }}</NuxtLink
      >
    </nav>
    <div class="forum-header-links">
      <NuxtLink v-if="canModerate" :to="`${forumPath}/admin`">운영 관리</NuxtLink>
      <NuxtLink class="forum-nav-exit" to="/"
        >메인으로 나가기 <span aria-hidden="true">↗</span></NuxtLink
      >
    </div>
    <HeaderAccountActions :is-global-admin="isGlobalAdmin" />
    <button
      class="forum-mobile-menu-button"
      type="button"
      aria-label="Forum 메뉴 열기"
      :aria-expanded="mobileMenuOpen"
      aria-controls="forum-mobile-menu"
      @click="mobileMenuOpen = !mobileMenuOpen"
    >
      <span aria-hidden="true">☰</span>
    </button>
    <div
      v-if="mobileMenuOpen"
      class="forum-mobile-menu-backdrop"
      aria-hidden="true"
      @click="mobileMenuOpen = false"
    />
    <aside
      id="forum-mobile-menu"
      class="forum-mobile-menu"
      :class="{ 'is-open': mobileMenuOpen }"
      :aria-hidden="!mobileMenuOpen"
      aria-label="Forum 메뉴"
    >
      <div class="forum-mobile-menu-head">
        <strong>메뉴</strong>
        <button type="button" aria-label="메뉴 닫기" @click="mobileMenuOpen = false">×</button>
      </div>
      <nav class="forum-mobile-menu-nav" aria-label="Forum 카테고리">
        <NuxtLink
          :to="threadsPath"
          :class="{ 'forum-nav-active': route.path === threadsPath && !activeCategory }"
        >
          전체
        </NuxtLink>
        <NuxtLink
          v-for="item in categories || []"
          :key="item.id"
          :to="{ path: threadsPath, query: { category: item.slug } }"
          :class="{ 'forum-nav-active': activeCategory === item.slug }"
        >
          {{ item.name }}
        </NuxtLink>
      </nav>
      <div class="forum-mobile-menu-links">
        <NuxtLink v-if="canModerate" :to="`${forumPath}/admin`">운영 관리</NuxtLink>
        <NuxtLink to="/">메인으로 나가기 <span aria-hidden="true">↗</span></NuxtLink>
      </div>
    </aside>
  </header>
</template>
