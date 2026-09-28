<script setup lang="ts">
type Daily = { day: string; users: number; forums: number; threads: number; posts: number };
type Overview = {
  totals: {
    users: number;
    forums: number;
    threads: number;
    posts: number;
    openReports: number;
    pendingRequests: number;
  };
  last30d: {
    users: number;
    forums: number;
    threads: number;
    posts: number;
    activeMembers: number;
  };
  daily: Daily[];
  timezone: string;
  generatedAt: string;
};
type Forum = {
  id: number;
  slug: string;
  name: string;
  visibility: string;
  createdAt: number;
  ownerName: string | null;
  ownerEmail: string | null;
  threads: number;
  posts: number;
  openReports: number;
};
type ForumPage = { items: Forum[]; total: number; page: number; pageSize: number };

const overview = ref<Overview | null>(null);
const forums = ref<ForumPage | null>(null);
const searchInput = ref('');
const search = ref('');
const page = ref(1);
const loading = ref(true);
const loadingForums = ref(false);
const error = ref('');

const chartMax = computed(() =>
  Math.max(
    1,
    ...(overview.value?.daily.map((row) => Math.max(row.users, row.threads, row.posts)) ?? [])
  )
);
const pageCount = computed(() =>
  forums.value ? Math.max(1, Math.ceil(forums.value.total / forums.value.pageSize)) : 1
);
const count = (value: number | undefined) => (value ?? 0).toLocaleString('ko-KR');
const barHeight = (value: number) =>
  value ? `${Math.max(5, Math.round((value / chartMax.value) * 100))}%` : '0%';

async function loadForums() {
  loadingForums.value = true;
  try {
    forums.value = await $fetch<ForumPage>('/api/admin/forums', {
      query: { q: search.value, page: page.value },
    });
    error.value = '';
  } catch {
    error.value = 'Forum 목록을 불러오지 못했어요.';
  } finally {
    loadingForums.value = false;
  }
}

async function load() {
  loading.value = true;
  try {
    const [summary, forumPage] = await Promise.all([
      $fetch<Overview>('/api/admin/overview'),
      $fetch<ForumPage>('/api/admin/forums', { query: { q: search.value, page: page.value } }),
    ]);
    overview.value = summary;
    forums.value = forumPage;
    error.value = '';
  } catch {
    error.value = '전체 관리자만 대시보드를 볼 수 있어요. 로그인과 관리자 권한을 확인해 주세요.';
  } finally {
    loading.value = false;
  }
}

function submitSearch() {
  search.value = searchInput.value.trim();
  page.value = 1;
  void loadForums();
}

function changePage(nextPage: number) {
  if (nextPage < 1 || nextPage > pageCount.value) return;
  page.value = nextPage;
  void loadForums();
}

onMounted(load);
</script>

<template>
  <div class="page-shell">
    <SiteTopbar />
    <main class="page-content">
      <section class="page-heading">
        <div>
          <p class="section-kicker">GLOBAL ADMIN</p>
          <h1>전체 관리자</h1>
          <p>Forum 운영 현황과 최근 30일의 콘텐츠 활동을 확인합니다.</p>
        </div>
      </section>
      <p v-if="error" class="page-alert" role="alert">{{ error }}</p>
      <div v-if="loading" class="page-empty">운영 현황을 불러오는 중…</div>
      <template v-else-if="overview">
        <section class="global-admin-stats" aria-label="전체 현황">
          <article>
            <strong>{{ count(overview.totals.users) }}</strong
            ><span>전체 사용자</span>
          </article>
          <article>
            <strong>{{ count(overview.totals.forums) }}</strong
            ><span>Forum</span>
          </article>
          <article>
            <strong>{{ count(overview.totals.threads) }}</strong
            ><span>게시글</span>
          </article>
          <article>
            <strong>{{ count(overview.totals.posts) }}</strong
            ><span>본문·댓글</span>
          </article>
          <article>
            <strong>{{ count(overview.totals.openReports) }}</strong
            ><span>열린 신고</span>
          </article>
          <article>
            <strong>{{ count(overview.totals.pendingRequests) }}</strong
            ><span>개설 대기</span>
          </article>
        </section>

        <nav class="admin-shortcuts">
          <NuxtLink to="/admin/mail"
            ><span>✉</span><strong>메일 관리</strong><small>전체·Forum·선택 발송</small></NuxtLink
          >
          <NuxtLink to="/admin/users"
            ><span>♙</span><strong>사용자 관리</strong
            ><small>작성 활동 검색·계정 정지</small></NuxtLink
          >
          <NuxtLink to="/admin/forum-requests"
            ><span>✦</span><strong>Forum 개설 신청</strong
            ><small>대기 {{ count(overview.totals.pendingRequests) }}건 검토</small></NuxtLink
          >
          <a href="#forum-list"
            ><span>▤</span><strong>Forum 운영 목록</strong><small>소유자·콘텐츠·신고 현황</small></a
          >
        </nav>

        <section class="admin-panel activity-panel">
          <div class="admin-section-title">
            <div>
              <p class="section-kicker">LAST 30 DAYS · UTC</p>
              <h2>플랫폼 활동</h2>
            </div>
            <span>{{ new Date(overview.generatedAt).toLocaleString('ko-KR') }} 기준</span>
          </div>
          <div class="global-activity-summary">
            <div>
              <strong>{{ count(overview.last30d.activeMembers) }}</strong
              ><span>활동 사용자</span>
            </div>
            <div>
              <strong>{{ count(overview.last30d.users) }}</strong
              ><span>신규 사용자</span>
            </div>
            <div>
              <strong>{{ count(overview.last30d.forums) }}</strong
              ><span>새 Forum</span>
            </div>
            <div>
              <strong>{{ count(overview.last30d.threads) }}</strong
              ><span>새 게시글</span>
            </div>
            <div>
              <strong>{{ count(overview.last30d.posts) }}</strong
              ><span>새 본문·댓글</span>
            </div>
          </div>
          <div
            class="activity-bars global-activity-bars"
            role="img"
            aria-label="최근 30일 일별 신규 사용자, 게시글, 본문과 댓글 수"
          >
            <div
              v-for="day in overview.daily"
              :key="day.day"
              class="activity-day"
              :title="`${day.day}: 사용자 ${day.users}명, 게시글 ${day.threads}개, 본문·댓글 ${day.posts}개`"
            >
              <span class="activity-user-bar" :style="{ height: barHeight(day.users) }" />
              <span class="activity-thread-bar" :style="{ height: barHeight(day.threads) }" />
              <span class="activity-post-bar" :style="{ height: barHeight(day.posts) }" />
            </div>
          </div>
          <small class="activity-legend"
            ><i class="activity-user-dot" /> 신규 사용자 <i class="activity-thread-dot" /> 게시글
            <i class="activity-post-dot" /> 본문·댓글</small
          >
        </section>

        <section id="forum-list" class="admin-panel">
          <div class="admin-section-title">
            <div>
              <p class="section-kicker">FORUMS</p>
              <h2>Forum 운영 목록</h2>
            </div>
            <span>{{ count(forums?.total) }}개</span>
          </div>
          <form class="global-forum-search" @submit.prevent="submitSearch">
            <label for="global-forum-query">Forum 이름 또는 주소 검색</label>
            <div>
              <input
                id="global-forum-query"
                v-model="searchInput"
                type="search"
                maxlength="100"
                placeholder="이름 또는 주소"
              />
              <button class="primary-button" type="submit">검색</button>
            </div>
          </form>
          <div v-if="loadingForums" class="page-empty">Forum을 불러오는 중…</div>
          <div v-else-if="forums?.items.length" class="global-forum-list">
            <article v-for="forum in forums.items" :key="forum.id" class="global-forum-row">
              <div class="global-forum-identity">
                <strong>{{ forum.name }}</strong>
                <small
                  >/{{ forum.slug }} · {{ forum.visibility }} ·
                  {{ new Date(forum.createdAt).toLocaleDateString('ko-KR') }}</small
                >
              </div>
              <div class="global-forum-owner">
                <span>소유자</span>
                <strong>{{ forum.ownerName || forum.ownerEmail || '이름 미설정' }}</strong>
              </div>
              <div class="global-forum-numbers">
                <span>게시글 {{ count(forum.threads) }}</span>
                <span>본문·댓글 {{ count(forum.posts) }}</span>
                <span :class="{ 'global-report-alert': forum.openReports > 0 }"
                  >신고 {{ count(forum.openReports) }}</span
                >
              </div>
              <NuxtLink
                class="secondary-button"
                :to="`/forums/${encodeURIComponent(forum.slug)}/admin`"
                >관리</NuxtLink
              >
            </article>
          </div>
          <p v-else class="page-empty">검색 결과가 없습니다.</p>
          <div v-if="forums && pageCount > 1" class="global-forum-pagination">
            <button
              class="secondary-button"
              :disabled="page <= 1 || loadingForums"
              @click="changePage(page - 1)"
            >
              이전
            </button>
            <span>{{ page }} / {{ pageCount }}</span>
            <button
              class="secondary-button"
              :disabled="page >= pageCount || loadingForums"
              @click="changePage(page + 1)"
            >
              다음
            </button>
          </div>
        </section>
      </template>
    </main>
  </div>
</template>
