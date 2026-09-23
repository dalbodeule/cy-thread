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
  const prompt = banned
    ? `${member.name || member.email} 님을 커뮤니티에서 차단할까요?`
    : `${member.name || member.email} 님의 차단을 해제할까요?`;
  if (!window.confirm(prompt)) return;
  try {
    await $fetch(`/api/forums/${encodeURIComponent(slug.value)}/moderation/bans`, {
      method: 'POST',
      body: { userId: member.id, banned, reason: banned ? '운영진 사용자 관리' : '' },
    });
    member.isBanned = banned;
    notice.value = banned ? '멤버를 차단했어요.' : '차단을 해제했어요.';
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
  <div class="page-shell">
    <header class="page-topbar">
      <NuxtLink class="brand" to="/"
        ><span class="brand-mark">c<span>y</span></span
        ><span class="brand-word">thread<span class="brand-dot">.</span></span></NuxtLink
      >
      <nav class="page-nav">
        <NuxtLink :to="`${forumPath}/admin`">운영 관리</NuxtLink
        ><NuxtLink :to="`${forumPath}/reports`">신고함</NuxtLink>
      </nav>
      <NuxtLink class="text-button" to="/login">계정</NuxtLink>
    </header>
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
      <label class="page-search member-search"
        ><span>⌕</span><input v-model="query" type="search" placeholder="이름 또는 이메일 검색"
      /></label>
      <div v-if="loading && !members.length" class="page-empty">멤버를 불러오는 중…</div>
      <div v-else-if="!members.length && !error" class="page-empty">검색 결과가 없어요.</div>
      <section v-else class="member-admin-list">
        <article v-for="member in members" :key="member.id" class="member-admin-row">
          <span class="avatar mint">{{ (member.name || member.email || '멤버')[0] }}</span
          ><span class="member-admin-identity"
            ><strong>{{ member.name || '이름 미설정' }}</strong
            ><small>{{ member.email || '이메일 비공개' }}</small
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
