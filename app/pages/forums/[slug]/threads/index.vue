<script setup lang="ts">
const ToastEditor = defineAsyncComponent(
  () => import('../../../../components/editor/ToastEditor.vue')
);
type ThreadRow = {
  id: number;
  title: string;
  tags: string[];
  format: 'discussion' | 'question' | 'poll' | 'announcement';
  pollOptions: string[];
  excerpt: string;
  category: string;
  categorySlug: string;
  author: string | null;
  authorAvatarUrl: string | null;
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
const category = ref(typeof route.query.category === 'string' ? route.query.category : '');
const { data: seoForum } = await useFetch<{
  name: string;
  description: string;
  iconText: string;
  iconBackground: string;
  iconColor: string;
  rules: string;
  welcomeMessage: string;
  resourceLinks: Array<{ title: string; url: string }>;
  visibility: 'public' | 'private';
  membershipStatus: 'approved' | 'pending' | 'none' | 'anonymous';
  membershipQuestions: string[];
}>(() => `/api/forums/${encodeURIComponent(String(route.params.slug))}`, {
  key: `forum-seo-${String(route.params.slug)}`,
});
if (!seoForum.value) throw createError({ statusCode: 404, statusMessage: 'Forum not found' });
const [statsFetch, followFetch, threadsFetch, categoriesFetch] = await Promise.all([
  useFetch<{ members: number; threads: number; posts: number; categories: number }>(
    () => `/api/forums/${encodeURIComponent(String(route.params.slug))}/stats`,
    { key: `forum-stats-${String(route.params.slug)}` }
  ),
  useFetch<{ following: boolean }>(
    () => `/api/forums/${encodeURIComponent(String(route.params.slug))}/follow`,
    { key: `forum-follow-${String(route.params.slug)}`, immediate: loggedIn.value }
  ),
  useFetch<ThreadRow[]>(
    () => `/api/forums/${encodeURIComponent(String(route.params.slug))}/threads`,
    {
      key: `forum-threads-${String(route.params.slug)}-${category.value}`,
      query: { sort: 'activity', limit: 30, category: category.value || undefined },
    }
  ),
  useFetch<Category[]>(
    () => `/api/forums/${encodeURIComponent(String(route.params.slug))}/categories`,
    { key: `forum-categories-${String(route.params.slug)}` }
  ),
]);
const { data: membershipState, refresh: refreshMembership } = await useFetch<{ status: string }>(
  () => `/api/forums/${encodeURIComponent(String(route.params.slug))}/membership`,
  { key: `forum-membership-${String(route.params.slug)}` }
);
const { data: forumStats, refresh: refreshForumStats } = statsFetch;
const { data: followState } = followFetch;
const { data: initialRows } = threadsFetch;
const { data: initialCategories } = categoriesFetch;
const followBusy = ref(false);
const followError = ref('');
const muted = ref(false);
const muteBusy = ref(false);
const { data: mutedForums } = await useFetch<Array<{ slug: string }>>('/api/account/mutes', {
  key: `forum-mutes-${String(route.params.slug)}`,
  immediate: loggedIn.value,
});
muted.value = Boolean(mutedForums.value?.some((item) => item.slug === slug.value));
async function toggleMute() {
  if (!loggedIn.value) return navigateTo('/login');
  muteBusy.value = true;
  try {
    const result = await $fetch<{ muted: boolean }>('/api/account/mutes', {
      method: 'POST',
      body: { forumSlug: slug.value, muted: !muted.value },
    });
    muted.value = result.muted;
  } catch {
    followError.value = 'Forum 뮤트 상태를 변경하지 못했어요.';
  } finally {
    muteBusy.value = false;
  }
}
async function toggleFollow() {
  if (!loggedIn.value) return navigateTo('/login');
  followBusy.value = true;
  followError.value = '';
  try {
    const result = await $fetch<{ following: boolean }>(
      `/api/forums/${encodeURIComponent(slug.value)}/follow`,
      { method: 'POST', body: { following: !followState.value?.following } }
    );
    followState.value = result;
    await refreshForumStats();
  } catch {
    followError.value = '팔로우 상태를 변경하지 못했어요. 잠시 후 다시 시도해 주세요.';
  } finally {
    followBusy.value = false;
  }
}
const seoTitle = computed(() =>
  seoForum.value ? `${seoForum.value.name} | mori.space` : 'Forum | mori.space'
);
const canonical = computed(
  () => `https://community.mori.space/forums/${encodeURIComponent(slug.value)}/threads`
);
useSeoMeta({
  title: seoTitle,
  description: () =>
    seoForum.value?.description || `${seoForum.value?.name || 'Forum'}에서 이야기를 나누세요.`,
  ogTitle: seoTitle,
  ogDescription: () => seoForum.value?.description || '',
  ogUrl: canonical,
});
useHead(() => ({ link: [{ rel: 'canonical', href: canonical.value }] }));
const search = ref('');
const sort = ref<'activity' | 'latest'>('activity');
const filter = ref<'all' | 'pinned' | 'locked'>('all');
const rows = ref<ThreadRow[]>(initialRows.value || []);
const categories = ref<Category[]>(initialCategories.value || []);
const loading = ref(false);
const hasMore = ref(rows.value.length === 30);
const error = ref('');
const showComposer = ref(route.query.compose === '1');
const draftTitle = ref('');
const draftBody = ref('');
const draftCategory = ref('');
const draftTags = ref('');
const draftFormat = ref<'discussion' | 'question' | 'poll' | 'announcement'>('discussion');
const draftPollOptions = ref('');
const turnstileToken = ref('');
const turnstileKey = ref(0);
function resetTurnstile() {
  turnstileToken.value = '';
  turnstileKey.value += 1;
}
const creating = ref(false);
const joinAnswers = ref<string[]>([]);
const joining = ref(false);
const joinError = ref('');
const joinNotice = ref('');
const joinTurnstileToken = ref('');
const joinTurnstileKey = ref(0);
const isPrivateBlocked = computed(
  () => seoForum.value?.visibility === 'private' && membershipState.value?.status !== 'approved'
);
const draftKey = computed(() => `mori-draft:thread:${slug.value}`);
let draftTimer: ReturnType<typeof setTimeout> | undefined;
const api = (path: string) => `/api/forums/${encodeURIComponent(slug.value)}${path}`;
const forumPath = computed(() => `/forums/${encodeURIComponent(slug.value)}`);
let searchTimer: ReturnType<typeof setTimeout> | undefined;

async function applyForMembership() {
  if (!loggedIn.value) return navigateTo('/login');
  joining.value = true;
  joinError.value = '';
  try {
    await $fetch(api('/membership'), {
      method: 'POST',
      body: { answers: joinAnswers.value, turnstileToken: joinTurnstileToken.value },
    });
    joinNotice.value = '가입 신청을 보냈어요. 운영진 승인 후 Forum을 이용할 수 있어요.';
    joinTurnstileToken.value = '';
    joinTurnstileKey.value += 1;
    await refreshMembership();
  } catch (caught) {
    const failure = caught as { data?: { statusMessage?: string } };
    joinError.value = failure.data?.statusMessage || '가입 신청을 보내지 못했어요.';
  } finally {
    joining.value = false;
  }
}

function selectCategory(nextCategory: string) {
  category.value = nextCategory;
  void navigateTo(
    {
      path: `${forumPath.value}/threads`,
      query: nextCategory ? { category: nextCategory } : {},
    },
    { replace: true }
  );
}

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
  if (!draftBody.value.trim()) {
    error.value = '게시글 내용을 입력해 주세요.';
    return;
  }
  creating.value = true;
  error.value = '';
  try {
    await $fetch(api('/threads'), {
      method: 'POST',
      body: {
        title: draftTitle.value,
        body: draftBody.value,
        categorySlug: draftCategory.value || categories.value[0]?.slug,
        tags: draftTags.value,
        format: draftFormat.value,
        pollOptions: draftPollOptions.value,
        turnstileToken: turnstileToken.value,
      },
    });
    draftTitle.value = '';
    draftBody.value = '';
    draftTags.value = '';
    draftFormat.value = 'discussion';
    draftPollOptions.value = '';
    localStorage.removeItem(draftKey.value);
    resetTurnstile();
    showComposer.value = false;
    sort.value = 'latest';
    selectCategory('');
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
  { immediate: false }
);
watch(slug, () => void loadCategories());
watch(
  () => route.query.category,
  (value) => {
    const nextCategory = typeof value === 'string' ? value : '';
    if (category.value !== nextCategory) category.value = nextCategory;
  }
);
onMounted(() => {
  try {
    const saved = JSON.parse(localStorage.getItem(draftKey.value) || 'null');
    if (saved) {
      draftTitle.value = saved.title || '';
      draftBody.value = saved.body || '';
      draftCategory.value = saved.category || '';
      draftTags.value = saved.tags || '';
      draftFormat.value = saved.format || 'discussion';
      draftPollOptions.value = saved.pollOptions || '';
      if (draftTitle.value || draftBody.value) showComposer.value = true;
    }
  } catch {
    /* Ignore malformed local drafts. */
  }
  if (!categories.value.length) void loadCategories();
});
watch([draftTitle, draftBody, draftCategory, draftTags, draftFormat, draftPollOptions], () => {
  if (!import.meta.client) return;
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    if (draftTitle.value || draftBody.value)
      localStorage.setItem(
        draftKey.value,
        JSON.stringify({
          title: draftTitle.value,
          body: draftBody.value,
          category: draftCategory.value,
          tags: draftTags.value,
          format: draftFormat.value,
          pollOptions: draftPollOptions.value,
        })
      );
    else localStorage.removeItem(draftKey.value);
  }, 300);
});
watch(
  () => route.query.compose,
  (value) => {
    if (value === '1') showComposer.value = true;
  }
);
onBeforeUnmount(() => {
  clearTimeout(searchTimer);
  clearTimeout(draftTimer);
});
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
  <div class="page-shell forum-page" :data-forum-slug="slug">
    <ForumTopbar :slug="slug" />
    <main class="page-content">
      <div class="page-breadcrumb">
        <NuxtLink to="/">Forum 둘러보기</NuxtLink><span> / {{ seoForum?.name || slug }}</span>
      </div>
      <section class="forum-intro">
        <div v-if="seoForum?.welcomeMessage || seoForum?.rules" class="admin-panel">
          <p v-if="seoForum?.welcomeMessage">{{ seoForum.welcomeMessage }}</p>
          <h2 v-if="seoForum?.rules">Forum 규칙</h2>
          <p v-if="seoForum?.rules" class="whitespace-pre-line">{{ seoForum.rules }}</p>
        </div>
        <div class="forum-intro-main">
          <span
            class="forum-intro-icon"
            :style="{ backgroundColor: seoForum?.iconBackground, color: seoForum?.iconColor }"
            >{{ seoForum?.iconText || 'F' }}</span
          >
          <div>
            <p class="section-kicker">FORUM · /{{ slug }}</p>
            <h1>{{ seoForum?.name || slug }}</h1>
            <p>{{ seoForum?.description || '이 Forum에서 이야기를 나눠보세요.' }}</p>
          </div>
        </div>
        <div class="forum-intro-stats" aria-label="Forum 현황">
          <span
            ><strong>{{ (forumStats?.members || 0).toLocaleString('ko-KR') }}</strong
            >멤버</span
          ><span
            ><strong>{{ (forumStats?.threads || 0).toLocaleString('ko-KR') }}</strong
            >게시글</span
          ><span
            ><strong>{{ (forumStats?.categories || 0).toLocaleString('ko-KR') }}</strong
            >카테고리</span
          >
        </div>
        <div class="forum-intro-actions">
          <button
            type="button"
            class="secondary-button"
            :aria-pressed="Boolean(followState?.following)"
            :disabled="followBusy"
            @click="toggleFollow"
          >
            {{
              followBusy ? '처리 중…' : followState?.following ? '✓ 팔로우 중' : '＋ Forum 팔로우'
            }}
          </button>
          <span>팔로우하면 이 Forum의 멤버로 참여할 수 있어요.</span>
          <button
            v-if="loggedIn"
            type="button"
            class="post-text-action"
            :disabled="muteBusy"
            @click="toggleMute"
          >
            {{ muted ? 'Forum 뮤트 해제' : 'Forum 뮤트' }}
          </button>
        </div>
        <p v-if="followError" class="page-alert" role="alert">{{ followError }}</p>
      </section>
      <section
        v-if="seoForum?.resourceLinks?.length"
        class="forum-resources"
        aria-labelledby="forum-resources-title"
      >
        <div>
          <p class="section-kicker">RESOURCES</p>
          <h2 id="forum-resources-title">운영 자료실</h2>
          <p>운영진이 공유한 안내와 참고 자료를 확인하세요.</p>
        </div>
        <ul class="forum-resource-list">
          <li v-for="resource in seoForum.resourceLinks" :key="resource.url">
            <a :href="resource.url" target="_blank" rel="noreferrer noopener">
              <span>{{ resource.title }}</span
              ><span aria-hidden="true">↗</span>
            </a>
          </li>
        </ul>
      </section>
      <section v-if="isPrivateBlocked" class="admin-panel membership-panel">
        <h2>비공개 Forum 가입</h2>
        <p v-if="membershipState?.status === 'pending' || joinNotice">가입 신청을 검토 중이에요.</p>
        <p v-else>이 Forum은 가입 승인 후 게시글과 댓글을 볼 수 있어요.</p>
        <p v-if="joinError" class="page-alert" role="alert">{{ joinError }}</p>
        <form
          v-if="membershipState?.status !== 'pending' && loggedIn"
          @submit.prevent="applyForMembership"
        >
          <label v-for="(question, index) in seoForum?.membershipQuestions || []" :key="question"
            >{{ question }}<textarea v-model="joinAnswers[index]" required maxlength="1000" />
          </label>
          <NuxtTurnstile
            v-if="turnstile.siteKey"
            :key="joinTurnstileKey"
            v-model="joinTurnstileToken"
            :options="{ sitekey: turnstile.siteKey }"
          />
          <button
            class="primary-button"
            :disabled="joining || (!!turnstile.siteKey && !joinTurnstileToken)"
          >
            {{ joining ? '신청 중…' : '가입 신청' }}
          </button>
        </form>
        <NuxtLink v-else-if="!loggedIn" class="primary-button" to="/login"
          >로그인 후 가입 신청</NuxtLink
        >
      </section>
      <template v-else>
        <section class="page-heading">
          <div>
            <p class="section-kicker">DISCUSSIONS</p>
            <h2>게시글</h2>
            <p>카테고리를 골라 대화를 살펴보거나 새 글을 작성하세요.</p>
          </div>
          <button type="button" class="primary-button" @click="showComposer = !showComposer">
            {{ showComposer ? '목록 보기' : '＋ 새 게시글' }}
          </button>
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
            >태그 <small>(쉼표로 구분, 최대 5개)</small
            ><input
              v-model="draftTags"
              maxlength="150"
              placeholder="예: 질문, 팁"
              aria-label="게시글 태그"
          /></label>
          <label
            >게시글 형식<select v-model="draftFormat">
              <option value="discussion">일반 이야기</option>
              <option value="question">질문</option>
              <option value="poll">투표</option>
              <option value="announcement">공지</option>
            </select></label
          >
          <label v-if="draftFormat === 'poll'"
            >투표 항목(한 줄에 하나)<textarea
              v-model="draftPollOptions"
              rows="4"
              maxlength="1000"
              aria-label="투표 항목"
            />
          </label>
          <div class="forum-editor-field">
            <strong>내용</strong>
            <ClientOnly>
              <ToastEditor
                id="forum-thread-editor"
                v-model:content="draftBody"
                :forum-slug="slug"
                :turnstile-token="turnstileToken"
                @turnstile-used="resetTurnstile"
              />
              <template #fallback>
                <textarea
                  v-model="draftBody"
                  rows="6"
                  placeholder="커뮤니티와 나눌 이야기를 적어 주세요."
                />
              </template>
            </ClientOnly>
            <small
              >{{ draftBody.length.toLocaleString('ko-KR') }} / 20,000자 · WYSIWYG와 Markdown 모드를
              사용할 수 있어요.</small
            >
          </div>
          <NuxtTurnstile
            v-if="turnstile.siteKey"
            :key="turnstileKey"
            v-model="turnstileToken"
            :options="{ sitekey: turnstile.siteKey }"
          />
          <div>
            <button
              class="primary-button"
              :disabled="
                creating ||
                !draftTitle.trim() ||
                !draftCategory ||
                !draftBody.trim() ||
                draftBody.length > 20000 ||
                (!!turnstile.siteKey && !turnstileToken)
              "
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
            ><input
              v-model="search"
              type="search"
              placeholder="제목이나 내용 검색"
              aria-label="게시글 검색" /></label
          ><select v-model="filter" aria-label="이야기 상태">
            <option value="all">모든 게시글</option>
            <option value="pinned">고정된 게시글</option>
            <option value="locked">댓글 잠금</option>
          </select>
          <div class="page-tabs">
            <button
              type="button"
              :class="{ active: sort === 'activity' }"
              @click="sort = 'activity'"
            >
              활동순</button
            ><button type="button" :class="{ active: sort === 'latest' }" @click="sort = 'latest'">
              최신순
            </button>
          </div>
        </section>
        <p v-if="error" class="page-alert" role="alert">{{ error }}</p>
        <div v-else-if="loading && !rows.length" class="page-empty">이야기를 불러오는 중…</div>
        <div v-else-if="!rows.length" class="page-empty">
          <strong>{{
            search || category || filter !== 'all'
              ? '조건에 맞는 게시글이 없어요'
              : '아직 게시글이 없어요'
          }}</strong>
          <p>
            {{
              search || category || filter !== 'all'
                ? '검색어나 필터를 바꿔보세요.'
                : '첫 게시글을 작성해 대화를 시작해 보세요.'
            }}
          </p>
          <button
            v-if="!search && !category && filter === 'all'"
            class="secondary-button"
            @click="showComposer = true"
          >
            첫 게시글 작성
          </button>
        </div>
        <div v-else class="page-thread-list">
          <article v-for="row in rows" :key="row.id" class="page-thread-row">
            <div class="page-thread-main">
              <div class="page-row-meta">
                <span class="thread-category tag-green">{{ row.category }}</span
                ><span v-for="tag in row.tags" :key="tag" class="thread-tag">#{{ tag }}</span
                ><span v-if="row.format === 'question'" class="page-pinned">질문</span
                ><span v-if="row.format === 'poll'" class="page-pinned">투표</span
                ><span v-if="row.format === 'announcement'" class="page-pinned">공지</span
                ><span v-if="row.isPinned" class="page-pinned">고정</span
                ><span v-if="row.isLocked" class="page-pinned">댓글 잠금</span
                ><time>{{ time(row.lastPostAt || row.createdAt) }}</time>
              </div>
              <NuxtLink class="page-thread-title" :to="`${forumPath}/threads/${row.id}`">{{
                row.title
              }}</NuxtLink>
              <p>{{ row.excerpt || '내용을 확인해 보세요.' }}</p>
              <small class="forum-thread-author"
                ><UserAvatar :src="row.authorAvatarUrl" :name="row.author" />{{
                  row.author || '멤버'
                }}</small
              >
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
            loading
              ? '불러오는 중…'
              : hasMore
                ? '더 많은 이야기 보기 ↓'
                : '모든 이야기를 불러왔어요'
          }}
        </button>
        <NuxtLink class="back-link" to="/">← 전체 홈</NuxtLink>
      </template>
    </main>
  </div>
</template>
