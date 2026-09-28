<script setup lang="ts">
type User = {
  id: number;
  name: string | null;
  email: string | null;
  canReceiveMail: boolean;
  avatarUrl: string | null;
  createdAt: number;
  isGlobalAdmin: boolean;
  threadCount: number;
  commentCount: number;
  lastActivityAt: number | null;
  lastThreadTitle: string | null;
  lastCommentExcerpt: string | null;
  suspensionId: number | null;
  suspensionReason: string | null;
  suspensionExpiresAt: number | null;
};
type UserPage = { items: User[]; total: number; page: number; pageSize: number };

const users = ref<UserPage | null>(null);
const input = ref('');
const search = ref('');
const status = ref<'all' | 'suspended'>('all');
const page = ref(1);
const selectedIds = ref<number[]>([]);
const loading = ref(true);
const error = ref('');
let requestId = 0;
const pageCount = computed(() =>
  users.value ? Math.max(1, Math.ceil(users.value.total / users.value.pageSize)) : 1
);
const count = (value: number) => value.toLocaleString('ko-KR');
const mailPath = computed(() => `/admin/mail?users=${selectedIds.value.join(',')}`);
function toggleSelected(userId: number) {
  selectedIds.value = selectedIds.value.includes(userId)
    ? selectedIds.value.filter((id) => id !== userId)
    : [...selectedIds.value, userId];
}

async function load() {
  const id = ++requestId;
  loading.value = true;
  try {
    const result = await $fetch<UserPage>('/api/admin/users', {
      query: { q: search.value, status: status.value, page: page.value },
    });
    if (id !== requestId) return;
    users.value = result;
    error.value = '';
  } catch {
    if (id !== requestId) return;
    error.value = '사용자 목록을 불러오지 못했어요. 전체 관리자 권한을 확인해 주세요.';
  } finally {
    if (id === requestId) loading.value = false;
  }
}

function submitSearch() {
  search.value = input.value.trim();
  page.value = 1;
  void load();
}

function changeStatus() {
  page.value = 1;
  void load();
}

function changePage(next: number) {
  if (next < 1 || next > pageCount.value) return;
  page.value = next;
  void load();
}

onMounted(load);
</script>

<template>
  <div class="page-shell">
    <SiteTopbar />
    <main class="page-content">
      <div class="page-breadcrumb">
        <NuxtLink to="/admin">전체 관리</NuxtLink><span> / 사용자</span>
      </div>
      <section class="page-heading">
        <div>
          <p class="section-kicker">GLOBAL ADMIN · USERS</p>
          <h1>사용자 관리</h1>
          <p>이메일·닉네임·작성한 게시글과 댓글을 검색하고 계정 정지를 관리합니다.</p>
        </div>
      </section>
      <p v-if="error" class="page-alert" role="alert">{{ error }}</p>
      <section class="admin-panel">
        <form class="global-user-search" @submit.prevent="submitSearch">
          <label for="global-user-query">사용자 또는 작성 내용 검색</label>
          <div>
            <input
              id="global-user-query"
              v-model="input"
              type="search"
              maxlength="100"
              placeholder="이메일, 닉네임, 게시글 제목·본문, 댓글"
            />
            <button class="primary-button" type="submit">검색</button>
          </div>
        </form>
        <div class="global-user-toolbar">
          <span>{{ count(users?.total ?? 0) }}명</span>
          <NuxtLink v-if="selectedIds.length" class="secondary-button" :to="mailPath">
            선택한 {{ count(selectedIds.length) }}명에게 메일 작성
          </NuxtLink>
          <button v-if="selectedIds.length" class="text-button" @click="selectedIds = []">
            선택 해제
          </button>
          <span v-if="selectedIds.length >= 500">한 번에 최대 500명까지 선택할 수 있어요.</span>
          <label
            >상태
            <select v-model="status" @change="changeStatus">
              <option value="all">전체</option>
              <option value="suspended">정지 중</option>
            </select>
          </label>
        </div>
        <div v-if="loading" class="page-empty">사용자를 불러오는 중…</div>
        <div v-else-if="users?.items.length" class="global-user-list">
          <article v-for="member in users.items" :key="member.id" class="global-user-row">
            <label class="global-user-select">
              <input
                type="checkbox"
                :checked="selectedIds.includes(member.id)"
                :disabled="
                  !member.canReceiveMail ||
                  (!selectedIds.includes(member.id) && selectedIds.length >= 500)
                "
                :aria-label="`${member.name || member.email || `사용자 ${member.id}`} 선택`"
                @change="toggleSelected(member.id)"
              />
            </label>
            <div class="global-user-identity">
              <UserAvatar :src="member.avatarUrl" :name="member.name || member.email" />
              <div>
                <strong>{{ member.name || '이름 미설정' }}</strong>
                <small>{{ member.email || '이메일 없음 · CHZZK 계정' }}</small>
                <small v-if="!member.canReceiveMail"
                  >메일 수신 불가 · 주소 확인 또는 수신 설정 필요</small
                >
                <small>가입 {{ new Date(member.createdAt).toLocaleDateString('ko-KR') }}</small>
              </div>
            </div>
            <div class="global-user-activity">
              <span
                >게시글 {{ count(member.threadCount) }} · 댓글
                {{ count(member.commentCount) }}</span
              >
              <small v-if="member.lastThreadTitle">최근 글: {{ member.lastThreadTitle }}</small>
              <small v-if="member.lastCommentExcerpt"
                >최근 댓글: {{ member.lastCommentExcerpt }}</small
              >
              <small v-if="member.lastActivityAt"
                >마지막 작성 {{ new Date(member.lastActivityAt).toLocaleString('ko-KR') }}</small
              >
            </div>
            <div class="global-user-status">
              <span v-if="member.isGlobalAdmin" class="role-badge role-admin">전체 관리자</span>
              <span v-else-if="member.suspensionId" class="role-badge report-dismissed">
                {{
                  member.suspensionExpiresAt
                    ? `${new Date(member.suspensionExpiresAt).toLocaleString('ko-KR')}까지 정지`
                    : '영구 정지'
                }}
              </span>
              <span v-else class="role-badge role-mod">정상</span>
            </div>
            <NuxtLink class="secondary-button" :to="`/admin/users/${member.id}`"
              >활동·제재</NuxtLink
            >
          </article>
        </div>
        <p v-else-if="!error" class="page-empty">검색 결과가 없습니다.</p>
        <div v-if="users && pageCount > 1" class="global-forum-pagination">
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
    </main>
  </div>
</template>
