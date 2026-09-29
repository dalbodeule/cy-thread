<script setup lang="ts">
type Row = {
  id: number;
  title: string;
  excerpt: string;
  forumSlug: string;
  forumName: string;
  category: string;
  author: string | null;
  createdAt: string;
  lastPostAt: string | null;
};
const { loggedIn } = useUserSession();
const rows = ref<Row[]>([]);
const loading = ref(true);
const error = ref('');
onMounted(async () => {
  if (!loggedIn.value) {
    loading.value = false;
    return;
  }
  try {
    rows.value = await $fetch<Row[]>('/api/following-threads');
  } catch {
    error.value = '팔로우 피드를 불러오지 못했어요.';
  } finally {
    loading.value = false;
  }
});
useSeoMeta({ title: '팔로우 피드 | mori.space', robots: 'noindex, nofollow' });
</script>
<template>
  <div class="page-shell">
    <SiteTopbar />
    <main class="page-content">
      <div class="page-heading">
        <div>
          <p class="section-kicker">FOLLOWING</p>
          <h1>팔로우 피드</h1>
          <p>팔로우한 Forum의 새 글을 모아봅니다.</p>
        </div>
      </div>
      <p v-if="!loggedIn" class="page-alert">
        <NuxtLink to="/login">로그인</NuxtLink> 후 이용할 수 있어요.
      </p>
      <p v-else-if="error" class="page-alert" role="alert">{{ error }}</p>
      <p v-else-if="loading" class="page-empty">불러오는 중…</p>
      <p v-else-if="!rows.length" class="page-empty">팔로우한 Forum에 새 글이 없어요.</p>
      <div v-else class="page-thread-list">
        <article v-for="row in rows" :key="row.id" class="page-thread-row">
          <div class="page-thread-main">
            <div class="page-row-meta">
              <span class="thread-category tag-green">{{ row.category }}</span
              ><span>{{ row.forumName }}</span>
            </div>
            <NuxtLink
              class="page-thread-title"
              :to="`/forums/${encodeURIComponent(row.forumSlug)}/threads/${row.id}`"
              >{{ row.title }}</NuxtLink
            >
            <p>{{ row.excerpt }}</p>
            <small>{{ row.author || '멤버' }}</small>
          </div>
        </article>
      </div>
    </main>
  </div>
</template>
