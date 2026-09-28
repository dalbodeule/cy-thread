<script setup lang="ts">
useSeoMeta({
  title: 'Forum 둘러보기 | mori.space',
  description: 'mori.space의 공개 Forum을 둘러보고 관심 있는 커뮤니티에 참여하세요.',
});
useHead({ link: [{ rel: 'canonical', href: 'https://community.mori.space/explore' }] });
type Forum = { id: number; slug: string; name: string };
type Category = {
  id: number;
  name: string;
  slug: string;
  forumSlug: string;
  forumName: string;
  threadCount: number;
};
const query = ref('');
const { user, loggedIn } = useUserSession();
const { data: adminStatus } = await useFetch<{ isGlobalAdmin: boolean }>('/api/admin/status');
const forum = ref('');
const forums = ref<Forum[]>([]);
const categories = ref<Category[]>([]);
const hasMore = ref(false);
const loading = ref(false);
const error = ref('');
let timer: ReturnType<typeof setTimeout> | undefined;
let requestId = 0;
async function load(offset = 0) {
  const current = ++requestId;
  loading.value = true;
  try {
    const items = await $fetch<Category[]>('/api/categories', {
      params: { q: query.value, forum: forum.value, offset },
    });
    if (current === requestId) {
      categories.value = offset ? [...categories.value, ...items] : items;
      hasMore.value = items.length === 30;
      error.value = '';
    }
  } catch {
    if (current === requestId) error.value = 'Threads 목록을 불러오지 못했어요.';
  } finally {
    if (current === requestId) loading.value = false;
  }
}
watch([query, forum], () => {
  clearTimeout(timer);
  timer = setTimeout(() => void load(), 180);
});
onMounted(async () => {
  forums.value = await $fetch<Forum[]>('/api/forums').catch(() => []);
  await load();
});
onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <div class="page-shell">
    <header class="page-topbar">
      <NuxtLink class="home-brand" to="/"
        ><span class="home-brand-icon">m</span><span>mori.space</span></NuxtLink
      >
      <nav class="page-nav"><NuxtLink to="/">홈</NuxtLink></nav>
      <div class="home-account-actions">
        <ThemeControl /><NuxtLink v-if="loggedIn" class="text-button" to="/account/profile"
          >{{ user?.name || '멤버' }} · 프로필</NuxtLink
        ><NuxtLink v-if="adminStatus?.isGlobalAdmin" class="admin-tool-button" to="/admin"
          >관리도구</NuxtLink
        ><NuxtLink v-if="!loggedIn" class="text-button" to="/login">로그인</NuxtLink>
      </div>
    </header>
    <main class="page-content">
      <section class="page-heading">
        <div>
          <p class="section-kicker">DISCOVER THREADS</p>
          <h1>카테고리 찾기</h1>
          <p>게시글 모음을 검색하고 Forum별로 살펴보세요.</p>
        </div>
      </section>
      <div class="explore-controls">
        <label>이름 검색<input v-model="query" placeholder="Threads 이름 또는 주소" /></label
        ><label
          >Forum<select v-model="forum">
            <option value="">전체 Forum</option>
            <option v-for="item in forums" :key="item.id" :value="item.slug">
              {{ item.name }}
            </option>
          </select></label
        >
      </div>
      <p v-if="error" class="page-alert" role="alert">{{ error }}</p>
      <p v-else-if="loading" class="page-empty">찾는 중…</p>
      <div v-else-if="categories.length" class="featured-collections-grid explore-results">
        <NuxtLink
          v-for="item in categories"
          :key="item.id"
          class="featured-collection-card"
          :to="`/forums/${encodeURIComponent(item.forumSlug)}/threads?category=${encodeURIComponent(item.slug)}`"
          ><small>{{ item.forumName }}</small
          ><strong>{{ item.name }}</strong
          ><span>게시글 {{ item.threadCount }}개</span></NuxtLink
        >
      </div>
      <p v-else class="page-empty">조건에 맞는 Threads가 없습니다.</p>
      <button v-if="hasMore && !loading" class="load-more" @click="load(categories.length)">
        더 보기 ↓
      </button>
    </main>
  </div>
</template>
