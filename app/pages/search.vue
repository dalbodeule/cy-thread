<script setup lang="ts">
type Result = {
  threadId: number;
  title: string;
  excerpt: string;
  createdAt: string;
  lastPostAt: string | null;
  forumSlug: string;
  forumName: string;
  category: string;
  categorySlug: string;
  author: string | null;
};
type Forum = { id: number; slug: string; name: string };
const route = useRoute();
const query = ref(typeof route.query.q === 'string' ? route.query.q : '');
const forum = ref(typeof route.query.forum === 'string' ? route.query.forum : '');
const category = ref(typeof route.query.category === 'string' ? route.query.category : '');
const from = ref(typeof route.query.from === 'string' ? route.query.from : '');
const sort = ref<'relevance' | 'latest'>('relevance');
const forums = ref<Forum[]>([]);
const results = ref<Result[]>([]);
const loading = ref(false);
const error = ref('');
let timer: ReturnType<typeof setTimeout> | undefined;
let requestId = 0;
async function search() {
  const current = ++requestId;
  const q = query.value.trim();
  if (q.length < 2) {
    results.value = [];
    return;
  }
  loading.value = true;
  try {
    const loaded = await $fetch<Result[]>('/api/search', {
      params: {
        q,
        forum: forum.value,
        category: category.value,
        from: from.value,
        sort: sort.value,
      },
    });
    if (current === requestId) {
      results.value = loaded;
      error.value = '';
    }
  } catch {
    if (current === requestId) error.value = '검색 결과를 불러오지 못했어요.';
  } finally {
    if (current === requestId) loading.value = false;
  }
}
function updateRoute() {
  void navigateTo(
    {
      path: '/search',
      query: {
        q: query.value || undefined,
        forum: forum.value || undefined,
        category: category.value || undefined,
        from: from.value || undefined,
      },
    },
    { replace: true }
  );
  void search();
}
watch([query, forum, category, from, sort], () => {
  clearTimeout(timer);
  timer = setTimeout(updateRoute, 180);
});
onMounted(async () => {
  forums.value = await $fetch<Forum[]>('/api/forums').catch(() => []);
  await search();
});
onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <div class="page-shell">
    <SiteTopbar />
    <main class="page-content">
      <div class="page-heading">
        <div>
          <p class="section-kicker">SEARCH</p>
          <h1>전체 글 검색</h1>
          <p>공개 Forum의 제목과 본문을 한 번에 찾아보세요.</p>
        </div>
      </div>
      <form class="list-controls search-page-controls" @submit.prevent="search">
        <label class="page-search"
          ><span>⌕</span
          ><input v-model="query" type="search" autofocus placeholder="검색어 2자 이상"
        /></label>
        <select v-model="forum" aria-label="Forum 필터">
          <option value="">전체 Forum</option>
          <option v-for="item in forums" :key="item.id" :value="item.slug">{{ item.name }}</option>
        </select>
        <input v-model="category" placeholder="카테고리 slug" aria-label="카테고리 필터" />
        <label class="search-date">이후 날짜<input v-model="from" type="date" /></label>
        <select v-model="sort" aria-label="정렬">
          <option value="relevance">관련도순</option>
          <option value="latest">최신순</option>
        </select>
      </form>
      <p v-if="error" class="page-alert" role="alert">{{ error }}</p>
      <p v-else-if="loading" class="page-empty">검색 중…</p>
      <p v-else-if="query.trim().length < 2" class="page-empty">검색어를 2자 이상 입력해 주세요.</p>
      <div v-else-if="results.length" class="search-results">
        <NuxtLink
          v-for="item in results"
          :key="`${item.threadId}-${item.categorySlug}`"
          class="search-result"
          :to="`/forums/${encodeURIComponent(item.forumSlug)}/threads/${item.threadId}`"
        >
          <small
            >{{ item.forumName }} · {{ item.category }} ·
            {{ new Date(item.createdAt).toLocaleDateString('ko-KR') }}</small
          >
          <strong>{{ item.title }}</strong>
          <p>{{ item.excerpt }}</p>
          <span>{{ item.author || '멤버' }}</span>
        </NuxtLink>
      </div>
      <p v-else class="page-empty">조건에 맞는 공개 게시글이 없어요.</p>
    </main>
  </div>
</template>
