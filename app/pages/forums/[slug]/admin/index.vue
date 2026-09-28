<script setup lang="ts">
type Moderator = {
  id: number;
  name: string | null;
  email: string | null;
  role: 'global' | 'owner' | 'admin' | 'mod';
};
type Stats = { members: number; threads: number; posts: number; categories: number };
type Activity = {
  activeMembers30d: number;
  openReports: number;
  daily: Array<{ day: string; threads: number; posts: number }>;
};
const route = useRoute();
const { user, loggedIn } = useUserSession();
const slug = computed(() => String(route.params.slug));
const forumPath = computed(() => `/forums/${encodeURIComponent(slug.value)}`);
const api = (path: string) => `/api/forums/${encodeURIComponent(slug.value)}/moderation${path}`;
const moderators = ref<Moderator[]>([]);
const stats = ref<Stats>({ members: 0, threads: 0, posts: 0, categories: 0 });
const activity = ref<Activity>({ activeMembers30d: 0, openReports: 0, daily: [] });
const email = ref('');
const role = ref<'admin' | 'mod'>('mod');
const newOwnerEmail = ref('');
const error = ref('');
const notice = ref('');
const loading = ref(true);
const myRole = computed(
  () => moderators.value.find((member) => member.id === Number(user.value?.id))?.role
);
const canAppointAdmin = computed(() => myRole.value === 'global' || myRole.value === 'owner');
const canManage = computed(() => ['global', 'owner', 'admin'].includes(myRole.value || ''));
async function load() {
  loading.value = true;
  try {
    const [team, communityStats, communityActivity] = await Promise.all([
      $fetch<Moderator[]>(api('/moderators')),
      $fetch<Stats>(`/api/forums/${encodeURIComponent(slug.value)}/stats`),
      $fetch<Activity>(api('/stats')),
    ]);
    moderators.value = team;
    stats.value = communityStats;
    activity.value = communityActivity;
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
async function transferOwner() {
  if (!window.confirm('Forum 소유자를 이 멤버로 변경할까요?')) return;
  try {
    await $fetch(`/api/admin/forums/${encodeURIComponent(slug.value)}/owner`, {
      method: 'PATCH',
      body: { email: newOwnerEmail.value },
    });
    newOwnerEmail.value = '';
    notice.value = 'Forum 소유자를 변경했어요.';
    await load();
  } catch {
    error.value = '소유자를 변경하지 못했어요. 가입한 멤버의 이메일을 확인해 주세요.';
  }
}
watch(slug, () => void load());
onMounted(load);
</script>

<template>
  <div class="page-shell forum-page" :data-forum-slug="slug">
    <ForumTopbar :slug="slug" />
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
          <NuxtLink v-if="canManage" :to="`${forumPath}/admin/mail`"
            ><span>✉</span><strong>메일 관리</strong><small>Forum 참여자 안내</small></NuxtLink
          >
          <NuxtLink :to="`${forumPath}/threads`"
            ><span>▤</span><strong>이야기 목록</strong><small>게시글과 댓글 확인</small></NuxtLink
          ><NuxtLink :to="`${forumPath}/reports`"
            ><span>⚑</span><strong>신고함</strong><small>접수된 신고 검토</small></NuxtLink
          ><NuxtLink v-if="canManage" :to="`${forumPath}/admin/settings`"
            ><span>▣</span><strong>Forum 설정</strong><small>이름·아이콘·색상</small></NuxtLink
          ><NuxtLink v-if="canManage" :to="`${forumPath}/admin/categories`"
            ><span>◈</span><strong>카테고리</strong><small>이야기 주제 관리</small></NuxtLink
          ><NuxtLink :to="`${forumPath}/admin/users`"
            ><span>♙</span><strong>사용자</strong><small>검색·차단 관리</small></NuxtLink
          >
        </nav>
        <section class="admin-panel activity-panel">
          <div class="admin-section-title">
            <div>
              <p class="section-kicker">LAST 30 DAYS</p>
              <h2>커뮤니티 활동</h2>
            </div>
            <NuxtLink :to="`${forumPath}/reports`"
              >열린 신고 {{ activity.openReports }}건 →</NuxtLink
            >
          </div>
          <div class="activity-summary">
            <strong>{{ activity.activeMembers30d.toLocaleString('ko-KR') }}</strong
            ><span>최근 30일 활동 멤버</span>
          </div>
          <div
            v-if="activity.daily.length"
            class="activity-bars"
            role="img"
            aria-label="최근 30일 일별 게시글과 스레드 수"
          >
            <div
              v-for="day in activity.daily"
              :key="day.day"
              class="activity-day"
              :title="`${day.day}: 이야기 ${day.threads}개, 게시글 ${day.posts}개`"
            >
              <span
                class="activity-thread-bar"
                :style="{
                  height: `${day.threads ? Math.max(4, Math.min(100, day.threads * 12)) : 0}%`,
                }"
              />
              <span
                class="activity-post-bar"
                :style="{ height: `${day.posts ? Math.max(4, Math.min(100, day.posts * 5)) : 0}%` }"
              />
            </div>
          </div>
          <small class="activity-legend"
            ><i class="activity-thread-dot" /> 이야기
            <i class="activity-post-dot" /> 게시글·댓글</small
          >
        </section>
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
                ><small>#{{ member.id }} · {{ member.email || '이메일 없음' }}</small></span
              ><span class="role-badge" :class="`role-${member.role}`">{{
                member.role === 'global'
                  ? '전체 관리자'
                  : member.role === 'owner'
                    ? '소유자'
                    : member.role === 'admin'
                      ? '관리자'
                      : '운영자'
              }}</span
              ><button
                v-if="
                  member.role !== 'owner' &&
                  member.role !== 'global' &&
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
          <p>
            Google 이메일 또는 사용자 ID로 운영 권한을 부여합니다. 치지직 사용자는 ID를 사용하세요.
          </p>
          <form class="appoint-form" @submit.prevent="appoint">
            <label
              ><span>멤버 이메일 또는 사용자 ID</span
              ><input
                v-model="email"
                type="text"
                required
                placeholder="member@example.com 또는 123" /></label
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
        </section>
        <section v-if="myRole === 'global'" class="admin-panel appoint-panel">
          <div class="admin-section-title"><h2>Forum 소유자 변경</h2></div>
          <p>전체 관리자만 Forum 소유자를 변경할 수 있습니다.</p>
          <form class="appoint-form" @submit.prevent="transferOwner">
            <label
              ><span>새 소유자 이메일 또는 사용자 ID</span
              ><input
                v-model="newOwnerEmail"
                type="text"
                required
                placeholder="member@example.com 또는 123" /></label
            ><button class="primary-button" :disabled="!newOwnerEmail.trim()">소유자 변경</button>
          </form>
        </section></template
      ><NuxtLink class="back-link" to="/">← 전체 홈</NuxtLink>
    </main>
  </div>
</template>
