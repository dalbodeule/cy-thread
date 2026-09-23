<script setup lang="ts">
type ThreadRow = {
  id: number;
  title: string;
  excerpt: string;
  category: string;
  categorySlug: string;
  author: string | null;
  createdAt: string | null;
  lastPostAt: string | null;
  isPinned: boolean;
  isLocked: boolean;
  replyCount: number;
};
type Category = { id: number; name: string; slug: string };
const route = useRoute();
const { loggedIn } = useUserSession();
const {
  public: { turnstile },
} = useRuntimeConfig();
const slug = computed(() => String(route.params.slug));
const search = ref('');
const sort = ref<'activity' | 'latest'>('activity');
const filter = ref<'all' | 'pinned' | 'locked'>('all');
const category = ref('');
const rows = ref<ThreadRow[]>([]);
const categories = ref<Category[]>([]);
const loading = ref(false);
const hasMore = ref(false);
const error = ref('');
const showComposer = ref(false);
const draftTitle = ref('');
const draftBody = ref('');
const draftCategory = ref('');
const turnstileToken = ref('');
const creating = ref(false);
const api = (path: string) => `/api/forums/${encodeURIComponent(slug.value)}${path}`;
const forumPath = computed(() => `/forums/${encodeURIComponent(slug.value)}`);
let searchTimer: ReturnType<typeof setTimeout> | undefined;

async function loadThreads(offset = 0) {
  loading.value = true;
  error.value = '';
  try {
    const params: Record<string, string | number> = { sort: sort.value, limit: 30, offset };
    if (filter.value === 'pinned') params.pinned = 1;
    if (filter.value === 'locked') params.locked = 1;
    if (search.value.trim()) params.q = search.value.trim();
    if (category.value) params.category = category.value;
    const loaded = await $fetch<ThreadRow[]>(api('/threads'), { params });
    rows.value = offset ? [...rows.value, ...loaded] : loaded;
    hasMore.value = loaded.length === 30;
  } catch {
    error.value = '목록을 불러오지 못했어요. 커뮤니티 주소를 확인해 주세요.';
  } finally {
    loading.value = false;
  }
}
async function loadMore() {
  await loadThreads(rows.value.length);
}
async function loadCategories() {
  try {
    categories.value = await $fetch<Category[]>(api('/categories'));
    if (!categories.value.some((item) => item.slug === draftCategory.value)) {
      draftCategory.value = categories.value[0]?.slug || '';
    }
  } catch {
    categories.value = [];
  }
}
async function createThread() {
  if (!loggedIn.value) return navigateTo('/login');
  creating.value = true;
  error.value = '';
  try {
    await $fetch(api('/threads'), {
      method: 'POST',
      body: {
        title: draftTitle.value,
        body: draftBody.value,
        categorySlug: draftCategory.value || categories.value[0]?.slug,
        turnstileToken: turnstileToken.value,
      },
    });
    draftTitle.value = '';
    draftBody.value = '';
    turnstileToken.value = '';
    showComposer.value = false;
    sort.value = 'latest';
    category.value = '';
    filter.value = 'all';
    await loadThreads();
  } catch {
    error.value = '게시글을 등록하지 못했어요. 제목과 내용을 확인해 주세요.';
  } finally {
    creating.value = false;
  }
}
watch(
  [slug, search, sort, category, filter],
  () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => void loadThreads(), search.value ? 180 : 0);
  },
  { immediate: true }
);
onMounted(async () => {
  await loadCategories();
});
watch(slug, () => void loadCategories());
onBeforeUnmount(() => clearTimeout(searchTimer));
function time(value: string | null) {
  if (!value) return '최근';
  const date = new Date(value);
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
</script>

<template>
  <div class="page-shell">
    <header class="page-topbar">
      <NuxtLink class="brand" to="/"
        ><span class="brand-mark">c<span>y</span></span
        ><span class="brand-word">thread<span class="brand-dot">.</span></span></NuxtLink
      >
      <nav class="page-nav">
        <NuxtLink to="/">둘러보기</NuxtLink
        ><NuxtLink :to="`${forumPath}/admin`">운영 관리</NuxtLink>
      </nav>
      <NuxtLink class="text-button" to="/login">로그인</NuxtLink>
    </header>
    <main class="page-content">
      <div class="page-breadcrumb">
        <NuxtLink to="/">커뮤니티</NuxtLink><span> / </span><span>{{ slug }}</span>
      </div>
      <section class="page-heading">
        <div>
          <p class="section-kicker">COMMUNITY THREADS</p>
          <h1>이야기 목록</h1>
          <p>질문과 답변, 멤버들의 이야기를 찾아보세요.</p>
        </div>
        <button class="primary-button" @click="showComposer = !showComposer">＋ 새 이야기</button>
      </section>
      <form v-if="showComposer" class="thread-create-form" @submit.prevent="createThread">
        <label
          >카테고리<select v-model="draftCategory" required>
            <option v-for="item in categories" :key="item.id" :value="item.slug">
              {{ item.name }}
            </option>
          </select></label
        >
        <label
          >제목<input v-model="draftTitle" required maxlength="120" placeholder="이야기 제목"
        /></label>
        <label
          >내용<textarea
            v-model="draftBody"
            required
            maxlength="20000"
            rows="6"
            placeholder="커뮤니티와 나눌 이야기를 적어 주세요."
          />
        </label>
        <NuxtTurnstile
          v-if="turnstile.siteKey"
          v-model="turnstileToken"
          :options="{ sitekey: turnstile.siteKey }"
        />
        <div>
          <button
            class="primary-button"
            :disabled="creating || (!!turnstile.siteKey && !turnstileToken)"
          >
            {{ creating ? '등록 중…' : '게시글 등록' }}</button
          ><button type="button" class="secondary-button" @click="showComposer = false">
            취소
          </button>
        </div>
      </form>
      <section class="list-controls" aria-label="목록 필터">
        <label class="page-search"
          ><span>⌕</span
          ><input v-model="search" type="search" placeholder="제목이나 내용 검색" /></label
        ><select v-model="category" aria-label="카테고리">
          <option value="">모든 카테고리</option>
          <option v-for="item in categories" :key="item.id" :value="item.slug">
            {{ item.name }}
          </option>
        </select>
        <select v-model="filter" aria-label="이야기 상태">
          <option value="all">모든 이야기</option>
          <option value="pinned">고정된 이야기</option>
          <option value="locked">댓글 잠금</option>
        </select>
        <div class="page-tabs">
          <button :class="{ active: sort === 'activity' }" @click="sort = 'activity'">활동순</button
          ><button :class="{ active: sort === 'latest' }" @click="sort = 'latest'">최신순</button>
        </div>
      </section>
      <p v-if="error" class="page-alert" role="alert">{{ error }}</p>
      <div v-else-if="loading && !rows.length" class="page-empty">이야기를 불러오는 중…</div>
      <div v-else-if="!rows.length" class="page-empty">
        <strong>아직 이야기가 없어요</strong>
        <p>첫 질문을 남겨 대화를 시작해 보세요.</p>
      </div>
      <div v-else class="page-thread-list">
        <article v-for="row in rows" :key="row.id" class="page-thread-row">
          <div class="page-thread-main">
            <div class="page-row-meta">
              <span class="thread-category tag-green">{{ row.category }}</span
              ><span v-if="row.isPinned" class="page-pinned">고정</span
              ><span v-if="row.isLocked" class="page-pinned">댓글 잠금</span
              ><time>{{ time(row.lastPostAt || row.createdAt) }}</time>
            </div>
            <NuxtLink class="page-thread-title" :to="`${forumPath}/threads/${row.id}`">{{
              row.title
            }}</NuxtLink>
            <p>{{ row.excerpt || '내용을 확인해 보세요.' }}</p>
            <small>{{ row.author || '멤버' }}</small>
          </div>
          <NuxtLink class="page-reply-count" :to="`${forumPath}/threads/${row.id}`"
            ><strong>{{ Math.max(0, row.replyCount - 1) }}</strong
            ><span>댓글</span></NuxtLink
          >
        </article>
      </div>
      <button
        v-if="!error && rows.length"
        class="load-more"
        :disabled="loading || !hasMore"
        @click="loadMore"
      >
        {{
          loading ? '불러오는 중…' : hasMore ? '더 많은 이야기 보기 ↓' : '모든 이야기를 불러왔어요'
        }}
      </button>
      <NuxtLink class="back-link" to="/">← 커뮤니티 홈</NuxtLink>
    </main>
  </div>
</template>
