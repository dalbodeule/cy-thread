<script setup lang="ts">
type Moderator = {
  id: number;
  name: string | null;
  email: string | null;
  role: 'owner' | 'admin' | 'mod';
};
type Stats = { members: number; threads: number; posts: number; categories: number };
const route = useRoute();
const { user, loggedIn } = useUserSession();
const slug = computed(() => String(route.params.slug));
const forumPath = computed(() => `/forums/${encodeURIComponent(slug.value)}`);
const api = (path: string) => `/api/forums/${encodeURIComponent(slug.value)}/moderation${path}`;
const moderators = ref<Moderator[]>([]);
const stats = ref<Stats>({ members: 0, threads: 0, posts: 0, categories: 0 });
const email = ref('');
const role = ref<'admin' | 'mod'>('mod');
const error = ref('');
const notice = ref('');
const loading = ref(true);
const myRole = computed(
  () => moderators.value.find((member) => member.id === Number(user.value?.id))?.role
);
const canAppointAdmin = computed(() => myRole.value === 'owner');
const canManage = computed(() => myRole.value === 'owner' || myRole.value === 'admin');
async function load() {
  loading.value = true;
  try {
    const [team, communityStats] = await Promise.all([
      $fetch<Moderator[]>(api('/moderators')),
      $fetch<Stats>(`/api/forums/${encodeURIComponent(slug.value)}/stats`),
    ]);
    moderators.value = team;
    stats.value = communityStats;
    error.value = '';
  } catch {
    error.value = loggedIn.value
      ? '운영진만 이 페이지를 볼 수 있어요.'
      : '운영 관리에 로그인해 주세요.';
  } finally {
    loading.value = false;
  }
}
async function appoint() {
  try {
    await $fetch(api('/moderators'), {
      method: 'POST',
      body: { email: email.value, role: role.value },
    });
    email.value = '';
    notice.value = '운영진을 임명했어요.';
    await load();
  } catch {
    error.value = '임명하지 못했어요. 멤버가 한 번 이상 로그인했는지, 권한이 있는지 확인해 주세요.';
  }
}
async function remove(member: Moderator) {
  if (!window.confirm(`${member.name || member.email || '멤버'}의 운영 권한을 해제할까요?`)) return;
  try {
    await $fetch(api(`/moderators/${member.id}`), { method: 'DELETE' });
    moderators.value = moderators.value.filter((item) => item.id !== member.id);
    notice.value = '운영 권한을 해제했어요.';
  } catch {
    error.value = '권한을 해제하지 못했어요.';
  }
}
watch(slug, () => void load());
onMounted(load);
</script>

<template>
  <div class="page-shell">
    <header class="page-topbar">
      <NuxtLink class="brand" to="/"
        ><span class="brand-mark">c<span>y</span></span
        ><span class="brand-word">thread<span class="brand-dot">.</span></span></NuxtLink
      >
      <nav class="page-nav">
        <NuxtLink :to="`${forumPath}/threads`">이야기 목록</NuxtLink
        ><NuxtLink :to="`${forumPath}/reports`">신고함</NuxtLink>
      </nav>
      <NuxtLink class="text-button" to="/login">계정</NuxtLink>
    </header>
    <main class="page-content">
      <div class="page-breadcrumb">
        <NuxtLink :to="`${forumPath}/threads`">커뮤니티</NuxtLink><span> / 운영 관리</span>
      </div>
      <section class="page-heading">
        <div>
          <p class="section-kicker">COMMUNITY SETTINGS</p>
          <h1>운영 관리</h1>
          <p>커뮤니티 현황을 보고 운영진 권한을 관리합니다.</p>
        </div>
      </section>
      <p v-if="error" class="page-alert" role="alert">{{ error }}</p>
      <p v-if="notice" class="page-success" role="status">{{ notice }}</p>
      <div v-if="loading" class="page-empty">운영 정보를 불러오는 중…</div>
      <template v-else-if="!error"
        ><section class="admin-stats">
          <article>
            <strong>{{ stats.members.toLocaleString('ko-KR') }}</strong
            ><span>멤버</span>
          </article>
          <article>
            <strong>{{ stats.threads.toLocaleString('ko-KR') }}</strong
            ><span>이야기</span>
          </article>
          <article>
            <strong>{{ stats.posts.toLocaleString('ko-KR') }}</strong
            ><span>게시글·댓글</span>
          </article>
          <article>
            <strong>{{ stats.categories.toLocaleString('ko-KR') }}</strong
            ><span>카테고리</span>
          </article>
        </section>
        <nav class="admin-shortcuts">
          <NuxtLink :to="`${forumPath}/threads`"
            ><span>▤</span><strong>이야기 목록</strong><small>게시글과 댓글 확인</small></NuxtLink
          ><NuxtLink :to="`${forumPath}/reports`"
            ><span>⚑</span><strong>신고함</strong><small>접수된 신고 검토</small></NuxtLink
          ><NuxtLink :to="`${forumPath}/admin/categories`"
            ><span>◈</span><strong>카테고리</strong><small>이야기 주제 관리</small></NuxtLink
          >
        </nav>
        <section class="admin-panel">
          <div class="admin-section-title">
            <div>
              <p class="section-kicker">PEOPLE</p>
              <h2>운영진</h2>
            </div>
            <span>{{ moderators.length }}명</span>
          </div>
          <div class="moderator-list">
            <article v-for="member in moderators" :key="member.id" class="moderator-row">
              <span class="avatar mint">{{ (member.name || member.email || '멤버')[0] }}</span
              ><span class="moderator-identity"
                ><strong>{{ member.name || '이름 미설정' }}</strong
                ><small>{{ member.email || '이메일 비공개' }}</small></span
              ><span class="role-badge" :class="`role-${member.role}`">{{
                member.role === 'owner' ? '소유자' : member.role === 'admin' ? '관리자' : '운영자'
              }}</span
              ><button
                v-if="
                  member.role !== 'owner' &&
                  (canAppointAdmin || (canManage && member.role === 'mod'))
                "
                class="remove-role"
                @click="remove(member)"
              >
                권한 해제
              </button>
            </article>
            <p v-if="!moderators.length" class="page-empty">운영진 정보가 없습니다.</p>
          </div>
        </section>
        <section v-if="canManage" class="admin-panel appoint-panel">
          <div class="admin-section-title">
            <div>
              <p class="section-kicker">APPOINTMENT</p>
              <h2>운영진 임명</h2>
            </div>
          </div>
          <p>가입한 멤버의 이메일 주소로 운영 권한을 부여합니다.</p>
          <form class="appoint-form" @submit.prevent="appoint">
            <label
              ><span>멤버 이메일</span
              ><input
                v-model="email"
                type="email"
                autocomplete="email"
                required
                placeholder="member@example.com" /></label
            ><label
              ><span>권한</span
              ><select v-model="role">
                <option value="mod">운영자 · 게시글, 신고 관리</option>
                <option v-if="canAppointAdmin" value="admin">관리자 · 운영자 관리 포함</option>
              </select></label
            ><button class="primary-button" :disabled="!email.trim()">임명하기</button>
          </form>
          <small class="permission-note"
            >관리자 임명과 관리자 권한 변경은 커뮤니티 소유자만 할 수 있습니다.</small
          >
        </section></template
      ><NuxtLink class="back-link" to="/">← 커뮤니티 홈</NuxtLink>
    </main>
  </div>
</template>
