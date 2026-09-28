<script setup lang="ts">
type ActivityItem = {
  kind: 'thread' | 'comment';
  id: number;
  threadId: number;
  forumSlug: string;
  forumName: string;
  title: string;
  excerpt: string | null;
  createdAt: number;
};
type Sanction = {
  id: number;
  reason: string;
  duration: string;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
};
type ActivityResponse = {
  user: {
    id: number;
    name: string | null;
    email: string | null;
    avatarUrl: string | null;
    createdAt: string;
    isGlobalAdmin: boolean;
  };
  activeSuspension: Sanction | null;
  sanctions: Sanction[];
  activity: { items: ActivityItem[]; total: number; page: number; pageSize: number };
};

const route = useRoute();
const { user: currentUser } = useUserSession();
const userId = computed(() => Number(route.params.userId));
const data = ref<ActivityResponse | null>(null);
const searchInput = ref('');
const search = ref('');
const kind = ref<'all' | 'thread' | 'comment'>('all');
const page = ref(1);
const duration = ref('30m');
const reason = ref('');
const loading = ref(true);
const busy = ref(false);
const error = ref('');
const notice = ref('');
const pageCount = computed(() =>
  data.value ? Math.max(1, Math.ceil(data.value.activity.total / data.value.activity.pageSize)) : 1
);
const canSuspend = computed(() =>
  Boolean(
    data.value &&
    !data.value.user.isGlobalAdmin &&
    data.value.user.id !== Number(currentUser.value?.id)
  )
);

async function load() {
  loading.value = true;
  try {
    data.value = await $fetch<ActivityResponse>(`/api/admin/users/${userId.value}/activity`, {
      query: { q: search.value, kind: kind.value, page: page.value },
    });
    error.value = '';
  } catch {
    error.value = '사용자 정보를 불러오지 못했어요. 전체 관리자 권한을 확인해 주세요.';
  } finally {
    loading.value = false;
  }
}

function submitSearch() {
  search.value = searchInput.value.trim();
  page.value = 1;
  void load();
}
function changeKind() {
  page.value = 1;
  void load();
}
function changePage(next: number) {
  if (next < 1 || next > pageCount.value) return;
  page.value = next;
  void load();
}

async function suspend() {
  if (!canSuspend.value || !reason.value.trim()) return;
  if (!window.confirm(`${data.value?.user.name || '이 사용자'} 계정을 정지할까요?`)) return;
  busy.value = true;
  try {
    const result = await $fetch<{ notificationQueued: boolean }>(
      `/api/admin/users/${userId.value}/suspension`,
      {
        method: 'POST',
        body: { duration: duration.value, reason: reason.value.trim() },
      }
    );
    reason.value = '';
    notice.value = result.notificationQueued
      ? '정지 상태를 저장하고 안내 메일을 발송 대기열에 등록했습니다.'
      : '정지 상태를 저장했습니다. 확인된 이메일이 없어 안내 메일은 등록되지 않았습니다.';
    await load();
  } catch {
    error.value = '정지 상태를 저장하지 못했어요.';
  } finally {
    busy.value = false;
  }
}

async function liftSuspension() {
  if (!window.confirm('이 계정의 정지를 해제할까요?')) return;
  busy.value = true;
  try {
    await $fetch(`/api/admin/users/${userId.value}/suspension`, { method: 'DELETE' });
    notice.value = '정지를 해제했습니다.';
    await load();
  } catch {
    error.value = '정지를 해제하지 못했어요.';
  } finally {
    busy.value = false;
  }
}

const durationLabel = (value: string) =>
  ({
    '30m': '30분',
    '1h': '1시간',
    '6h': '6시간',
    '1d': '1일',
    '7d': '7일',
    '1mo': '1달',
    permanent: '영구',
  })[value] || value;

watch(userId, () => void load());
onMounted(load);
</script>

<template>
  <div class="page-shell">
    <header class="page-topbar">
      <NuxtLink class="home-brand" to="/"
        ><span class="home-brand-icon">m</span><span>mori.space</span></NuxtLink
      >
      <nav class="page-nav">
        <NuxtLink to="/admin">관리도구</NuxtLink><NuxtLink to="/admin/users">사용자</NuxtLink>
      </nav>
      <NuxtLink class="text-button" to="/">홈</NuxtLink>
    </header>
    <main class="page-content">
      <div class="page-breadcrumb">
        <NuxtLink to="/admin/users">사용자 관리</NuxtLink><span> / 활동·제재</span>
      </div>
      <div v-if="loading && !data" class="page-empty">사용자 정보를 불러오는 중…</div>
      <p v-if="error" class="page-alert" role="alert">{{ error }}</p>
      <p v-if="notice" class="page-success" role="status">{{ notice }}</p>
      <template v-if="data">
        <section class="page-heading">
          <div>
            <p class="section-kicker">GLOBAL ADMIN · MEMBER</p>
            <h1>{{ data.user.name || '이름 미설정' }}</h1>
            <p>
              {{ data.user.email || '이메일 없음 · CHZZK 계정' }} · 가입
              {{ new Date(data.user.createdAt).toLocaleDateString('ko-KR') }}
            </p>
          </div>
        </section>
        <section class="admin-panel">
          <div class="admin-section-title"><h2>서비스 이용 상태</h2></div>
          <p v-if="data.activeSuspension" class="suspension-banner">
            <strong>{{
              data.activeSuspension.expiresAt
                ? `${new Date(data.activeSuspension.expiresAt).toLocaleString('ko-KR')}까지 정지`
                : '영구 정지'
            }}</strong>
            <span>사유: {{ data.activeSuspension.reason }}</span>
          </p>
          <p v-else class="permission-note">현재 정지 상태가 아닙니다.</p>
          <p v-if="data.user.isGlobalAdmin" class="permission-note">
            전체 관리자 계정은 정지할 수 없습니다.
          </p>
          <form v-else-if="canSuspend" class="suspension-form" @submit.prevent="suspend">
            <label
              >정지 기간
              <select v-model="duration">
                <option value="30m">30분</option>
                <option value="1h">1시간</option>
                <option value="6h">6시간</option>
                <option value="1d">1일</option>
                <option value="7d">7일</option>
                <option value="1mo">1달</option>
                <option value="permanent">영구 정지</option>
              </select>
            </label>
            <label
              >사유
              <textarea
                v-model="reason"
                minlength="2"
                maxlength="500"
                required
                placeholder="제재 사유를 입력하세요"
              />
            </label>
            <div class="suspension-actions">
              <button class="danger-button" :disabled="busy || reason.trim().length < 2">
                {{ data.activeSuspension ? '정지 변경' : '정지하기' }}
              </button>
              <button
                v-if="data.activeSuspension"
                class="secondary-button"
                type="button"
                :disabled="busy"
                @click="liftSuspension"
              >
                정지 해제
              </button>
            </div>
          </form>
        </section>
        <section class="admin-panel">
          <div class="admin-section-title">
            <h2>최근 작성 활동</h2>
            <span>{{ data.activity.total.toLocaleString('ko-KR') }}건</span>
          </div>
          <form class="global-user-search" @submit.prevent="submitSearch">
            <label for="activity-query">게시글 제목·본문 또는 댓글 검색</label>
            <div>
              <input
                id="activity-query"
                v-model="searchInput"
                type="search"
                maxlength="100"
                placeholder="작성 내용 검색"
              />
              <button class="primary-button" type="submit">검색</button>
            </div>
          </form>
          <div class="global-user-toolbar">
            <span>최신 작성순</span>
            <label
              >종류
              <select v-model="kind" @change="changeKind">
                <option value="all">전체</option>
                <option value="thread">게시글</option>
                <option value="comment">댓글</option>
              </select>
            </label>
          </div>
          <div v-if="loading" class="page-empty">활동을 불러오는 중…</div>
          <div v-else-if="data.activity.items.length" class="global-activity-list">
            <article v-for="item in data.activity.items" :key="`${item.kind}-${item.id}`">
              <span
                class="role-badge"
                :class="item.kind === 'thread' ? 'role-admin' : 'role-mod'"
                >{{ item.kind === 'thread' ? '게시글' : '댓글' }}</span
              >
              <div>
                <NuxtLink
                  :to="`/forums/${encodeURIComponent(item.forumSlug)}/threads/${item.threadId}`"
                  >{{ item.title }}</NuxtLink
                >
                <p v-if="item.excerpt">{{ item.excerpt }}</p>
                <small
                  >{{ item.forumName }} ·
                  {{ new Date(item.createdAt).toLocaleString('ko-KR') }}</small
                >
              </div>
            </article>
          </div>
          <p v-else class="page-empty">작성 내역이 없습니다.</p>
          <div v-if="pageCount > 1" class="global-forum-pagination">
            <button
              class="secondary-button"
              :disabled="page <= 1 || loading"
              @click="changePage(page - 1)"
            >
              이전
            </button>
            <span>{{ page }} / {{ pageCount }}</span>
            <button
              class="secondary-button"
              :disabled="page >= pageCount || loading"
              @click="changePage(page + 1)"
            >
              다음
            </button>
          </div>
        </section>
        <section v-if="data.sanctions.length" class="admin-panel">
          <div class="admin-section-title">
            <h2>제재 기록</h2>
            <span>최근 10건</span>
          </div>
          <div class="global-sanction-list">
            <article v-for="item in data.sanctions" :key="item.id">
              <strong>{{ durationLabel(item.duration) }} 정지</strong>
              <span>{{ item.reason }}</span>
              <small
                >시작 {{ new Date(item.createdAt).toLocaleString('ko-KR') }} ·
                {{
                  item.revokedAt
                    ? `해제 ${new Date(item.revokedAt).toLocaleString('ko-KR')}`
                    : item.expiresAt
                      ? `만료 ${new Date(item.expiresAt).toLocaleString('ko-KR')}`
                      : '영구'
                }}</small
              >
            </article>
          </div>
        </section>
      </template>
    </main>
  </div>
</template>
