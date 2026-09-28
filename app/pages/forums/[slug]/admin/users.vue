<script setup lang="ts">
type CommunityMember = {
  id: number;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  createdAt: string;
  isOwner: boolean;
  isAdmin: boolean;
  isModerator: boolean;
  isBanned: boolean;
};
const route = useRoute();
const slug = computed(() => String(route.params.slug));
const forumPath = computed(() => `/forums/${encodeURIComponent(slug.value)}`);
const query = ref('');
const members = ref<CommunityMember[]>([]);
const error = ref('');
const notice = ref('');
const loading = ref(false);
const hasMore = ref(false);
const duration = ref('permanent');
const reason = ref('');
let searchTimer: ReturnType<typeof setTimeout> | undefined;
async function load(offset = 0) {
  loading.value = true;
  try {
    const loaded = await $fetch<CommunityMember[]>(
      `/api/forums/${encodeURIComponent(slug.value)}/moderation/users`,
      { params: { q: query.value.trim(), limit: 100, offset } }
    );
    members.value = offset ? [...members.value, ...loaded] : loaded;
    hasMore.value = loaded.length === 100;
    error.value = '';
  } catch {
    error.value = '운영진 권한이 필요하거나 멤버를 불러오지 못했어요.';
    members.value = [];
  } finally {
    loading.value = false;
  }
}
async function loadMore() {
  await load(members.value.length);
}
async function setBanned(member: CommunityMember, banned: boolean) {
  if (banned && reason.value.trim().length < 2) {
    error.value = '차단 사유를 2자 이상 입력해 주세요.';
    return;
  }
  const prompt = banned
    ? `${member.name || member.email} 님을 커뮤니티에서 차단할까요?`
    : `${member.name || member.email} 님의 차단을 해제할까요?`;
  if (!window.confirm(prompt)) return;
  try {
    const result = await $fetch<{ notificationQueued: boolean }>(
      `/api/forums/${encodeURIComponent(slug.value)}/moderation/bans`,
      {
        method: 'POST',
        body: {
          userId: member.id,
          banned,
          duration: duration.value,
          reason: banned ? reason.value.trim() : '',
        },
      }
    );
    member.isBanned = banned;
    if (banned) reason.value = '';
    notice.value = banned
      ? result.notificationQueued
        ? '멤버를 차단하고 안내 메일을 발송 대기열에 등록했어요.'
        : '멤버를 차단했어요. 확인된 이메일이 없어 안내 메일은 등록되지 않았어요.'
      : '차단을 해제했어요.';
  } catch {
    error.value = '차단 상태를 변경하지 못했어요.';
  }
}
watch(query, () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => void load(), 200);
});
watch(slug, () => void load());
onMounted(load);
onBeforeUnmount(() => clearTimeout(searchTimer));
</script>

<template>
  <div class="page-shell forum-page" :data-forum-slug="slug">
    <ForumTopbar :slug="slug" />
    <main class="page-content">
      <div class="page-breadcrumb">
        <NuxtLink :to="`${forumPath}/admin`">운영 관리</NuxtLink><span> / 사용자 관리</span>
      </div>
      <section class="page-heading">
        <div>
          <p class="section-kicker">COMMUNITY MEMBERS</p>
          <h1>사용자 관리</h1>
          <p>커뮤니티에 참여한 멤버를 검색하고 차단 상태를 관리합니다.</p>
        </div>
      </section>
      <p v-if="error" class="page-alert" role="alert">{{ error }}</p>
      <p v-if="notice" class="page-success" role="status">{{ notice }}</p>
      <section class="admin-panel appoint-panel">
        <h2>차단 안내</h2>
        <p>확인된 이메일이 있는 대상에게 아래 기간과 사유를 안내합니다.</p>
        <div class="appoint-form">
          <label
            ><span>차단 기간</span
            ><select v-model="duration">
              <option value="30m">30분</option>
              <option value="1h">1시간</option>
              <option value="6h">6시간</option>
              <option value="1d">1일</option>
              <option value="7d">7일</option>
              <option value="1mo">1개월</option>
              <option value="permanent">영구 정지</option>
            </select></label
          >
          <label
            ><span>차단 사유</span
            ><input v-model="reason" maxlength="500" placeholder="대상에게 전달할 사유"
          /></label>
        </div>
      </section>
      <label class="page-search member-search"
        ><span>⌕</span><input v-model="query" type="search" placeholder="이름 또는 이메일 검색"
      /></label>
      <div v-if="loading && !members.length" class="page-empty">멤버를 불러오는 중…</div>
      <div v-else-if="!members.length && !error" class="page-empty">검색 결과가 없어요.</div>
      <section v-else class="member-admin-list">
        <article v-for="member in members" :key="member.id" class="member-admin-row">
          <UserAvatar :src="member.avatarUrl" :name="member.name || member.email" />
          ><span class="member-admin-identity"
            ><strong>{{ member.name || '이름 미설정' }}</strong
            ><small>#{{ member.id }} · {{ member.email || '이메일 없음' }}</small
            ><small>가입 {{ new Date(member.createdAt).toLocaleDateString('ko-KR') }}</small></span
          ><span v-if="member.isOwner" class="role-badge role-owner">소유자</span
          ><span v-else-if="member.isAdmin" class="role-badge role-admin">관리자</span
          ><span v-else-if="member.isModerator" class="role-badge role-mod">운영자</span
          ><span v-else-if="member.isBanned" class="role-badge report-dismissed">차단됨</span
          ><button
            v-if="!member.isOwner"
            class="danger-button"
            @click="setBanned(member, !member.isBanned)"
          >
            {{ member.isBanned ? '차단 해제' : '차단' }}
          </button>
        </article>
      </section>
      <button
        v-if="members.length && hasMore"
        class="load-more"
        :disabled="loading"
        @click="loadMore"
      >
        {{ loading ? '불러오는 중…' : '더 많은 멤버 보기 ↓' }}</button
      ><NuxtLink class="back-link" :to="`${forumPath}/admin`">← 운영 관리</NuxtLink>
    </main>
  </div>
</template>
