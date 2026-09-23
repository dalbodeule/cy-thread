<script setup lang="ts">
const ToastEditor = defineAsyncComponent(() => import('../components/editor/ToastEditor.vue'));
const ToastViewer = defineAsyncComponent(() => import('../components/editor/ToastViewer.vue'));
const {
  public: { turnstile },
} = useRuntimeConfig();
const threadTurnstileToken = ref('');
const replyTurnstileToken = ref('');
const reportTurnstileToken = ref('');

type Thread = {
  id: number;
  title: string;
  excerpt: string;
  category: string;
  author: string;
  initials: string;
  color: string;
  time: string;
  replies: number;
  views: string;
  featured?: boolean;
  isBookmarked?: boolean;
};

type CommunityThread = {
  id: number;
  title: string;
  excerpt: string;
  category: string;
  categorySlug: string;
  author: string | null;
  authorAvatarUrl: string | null;
  createdAt: string | null;
  lastPostAt: string | null;
  isPinned: boolean;
  isBookmarked: boolean;
  replyCount: number;
};

type CommunityCategory = {
  id: number;
  name: string;
  slug: string;
  sortOrder: number | null;
  threadCount: number;
  deletedThreadCount: number;
};
type CommunityInfo = { id: number; slug: string; name: string };
type CommunityStats = { members: number; threads: number; posts: number; categories: number };
type ThreadDetail = {
  id: number;
  title: string;
  isLocked: boolean;
  category: string;
  categorySlug: string;
  forumId: number;
  authorId: number;
  author: string | null;
  authorAvatarUrl: string | null;
  createdAt: string;
  canModerate: boolean;
  isAuthor: boolean;
  replies: Array<{
    id: number;
    authorId: number;
    author: string | null;
    authorAvatarUrl: string | null;
    markdown: string;
    createdAt: string;
    isAuthor: boolean;
  }>;
};
type ModerationReport = {
  id: number;
  reason: string;
  details: string | null;
  status: string;
  createdAt: string;
  threadId: number | null;
  threadTitle: string | null;
  threadAuthorUserId: number | null;
  threadDeleted: boolean;
  reporter: string | null;
};

const demoCategories = [
  { name: '전체', icon: '✳', count: '2,480' },
  { name: '개발 이야기', icon: '⌘', count: '842' },
  { name: '커리어', icon: '↗', count: '516' },
  { name: '사이드 프로젝트', icon: '◈', count: '389' },
  { name: '자유 게시판', icon: '☻', count: '733' },
];
const categories = ref(demoCategories);
const forumCategories = ref<CommunityCategory[]>([]);
const forumSlug = ref('cy-thread');
const forumName = ref('CY Thread');
const myForums = ref<CommunityInfo[]>([{ id: 1, slug: 'cy-thread', name: 'CY Thread' }]);

const demoThreads = ref<Thread[]>([
  {
    id: 1,
    title: '요즘 만들고 있는 사이드 프로젝트, 어디까지 왔나요?',
    excerpt:
      '작게라도 매주 업데이트하는 분들 이야기 듣고 싶어요. 저는 이번 주에 드디어 로그인과 온보딩 흐름을 붙였습니다.',
    category: '사이드 프로젝트',
    author: '민지',
    initials: '민',
    color: 'peach',
    time: '8분 전',
    replies: 24,
    views: '1.2k',
    featured: true,
  },
  {
    id: 2,
    title: '주니어 개발자 포트폴리오 리뷰해요 — 서로 피드백 나눠요',
    excerpt:
      '처음 취업을 준비할 때 어떤 부분을 보여줘야 할지 막막하더라고요. 편하게 링크 남겨 주세요!',
    category: '커리어',
    author: '도현',
    initials: '도',
    color: 'blue',
    time: '23분 전',
    replies: 18,
    views: '864',
  },
  {
    id: 3,
    title: 'Vue 3에서 상태 관리는 어디까지가 적당할까요?',
    excerpt: '작은 팀에서 Pinia를 도입하면서 느낀 점과 컴포저블로 충분했던 케이스를 정리해봤어요.',
    category: '개발 이야기',
    author: '서연',
    initials: '서',
    color: 'lavender',
    time: '1시간 전',
    replies: 32,
    views: '2.1k',
  },
  {
    id: 4,
    title: '오늘의 작은 성취를 기록하는 스레드 🌱',
    excerpt: '대단하지 않아도 괜찮아요. 오늘 해낸 일을 한 줄씩 나눠 봐요.',
    category: '자유 게시판',
    author: '준호',
    initials: '준',
    color: 'mint',
    time: '2시간 전',
    replies: 47,
    views: '986',
  },
  {
    id: 5,
    title: '첫 오픈소스 PR을 머지했어요!',
    excerpt:
      '사소한 문서 수정이었지만 시작이 반이라는 말이 실감 나네요. 다음엔 코드에도 도전해볼게요.',
    category: '개발 이야기',
    author: '유진',
    initials: '유',
    color: 'yellow',
    time: '3시간 전',
    replies: 15,
    views: '642',
  },
  {
    id: 6,
    title: '혼자 일할 때 루틴, 다들 어떻게 만드시나요?',
    excerpt:
      '집중이 잘되는 시간대와 쉬는 시간을 정해두니 조금 나아졌어요. 여러분의 방법도 궁금합니다.',
    category: '커리어',
    author: '하늘',
    initials: '하',
    color: 'pink',
    time: '5시간 전',
    replies: 29,
    views: '1.4k',
  },
]);

const databaseThreads = ref<CommunityThread[]>([]);
const databaseReady = ref(false);
const hasMoreThreads = ref(false);
const isLoadingThreads = ref(false);
const googleAuthEnabled = ref(false);
const { user: sessionUser, loggedIn, clear: clearSession } = useUserSession();
const stats = ref<CommunityStats>({ members: 2480, threads: 1200, posts: 2480, categories: 5 });
const threads = computed<Thread[]>(() =>
  databaseReady.value
    ? databaseThreads.value.map((thread, index) => ({
        id: thread.id,
        title: thread.title,
        excerpt: thread.excerpt,
        category: thread.category,
        author: thread.author || '멤버',
        initials: (thread.author || '멤버').slice(0, 1),
        color: ['peach', 'blue', 'lavender', 'mint', 'yellow', 'pink'][index % 6]!,
        time: formatThreadTime(thread.lastPostAt || thread.createdAt),
        replies: Math.max(0, thread.replyCount - 1),
        views: '—',
        featured: thread.isPinned,
        isBookmarked: thread.isBookmarked,
      }))
    : demoThreads.value
);

const selectedCategory = ref('전체');
const activeTab = ref('인기');
const search = ref('');
const following = ref(false);
const composerOpen = ref(false);
const draftTitle = ref('');
const draftBody = ref('');
const draftCategorySlug = ref('lounge');
const notice = ref('');
const threadDetail = ref<ThreadDetail | null>(null);
const threadDetailOpen = ref(false);
const replyDraft = ref('');
const reportOpen = ref(false);
const reportReason = ref('spam');
const reportDetails = ref('');
const moderationOpen = ref(false);
const moderationReports = ref<ModerationReport[]>([]);
const moderationCategories = ref<CommunityCategory[]>([]);
const newCategoryName = ref('');
const newCategorySlug = ref('');
const newForumOpen = ref(false);
const newForumName = ref('');
const newForumSlug = ref('');
const profileOpen = ref(false);
const profileName = ref('');
const forumApi = (path = '') => `/api/forums/${encodeURIComponent(forumSlug.value)}${path}`;
let feedRequestId = 0;
let feedSearchTimer: ReturnType<typeof setTimeout> | undefined;

async function loadCommunity() {
  databaseReady.value = false;
  databaseThreads.value = [];
  hasMoreThreads.value = false;
  feedRequestId += 1;
  isLoadingThreads.value = false;
  try {
    const [loadedCategories, loadedStats, currentForum] = await Promise.all([
      $fetch<CommunityCategory[]>(forumApi('/categories')),
      $fetch<CommunityStats>(forumApi('/stats')),
      $fetch<CommunityInfo>(forumApi()),
    ]);
    forumCategories.value = loadedCategories;
    stats.value = loadedStats;
    forumName.value = currentForum.name;
    categories.value = [
      { name: '전체', icon: '✳', count: String(loadedStats.threads) },
      ...loadedCategories.map((category) => ({
        name: category.name,
        icon: demoCategories.find((item) => item.name === category.name)?.icon || '◈',
        count: String(category.threadCount),
      })),
    ];
    databaseReady.value = true;
    await loadFeed();
    await refreshFollowState();
  } catch {
    databaseThreads.value = [];
    forumCategories.value = [];
    // Keep the local concept feed visible when the D1 binding is not configured yet.
  }
}

async function loadFeed(offset = 0, append = false) {
  const requestId = ++feedRequestId;
  isLoadingThreads.value = true;
  const params: Record<string, string | number> = {
    limit: 20,
    offset,
    sort: activeTab.value === '최신' ? 'latest' : 'activity',
  };
  const query = search.value.trim();
  const category = forumCategories.value.find((item) => item.name === selectedCategory.value);
  if (query) params.q = query;
  if (category) params.category = category.slug;

  try {
    const loaded = await $fetch<CommunityThread[]>(forumApi('/threads'), { params });
    if (requestId !== feedRequestId) return;
    databaseThreads.value = append ? [...databaseThreads.value, ...loaded] : loaded;
    hasMoreThreads.value = loaded.length === 20;
  } catch {
    if (requestId === feedRequestId) showNotice('이야기를 불러오지 못했어요.');
  } finally {
    if (requestId === feedRequestId) isLoadingThreads.value = false;
  }
}

async function loadMoreThreads() {
  if (!databaseReady.value || isLoadingThreads.value || !hasMoreThreads.value) return;
  await loadFeed(databaseThreads.value.length, true);
}

async function loadMyForums() {
  if (!loggedIn.value) return;
  try {
    const loaded = await $fetch<CommunityInfo[]>('/api/my-forums');
    myForums.value = [
      ...new Map(
        [{ id: 1, slug: 'cy-thread', name: 'CY Thread' }, ...loaded].map((forum) => [
          forum.slug,
          forum,
        ])
      ).values(),
    ];
  } catch {
    // Community discovery remains available when a signed-in user's memberships are empty.
  }
}

async function selectForum(forum: CommunityInfo) {
  forumSlug.value = forum.slug;
  forumName.value = forum.name;
  selectedCategory.value = '전체';
  search.value = '';
  if (import.meta.client) localStorage.setItem('cy-thread-forum', forum.slug);
  await loadCommunity();
}

function openNewForum() {
  if (!loggedIn.value) return startLogin();
  newForumName.value = '';
  newForumSlug.value = '';
  newForumOpen.value = true;
}

async function createForum() {
  try {
    const forum = await $fetch<CommunityInfo>('/api/forums', {
      method: 'POST',
      body: { name: newForumName.value.trim(), slug: newForumSlug.value.trim() },
    });
    myForums.value = [...myForums.value.filter((item) => item.slug !== forum.slug), forum];
    newForumOpen.value = false;
    await selectForum(forum);
    showNotice('새 커뮤니티를 만들었어요.');
  } catch {
    showNotice('커뮤니티를 만들지 못했어요. 주소가 이미 사용 중인지 확인해 주세요.');
  }
}

async function refreshFollowState() {
  if (!databaseReady.value) return;
  try {
    const response = await $fetch<{ following: boolean }>(forumApi('/follow'));
    following.value = response.following;
  } catch {
    following.value = false;
  }
}

onMounted(async () => {
  forumSlug.value = localStorage.getItem('cy-thread-forum') || 'cy-thread';
  const [status] = await Promise.all([
    $fetch<{ google: boolean }>('/api/auth/provider-status').catch(() => ({ google: false })),
    loadCommunity(),
    loadMyForums(),
  ]);
  googleAuthEnabled.value = status.google;
});

function formatThreadTime(value: string | null) {
  if (!value) return '방금 전';
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

function formatCount(value: number) {
  return new Intl.NumberFormat('ko-KR').format(value);
}

const visibleThreads = computed(() => {
  if (databaseReady.value) return threads.value;
  const query = search.value.trim().toLowerCase();
  const filtered = threads.value.filter(
    (thread) =>
      (selectedCategory.value === '전체' || thread.category === selectedCategory.value) &&
      (!query ||
        `${thread.title} ${thread.excerpt} ${thread.category} ${thread.author}`
          .toLowerCase()
          .includes(query))
  );
  return activeTab.value === '최신' ? [...filtered].reverse() : filtered;
});

watch([selectedCategory, search, activeTab], () => {
  if (!databaseReady.value) return;
  clearTimeout(feedSearchTimer);
  feedSearchTimer = setTimeout(() => {
    void loadFeed();
  }, 220);
});

function showNotice(message: string) {
  notice.value = message;
  setTimeout(() => {
    notice.value = '';
  }, 2600);
}

function startLogin() {
  if (!googleAuthEnabled.value) {
    showNotice('Google 로그인 키를 설정하면 가입할 수 있어요.');
    return;
  }
  window.location.assign('/api/auth/google');
}

function openComposer() {
  const selected = forumCategories.value.find(
    (category) => category.name === selectedCategory.value
  );
  draftCategorySlug.value = selected?.slug || forumCategories.value[0]?.slug || 'lounge';
  composerOpen.value = true;
}

async function handleAccountAction() {
  if (!loggedIn.value) {
    startLogin();
    return;
  }
  await clearSession();
  following.value = false;
  showNotice('로그아웃했어요.');
}

function openProfile() {
  if (!loggedIn.value) return startLogin();
  profileName.value = sessionUser.value?.name || '';
  profileOpen.value = true;
}

async function saveProfile() {
  try {
    const result = await $fetch<{ name: string }>('/api/account/profile', {
      method: 'PATCH',
      body: { name: profileName.value },
    });
    if (sessionUser.value) sessionUser.value.name = result.name;
    profileOpen.value = false;
    showNotice('프로필을 저장했어요.');
  } catch {
    showNotice('이름을 저장하지 못했어요. 2~40자로 입력해 주세요.');
  }
}

async function createThread() {
  const title = draftTitle.value.trim();
  const body = draftBody.value.trim();
  if (!title || !body) return;
  if (!loggedIn.value) {
    startLogin();
    return;
  }
  const categorySlug = forumCategories.value.find(
    (category) => category.slug === draftCategorySlug.value
  )?.slug;
  if (!databaseReady.value || !categorySlug) {
    showNotice('커뮤니티 데이터베이스를 연결한 뒤 게시할 수 있어요.');
    return;
  }
  try {
    await $fetch(forumApi('/threads'), {
      method: 'POST',
      body: { title, body, categorySlug, turnstileToken: threadTurnstileToken.value },
    });
  } catch {
    showNotice('글을 게시하지 못했어요. 잠시 후 다시 시도해 주세요.');
    return;
  }
  selectedCategory.value = '전체';
  activeTab.value = '최신';
  composerOpen.value = false;
  draftTitle.value = '';
  draftBody.value = '';
  threadTurnstileToken.value = '';
  await loadCommunity();
  showNotice('새 이야기를 올렸어요.');
}

async function toggleFollow() {
  if (!loggedIn.value) {
    startLogin();
    return;
  }
  if (!databaseReady.value) return showNotice('커뮤니티 데이터베이스가 연결되지 않았어요.');
  try {
    const result = await $fetch<{ following: boolean }>(forumApi('/follow'), {
      method: 'POST',
      body: { following: !following.value },
    });
    following.value = result.following;
  } catch {
    showNotice('팔로우 상태를 바꾸지 못했어요.');
  }
}

async function saveThread(thread: Thread) {
  if (!loggedIn.value) {
    startLogin();
    return;
  }
  if (!databaseReady.value) return showNotice('커뮤니티 데이터베이스가 연결되지 않았어요.');
  try {
    const result = await $fetch<{ bookmarked: boolean }>(
      forumApi(`/threads/${thread.id}/bookmark`),
      {
        method: 'POST',
        body: { bookmarked: !thread.isBookmarked },
      }
    );
    const savedThread = databaseThreads.value.find((item) => item.id === thread.id);
    if (savedThread) savedThread.isBookmarked = result.bookmarked;
  } catch {
    showNotice('저장 상태를 바꾸지 못했어요.');
  }
}

async function openThread(thread: Thread) {
  try {
    threadDetail.value = await $fetch<ThreadDetail>(forumApi(`/threads/${thread.id}`));
    threadDetailOpen.value = true;
    replyDraft.value = '';
    reportOpen.value = false;
  } catch {
    showNotice('이 이야기를 불러오지 못했어요.');
  }
}

async function deleteThread() {
  if (!threadDetail.value || !window.confirm('이 글과 댓글을 숨길까요? 운영 기록은 유지됩니다.'))
    return;
  const threadId = threadDetail.value.id;
  try {
    await $fetch(forumApi(`/threads/${threadId}`), { method: 'DELETE' });
    threadDetailOpen.value = false;
    threadDetail.value = null;
    await loadCommunity();
    showNotice('글과 댓글을 숨겼어요.');
  } catch {
    showNotice('글을 삭제하지 못했어요.');
  }
}

async function sendReply() {
  if (!threadDetail.value) return;
  if (!loggedIn.value) return startLogin();
  try {
    await $fetch(forumApi(`/threads/${threadDetail.value.id}/posts`), {
      method: 'POST',
      body: { body: replyDraft.value, turnstileToken: replyTurnstileToken.value },
    });
    replyDraft.value = '';
    replyTurnstileToken.value = '';
    await openThread({ id: threadDetail.value.id } as Thread);
    await loadCommunity();
    showNotice('댓글을 남겼어요.');
  } catch {
    showNotice('댓글을 등록하지 못했어요.');
  }
}

async function submitReport() {
  if (!threadDetail.value) return;
  if (!loggedIn.value) return startLogin();
  try {
    const result = await $fetch<{ submitted: boolean }>(
      forumApi(`/threads/${threadDetail.value.id}/report`),
      {
        method: 'POST',
        body: {
          reason: reportReason.value,
          details: reportDetails.value,
          turnstileToken: reportTurnstileToken.value,
        },
      }
    );
    reportOpen.value = false;
    reportDetails.value = '';
    reportTurnstileToken.value = '';
    showNotice(result.submitted ? '신고가 운영진에게 전달됐어요.' : '이미 접수된 신고가 있어요.');
  } catch {
    showNotice('신고를 접수하지 못했어요.');
  }
}

async function openModeration() {
  try {
    const [reports] = await Promise.all([
      $fetch<ModerationReport[]>(forumApi('/moderation/reports')),
      loadCommunity(),
    ]);
    moderationReports.value = reports;
    moderationCategories.value = forumCategories.value;
    moderationOpen.value = true;
  } catch {
    showNotice('운영진만 신고함을 확인할 수 있어요.');
  }
}

async function cleanupAbandonedUploads() {
  if (!window.confirm('24시간 이상 게시물에 연결되지 않은 이미지를 삭제할까요?')) return;
  try {
    const result = await $fetch<{ removed: number; failed: number }>(
      forumApi('/moderation/attachments/cleanup'),
      { method: 'POST' }
    );
    showNotice(
      result.failed
        ? `${result.removed}개 정리, ${result.failed}개 실패`
        : `${result.removed}개의 미연결 이미지를 정리했어요.`
    );
  } catch {
    showNotice('미연결 이미지를 정리하지 못했어요.');
  }
}

async function createCategory() {
  try {
    await $fetch(forumApi('/moderation/categories'), {
      method: 'POST',
      body: { name: newCategoryName.value.trim(), slug: newCategorySlug.value.trim() },
    });
    newCategoryName.value = '';
    newCategorySlug.value = '';
    await loadCommunity();
    moderationCategories.value = forumCategories.value;
    showNotice('카테고리를 추가했어요.');
  } catch {
    showNotice('카테고리를 추가하지 못했어요. 주소를 확인해 주세요.');
  }
}

async function saveCategory(category: CommunityCategory) {
  try {
    await $fetch(forumApi(`/moderation/categories/${category.id}`), {
      method: 'PATCH',
      body: { name: category.name, slug: category.slug },
    });
    await loadCommunity();
    moderationCategories.value = forumCategories.value;
    showNotice('카테고리를 수정했어요.');
  } catch {
    showNotice('카테고리를 수정하지 못했어요. 이름과 주소를 확인해 주세요.');
  }
}

async function removeCategory(category: CommunityCategory) {
  if (
    !window.confirm(
      `“${category.name}” 카테고리를 삭제할까요? 글이나 숨김 기록이 있는 카테고리는 삭제할 수 없어요.`
    )
  )
    return;
  try {
    await $fetch(forumApi(`/moderation/categories/${category.id}`), { method: 'DELETE' });
    await loadCommunity();
    moderationCategories.value = forumCategories.value;
    showNotice('카테고리를 삭제했어요.');
  } catch {
    showNotice('글 또는 숨김 기록이 있는 카테고리는 삭제할 수 없어요.');
  }
}

async function reviewReport(report: ModerationReport, status: 'resolved' | 'dismissed') {
  try {
    await $fetch(forumApi(`/moderation/reports/${report.id}`), {
      method: 'PATCH',
      body: { status },
    });
    moderationReports.value = moderationReports.value.filter((item) => item.id !== report.id);
  } catch {
    showNotice('신고 상태를 변경하지 못했어요.');
  }
}

async function banReportedAuthor(report: ModerationReport) {
  if (!report.threadAuthorUserId) return;
  try {
    await $fetch(forumApi('/moderation/bans'), {
      method: 'POST',
      body: {
        userId: report.threadAuthorUserId,
        banned: true,
        reason: `신고 검토: ${report.reason}`,
      },
    });
    await reviewReport(report, 'resolved');
    showNotice('신고된 멤버를 차단했어요.');
  } catch {
    showNotice('멤버를 차단하지 못했어요.');
  }
}

async function moderateThread(action: 'lock' | 'pin') {
  if (!threadDetail.value || !threadDetail.value.canModerate) return;
  const current = threadDetail.value;
  try {
    const updated = await $fetch<{ isLocked: boolean; isPinned: boolean }>(
      forumApi(`/moderation/threads/${current.id}`),
      {
        method: 'PATCH',
        body:
          action === 'lock'
            ? { isLocked: !current.isLocked }
            : {
                isPinned: !databaseThreads.value.find((thread) => thread.id === current.id)
                  ?.isPinned,
              },
      }
    );
    current.isLocked = updated.isLocked;
    const feedThread = databaseThreads.value.find((thread) => thread.id === current.id);
    if (feedThread) feedThread.isPinned = updated.isPinned;
    await loadCommunity();
  } catch {
    showNotice('운영 설정을 저장하지 못했어요.');
  }
}
</script>

<template>
  <div class="site-shell min-h-screen bg-cy-canvas text-cy-ink">
    <header class="topbar sticky top-0 z-20 bg-white/95 backdrop-blur-sm">
      <a class="brand" href="#top" aria-label="CY Thread 홈"
        ><span class="brand-mark">c<span>y</span></span
        ><span class="brand-word">thread<span class="brand-dot">.</span></span></a
      >
      <nav class="main-nav" aria-label="주 메뉴">
        <a class="nav-active" href="#discover">둘러보기</a><a href="#about">커뮤니티 소개</a>
        <NuxtLink :to="`/forums/${forumSlug}/threads`">이야기 목록</NuxtLink>
      </nav>
      <div class="header-actions">
        <template v-if="loggedIn"
          ><button class="text-button" @click="openProfile">{{ sessionUser?.name }} · 프로필</button
          ><button class="text-button" @click="handleAccountAction">로그아웃</button></template
        ><template v-else
          ><button class="text-button" @click="startLogin">로그인</button
          ><button class="join-button" @click="startLogin">
            Google로 시작하기 <span>↗</span>
          </button></template
        >
      </div>
    </header>

    <main id="top">
      <section class="hero mx-auto" id="about">
        <div class="hero-copy">
          <div class="eyebrow"><span class="live-dot" /> 함께 만드는 커뮤니티</div>
          <h1>좋아하는 이야기가<br />이어지는 곳<span class="hero-period">.</span></h1>
          <p>
            관심사가 같은 사람들이 모여 질문하고, 나누고,<br class="desktop-break" />
            함께 성장하는 작은 커뮤니티를 시작해요.
          </p>
          <div class="hero-buttons">
            <button class="primary-button" @click="openComposer">
              첫 이야기 시작하기 <span>↗</span></button
            ><a class="link-button" href="#discover">커뮤니티 둘러보기 <span>↓</span></a>
          </div>
          <div class="member-proof">
            <div class="avatar-stack">
              <span class="mini-avatar peach">민</span><span class="mini-avatar blue">도</span
              ><span class="mini-avatar lavender">서</span><span class="mini-avatar mint">+ </span>
            </div>
            <span
              ><strong>{{ formatCount(stats.members) }}</strong
              >명의 멤버가 함께하고 있어요</span
            >
          </div>
        </div>
        <div class="hero-art" aria-label="대화가 이어지는 커뮤니티를 표현한 일러스트">
          <div class="art-orbit orbit-one" />
          <div class="art-orbit orbit-two" />
          <div class="art-spark spark-one">✳</div>
          <div class="art-spark spark-two">✦</div>
          <div class="art-bubble bubble-back">
            <span class="bubble-avatar blue">도</span>
            <div><i /><i /></div>
          </div>
          <div class="art-bubble bubble-main">
            <span class="bubble-avatar peach">민</span>
            <div class="bubble-lines"><i /><i /><i /></div>
            <span class="bubble-heart">♥</span>
          </div>
          <div class="art-bubble bubble-front">
            <span class="bubble-avatar lavender">서</span>
            <div class="bubble-lines"><i /><i /></div>
            <span class="bubble-check">↗</span>
          </div>
          <div class="art-center">
            <span class="center-mark">c<span>y</span></span
            ><span>이야기가 모이는 곳</span>
          </div>
          <div class="art-label label-top">아이디어를 나누고 <b>✦</b></div>
          <div class="art-label label-bottom"><b>↗</b> 같이 성장해요</div>
        </div>
      </section>

      <section class="stats-strip" aria-label="커뮤니티 현황">
        <div>
          <strong>{{ formatCount(stats.members) }}</strong
          ><small>함께하는 멤버</small>
        </div>
        <div>
          <strong>{{ formatCount(stats.threads) }}</strong
          ><small>나눈 이야기</small>
        </div>
        <div>
          <strong>{{ formatCount(stats.categories) }}</strong
          ><small>이야기 주제</small>
        </div>
        <div class="stats-note">
          <span class="sparkle">✳</span
          ><span>좋은 대화는<br /><b>좋은 사람들</b>에서 시작돼요.</span>
        </div>
      </section>

      <section class="community mx-auto" id="discover">
        <aside class="sidebar">
          <div class="sidebar-heading">
            <span>커뮤니티</span
            ><button aria-label="커뮤니티 만들기" @click="openNewForum">＋</button>
          </div>
          <button
            v-for="forum in myForums"
            :key="forum.slug"
            class="community-card"
            :class="{ selected: forumSlug === forum.slug }"
            @click="selectForum(forum)"
          >
            <span class="community-icon">{{ forum.name.slice(0, 1) }}</span
            ><span class="community-name"
              ><strong>{{ forum.name }}</strong
              ><small>{{ forum.slug }}</small></span
            ><span class="chevron">›</span>
          </button>
          <div class="sidebar-heading category-heading">
            <span>카테고리</span><span class="category-count">{{ categories.length - 1 }}</span>
          </div>
          <div class="category-list">
            <button
              v-for="category in categories"
              :key="category.name"
              class="category-button"
              :class="{ selected: selectedCategory === category.name }"
              @click="selectedCategory = category.name"
            >
              <span class="category-icon">{{ category.icon }}</span
              ><span>{{ category.name }}</span
              ><small v-if="category.name !== '전체'">{{ category.count }}</small>
            </button>
          </div>
          <NuxtLink class="moderation-link" :to="`/forums/${forumSlug}/reports`">
            운영 신고함 <span>↗</span>
          </NuxtLink>
          <NuxtLink class="moderation-link" :to="`/forums/${forumSlug}/admin`">
            운영 관리 <span>↗</span>
          </NuxtLink>
          <div class="sidebar-promo">
            <span class="promo-icon">✳</span><strong>나만의 커뮤니티를<br />만들어 보세요</strong>
            <p>사람들이 모이고 대화하는 공간을 직접 꾸며요.</p>
            <button @click="openNewForum">커뮤니티 만들기 <span>↗</span></button>
          </div>
          <div class="sidebar-foot">
            <a href="#about">소개</a><a href="#about">이용 가이드</a><a href="#about">개인정보</a
            ><span>© 2026 CY Thread</span>
          </div>
        </aside>

        <div class="feed-column">
          <div class="feed-header">
            <div>
              <div class="section-kicker">CY THREAD COMMUNITY</div>
              <h2>오늘의 이야기<span>.</span></h2>
              <p>궁금한 것을 묻고, 아는 것을 나누며 함께 자라요.</p>
            </div>
            <button class="compose-button" @click="openComposer"><span>＋</span> 글쓰기</button>
          </div>
          <div class="feed-toolbar">
            <div class="feed-tabs">
              <button
                v-for="tab in ['인기', '최신']"
                :key="tab"
                :class="{ active: activeTab === tab }"
                @click="activeTab = tab"
              >
                {{ tab }}<span v-if="tab === '인기'">✦</span>
              </button>
            </div>
            <label class="search-box"
              ><span>⌕</span
              ><input v-model="search" aria-label="이야기 검색" placeholder="이야기 검색" /><kbd
                >⌘ K</kbd
              ></label
            >
          </div>
          <div v-if="selectedCategory !== '전체' || search" class="filter-summary">
            <span>{{ selectedCategory === '전체' ? '전체 카테고리' : selectedCategory }}</span
            ><span v-if="search">· “{{ search }}” 검색</span
            ><button
              @click="
                selectedCategory = '전체';
                search = '';
              "
            >
              초기화 ×
            </button>
          </div>
          <div v-if="visibleThreads.length" class="thread-list">
            <article
              v-for="(thread, index) in visibleThreads"
              :key="thread.id"
              class="thread-card"
              :class="{
                'featured-card':
                  thread.featured && !search && selectedCategory === '전체' && index === 0,
              }"
            >
              <div
                v-if="thread.featured && !search && selectedCategory === '전체' && index === 0"
                class="featured-label"
              >
                <span>✦</span> 이번 주 인기 이야기
              </div>
              <div class="thread-topline">
                <span
                  class="thread-category"
                  :class="
                    thread.category === '사이드 프로젝트'
                      ? 'tag-purple'
                      : thread.category === '커리어'
                        ? 'tag-blue'
                        : thread.category === '개발 이야기'
                          ? 'tag-green'
                          : 'tag-orange'
                  "
                  >{{ thread.category }}</span
                ><span class="thread-time">{{ thread.time }}</span
                ><button
                  class="more-button"
                  aria-label="더 보기"
                  @click="notice = '이야기 메뉴를 준비하고 있어요.'"
                >
                  ···
                </button>
              </div>
              <h3>
                <NuxtLink
                  class="thread-title-button"
                  :to="`/forums/${forumSlug}/threads/${thread.id}`"
                >
                  {{ thread.title }}
                </NuxtLink>
              </h3>
              <p class="thread-excerpt">{{ thread.excerpt }}</p>
              <div class="thread-footer">
                <div class="author">
                  <span class="avatar" :class="thread.color">{{ thread.initials }}</span
                  ><span>{{ thread.author }}<small> · 멤버</small></span>
                </div>
                <div class="thread-metrics">
                  <span><b>↩</b> {{ thread.replies }} 댓글</span
                  ><span v-if="thread.views !== '—'"><b>◉</b> {{ thread.views }}</span
                  ><button
                    class="bookmark"
                    :aria-label="thread.isBookmarked ? '저장 해제' : '저장'"
                    @click="saveThread(thread)"
                  >
                    {{ thread.isBookmarked ? '✓' : '♧' }}
                  </button>
                </div>
              </div>
            </article>
          </div>
          <div v-else class="empty-state">
            <span>⌕</span><strong>이야기를 찾지 못했어요</strong>
            <p>다른 검색어를 입력하거나 카테고리를 바꿔 보세요.</p>
            <button
              @click="
                selectedCategory = '전체';
                search = '';
              "
            >
              전체 이야기 보기
            </button>
          </div>
          <button
            class="load-more"
            :disabled="!hasMoreThreads || isLoadingThreads"
            @click="loadMoreThreads"
          >
            {{
              isLoadingThreads
                ? '불러오는 중…'
                : hasMoreThreads
                  ? '더 많은 이야기 보기'
                  : '모든 이야기를 불러왔어요'
            }}<span v-if="hasMoreThreads">↓</span>
          </button>
        </div>

        <aside class="right-rail">
          <div class="welcome-card">
            <div class="welcome-top">
              <span class="welcome-spark">✳</span
              ><span class="online-pill"><i /> 공개 커뮤니티</span>
            </div>
            <h3>
              반가워요,<br />여기는 <em>{{ forumName }}</em
              >예요.
            </h3>
            <p>작은 질문 하나가 좋은 대화의 시작이 될 수 있어요.</p>
            <button @click="openComposer">첫 글 남기기 <span>↗</span></button>
            <div class="welcome-decoration">c<span>y</span></div>
          </div>
          <div class="trending-block">
            <div class="rail-heading">
              <h3>지금 많이 이야기해요</h3>
              <button @click="activeTab = '인기'">더 보기 ↗</button>
            </div>
            <a
              v-for="(item, index) in threads.slice(0, 3)"
              :key="item.id"
              :href="`/forums/${forumSlug}/threads/${item.id}`"
              class="trending-item"
              @click="selectedCategory = item.category"
              ><span class="trend-rank">0{{ index + 1 }}</span
              ><span class="trend-copy"
                ><strong>{{ item.title }}</strong
                ><small>{{ item.category }} · 댓글 {{ item.replies }}</small></span
              ></a
            >
          </div>
          <div class="online-card">
            <div class="online-avatars">
              <span class="mini-avatar peach">민</span><span class="mini-avatar mint">준</span
              ><span class="mini-avatar blue">도</span><span class="mini-avatar lavender">서</span>
            </div>
            <div>
              <strong>{{ formatCount(stats.members) }}명의 멤버가 함께해요</strong>
              <p>들어와서 인사해 보세요!</p>
            </div>
            <span class="online-arrow">↗</span>
          </div>
          <div class="follow-card">
            <div class="follow-icon">✳</div>
            <h3>좋은 대화를<br />놓치지 마세요</h3>
            <p>커뮤니티를 팔로우하고 새 이야기를 받아보세요.</p>
            <button :class="{ followed: following }" @click="toggleFollow">
              {{ following ? '✓ 팔로우 중' : '커뮤니티 팔로우' }}
            </button>
          </div>
        </aside>
      </section>
    </main>

    <footer class="page-footer">
      <a class="brand footer-brand" href="#top"
        ><span class="brand-mark">c<span>y</span></span
        ><span class="brand-word">thread<span class="brand-dot">.</span></span></a
      ><span>좋아하는 이야기가 이어지는 곳.</span>
      <div>
        <a href="#about">커뮤니티 가이드</a><a href="#about">문의하기</a
        ><span>© 2026 CY Thread</span>
      </div>
    </footer>
    <Transition name="toast"
      ><div v-if="notice" class="toast-message"><span>✳</span>{{ notice }}</div></Transition
    >
    <div v-if="composerOpen" class="modal-backdrop" @click.self="composerOpen = false">
      <section
        class="composer-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="composer-title"
      >
        <div class="modal-top">
          <div>
            <span class="section-kicker">CY THREAD COMMUNITY</span>
            <h2 id="composer-title">새 이야기 시작하기</h2>
          </div>
          <button class="modal-close" aria-label="닫기" @click="composerOpen = false">×</button>
        </div>
        <label class="field-label" for="thread-category">카테고리</label
        ><select id="thread-category" v-model="draftCategorySlug" class="composer-title-input">
          <option v-for="category in forumCategories" :key="category.id" :value="category.slug">
            {{ category.name }}
          </option></select
        ><label class="field-label" for="thread-title">제목</label
        ><input
          id="thread-title"
          v-model="draftTitle"
          class="composer-title-input"
          maxlength="120"
          placeholder="어떤 이야기를 나누고 싶나요?"
        /><label class="field-label" for="thread-body">내용</label
        ><ClientOnly
          ><ToastEditor
            id="thread-body-editor"
            :content="draftBody"
            :forum-slug="forumSlug"
            @update:content="draftBody = $event" /><template #fallback>
            <textarea
              id="thread-body"
              v-model="draftBody"
              rows="5"
              maxlength="20000"
              required
              placeholder="생각과 질문을 편하게 적어 주세요..."
            ></textarea></template></ClientOnly
        ><ClientOnly v-if="turnstile.siteKey"
          ><NuxtTurnstile v-model="threadTurnstileToken" :options="{ sitekey: turnstile.siteKey }"
        /></ClientOnly>
        <div class="composer-bottom">
          <span><span class="composer-avatar">나</span> {{ forumName }}에 게시</span
          ><button
            class="primary-button"
            :disabled="
              !draftTitle.trim() ||
              !draftBody.trim() ||
              (turnstile.siteKey && !threadTurnstileToken)
            "
            @click="createThread"
          >
            게시하기 <span>↗</span>
          </button>
        </div>
      </section>
    </div>
    <div v-if="profileOpen" class="modal-backdrop" @click.self="profileOpen = false">
      <section
        class="composer-modal profile-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-title"
      >
        <div class="modal-top">
          <div>
            <span class="section-kicker">YOUR ACCOUNT</span>
            <h2 id="profile-title">프로필 설정</h2>
          </div>
          <button class="modal-close" aria-label="닫기" @click="profileOpen = false">×</button>
        </div>
        <label class="field-label" for="profile-name">표시 이름</label
        ><input
          id="profile-name"
          v-model="profileName"
          class="composer-title-input"
          maxlength="40"
          placeholder="커뮤니티에서 사용할 이름"
        />
        <p class="forum-slug-help">2~40자로 입력해 주세요. 게시글과 댓글에 이 이름이 표시됩니다.</p>
        <div class="composer-bottom">
          <span>{{ sessionUser?.email }}</span
          ><button
            class="primary-button"
            :disabled="profileName.trim().length < 2"
            @click="saveProfile"
          >
            저장하기 <span>↗</span>
          </button>
        </div>
      </section>
    </div>
    <div v-if="newForumOpen" class="modal-backdrop" @click.self="newForumOpen = false">
      <section
        class="composer-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-forum-title"
      >
        <div class="modal-top">
          <div>
            <span class="section-kicker">CREATE A COMMUNITY</span>
            <h2 id="new-forum-title">새 커뮤니티 만들기</h2>
          </div>
          <button class="modal-close" aria-label="닫기" @click="newForumOpen = false">×</button>
        </div>
        <label class="field-label" for="new-forum-name">커뮤니티 이름</label
        ><input
          id="new-forum-name"
          v-model="newForumName"
          class="composer-title-input"
          maxlength="60"
          placeholder="예: 주말 사이드 프로젝트 모임"
        /><label class="field-label" for="new-forum-slug">커뮤니티 주소</label
        ><input
          id="new-forum-slug"
          v-model="newForumSlug"
          class="composer-title-input"
          maxlength="50"
          pattern="[a-z0-9-]+"
          placeholder="weekend-builders"
        />
        <p class="forum-slug-help">
          영문 소문자, 숫자, 하이픈을 사용해 주세요. 만들면 기본 카테고리 3개가 함께 생겨요.
        </p>
        <div class="composer-bottom">
          <span>내 커뮤니티로 생성됩니다</span
          ><button
            class="primary-button"
            :disabled="newForumName.trim().length < 2 || !newForumSlug.trim()"
            @click="createForum"
          >
            만들기 <span>↗</span>
          </button>
        </div>
      </section>
    </div>
    <div
      v-if="threadDetailOpen && threadDetail"
      class="modal-backdrop"
      @click.self="threadDetailOpen = false"
    >
      <section class="detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title">
        <div class="modal-top">
          <div>
            <span class="section-kicker">{{ threadDetail.category }} · CY THREAD</span>
            <h2 id="detail-title">{{ threadDetail.title }}</h2>
          </div>
          <div class="detail-header-actions">
            <button
              v-if="threadDetail.isAuthor || threadDetail.canModerate"
              class="delete-thread-button"
              @click="deleteThread"
            >
              글 삭제</button
            ><button class="modal-close" aria-label="닫기" @click="threadDetailOpen = false">
              ×
            </button>
          </div>
        </div>
        <div class="detail-posts">
          <article v-for="reply in threadDetail.replies" :key="reply.id" class="detail-post">
            <div class="detail-author">
              <span class="composer-avatar">{{ (reply.author || '멤버').slice(0, 1) }}</span
              ><strong>{{ reply.author || '멤버' }}</strong
              ><small>{{ formatThreadTime(reply.createdAt) }}</small
              ><span v-if="reply.id === threadDetail.replies[0]?.id" class="original-post"
                >원글</span
              >
            </div>
            <ClientOnly
              ><ToastViewer :id="`post-${reply.id}`" :model-value="reply.markdown" /><template
                #fallback
                ><p>{{ reply.markdown }}</p></template
              ></ClientOnly
            >
          </article>
        </div>
        <div v-if="threadDetail.canModerate" class="moderator-tools">
          <strong>운영 도구</strong
          ><button @click="moderateThread('pin')">
            {{
              databaseThreads.find((item) => item.id === threadDetail?.id)?.isPinned
                ? '고정 해제'
                : '글 고정'
            }}</button
          ><button @click="moderateThread('lock')">
            {{ threadDetail.isLocked ? '댓글 잠금 해제' : '댓글 잠금' }}
          </button>
        </div>
        <div v-if="!threadDetail.isLocked" class="reply-composer">
          <label class="field-label" for="reply-body">댓글 남기기</label
          ><ClientOnly
            ><ToastEditor
              id="reply-body-editor"
              :content="replyDraft"
              :forum-slug="forumSlug"
              @update:content="replyDraft = $event" /><template #fallback>
              <textarea
                id="reply-body"
                v-model="replyDraft"
                rows="3"
                maxlength="20000"
                placeholder="대화를 이어가 보세요..."
              ></textarea></template></ClientOnly
          ><ClientOnly v-if="turnstile.siteKey"
            ><NuxtTurnstile v-model="replyTurnstileToken" :options="{ sitekey: turnstile.siteKey }"
          /></ClientOnly>
          <div class="reply-actions">
            <button
              v-if="sessionUser?.id !== threadDetail.authorId"
              class="report-link"
              @click="reportOpen = !reportOpen"
            >
              신고</button
            ><button
              class="primary-button"
              :disabled="!replyDraft.trim() || (turnstile.siteKey && !replyTurnstileToken)"
              @click="sendReply"
            >
              댓글 등록
            </button>
          </div>
          <div v-if="reportOpen" class="report-form">
            <label class="field-label" for="report-reason">신고 사유</label
            ><select id="report-reason" v-model="reportReason" class="composer-title-input">
              <option value="spam">스팸 또는 광고</option>
              <option value="harassment">괴롭힘 또는 혐오</option>
              <option value="unsafe">위험하거나 불법적인 내용</option>
              <option value="other">기타</option></select
            ><textarea
              v-model="reportDetails"
              rows="2"
              maxlength="1000"
              placeholder="운영진이 확인할 내용을 적어 주세요 (선택)"
            ></textarea
            ><ClientOnly v-if="turnstile.siteKey"
              ><NuxtTurnstile
                v-model="reportTurnstileToken"
                :options="{ sitekey: turnstile.siteKey }" /></ClientOnly
            ><button
              class="primary-button"
              :disabled="turnstile.siteKey && !reportTurnstileToken"
              @click="submitReport"
            >
              신고 접수
            </button>
          </div>
        </div>
        <p v-else class="locked-note">운영진이 댓글을 잠근 이야기입니다.</p>
      </section>
    </div>
    <div v-if="moderationOpen" class="modal-backdrop" @click.self="moderationOpen = false">
      <section
        class="composer-modal moderation-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="moderation-title"
      >
        <div class="modal-top">
          <div>
            <span class="section-kicker">COMMUNITY SAFETY</span>
            <h2 id="moderation-title">열린 신고</h2>
          </div>
          <button class="modal-close" aria-label="닫기" @click="moderationOpen = false">×</button>
        </div>
        <div v-if="moderationReports.length" class="report-list">
          <article v-for="report in moderationReports" :key="report.id" class="report-item">
            <strong>{{
              report.threadDeleted ? '숨김 처리된 이야기' : report.threadTitle || '삭제된 이야기'
            }}</strong>
            <p>{{ report.reason }} · {{ report.details || '추가 설명 없음' }}</p>
            <small
              >신고자 {{ report.reporter || '멤버' }} ·
              {{ formatThreadTime(report.createdAt) }}</small
            >
            <div class="report-actions">
              <button @click="reviewReport(report, 'dismissed')">문제 없음</button
              ><button @click="reviewReport(report, 'resolved')">처리 완료</button
              ><button @click="banReportedAuthor(report)">작성자 차단</button>
            </div>
          </article>
        </div>
        <p v-else class="locked-note">확인할 열린 신고가 없습니다.</p>
        <section class="category-admin">
          <div class="category-admin-heading">
            <strong>카테고리 관리</strong><small>글이 없는 카테고리만 삭제할 수 있어요.</small>
          </div>
          <button class="cleanup-uploads" @click="cleanupAbandonedUploads">
            24시간 지난 미연결 이미지 정리
          </button>
          <article
            v-for="category in moderationCategories"
            :key="category.id"
            class="category-admin-row"
          >
            <span class="category-admin-fields"
              ><input
                v-model="category.name"
                maxlength="50"
                :aria-label="`${category.name} 이름`"
              /><input
                v-model="category.slug"
                maxlength="50"
                :aria-label="`${category.name} 주소`"
              /><small
                >글 {{ category.threadCount
                }}<template v-if="category.deletedThreadCount">
                  · 숨김 {{ category.deletedThreadCount }}</template
                ></small
              ></span
            >
            <div class="category-admin-actions">
              <button @click="saveCategory(category)">저장</button
              ><button
                :disabled="category.threadCount + category.deletedThreadCount > 0"
                @click="removeCategory(category)"
              >
                삭제
              </button>
            </div>
          </article>
          <div class="category-create">
            <input
              v-model="newCategoryName"
              maxlength="50"
              aria-label="새 카테고리 이름"
              placeholder="카테고리 이름"
            /><input
              v-model="newCategorySlug"
              maxlength="50"
              aria-label="새 카테고리 주소"
              placeholder="category-slug"
            /><button
              :disabled="newCategoryName.trim().length < 2 || !newCategorySlug.trim()"
              @click="createCategory"
            >
              추가
            </button>
          </div>
        </section>
      </section>
    </div>
  </div>
</template>
