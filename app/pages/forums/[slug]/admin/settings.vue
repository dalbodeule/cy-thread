<script setup lang="ts">
type Settings = {
  name: string;
  slug: string;
  description: string;
  iconText: string;
  iconBackground: string;
  iconColor: string;
  cssCustom: string;
  allowDarkMode: boolean;
  rules: string;
  welcomeMessage: string;
  visibility: 'public' | 'private';
  commentAccess: 'guest' | 'members' | 'forum_members';
  membershipQuestions: string[];
};
const route = useRoute();
const slug = computed(() => String(route.params.slug));
const forumPath = computed(() => `/forums/${encodeURIComponent(slug.value)}`);
const api = computed(() => `/api/forums/${encodeURIComponent(slug.value)}/moderation/settings`);
const form = reactive<Settings>({
  name: '',
  slug: '',
  description: '',
  iconText: 'F',
  iconBackground: '#31664d',
  iconColor: '#ffffff',
  cssCustom: '',
  allowDarkMode: true,
  rules: '',
  welcomeMessage: '',
  visibility: 'public',
  commentAccess: 'members',
  membershipQuestions: [],
});
const loading = ref(true);
const saving = ref(false);
const error = ref('');
const notice = ref('');
type MembershipRequest = {
  userId: number;
  name: string | null;
  answers: string[];
  createdAt: string;
};
const membershipRequests = ref<MembershipRequest[]>([]);
async function loadMembershipRequests() {
  if (form.visibility !== 'private') return;
  try {
    membershipRequests.value = await $fetch<MembershipRequest[]>(
      `${api.value.replace('/settings', '')}/members`
    );
  } catch {
    membershipRequests.value = [];
  }
}
async function decideMembership(userId: number, status: 'approved' | 'rejected') {
  try {
    await $fetch(`${api.value.replace('/settings', '')}/members/${userId}`, {
      method: 'PATCH',
      body: { status },
    });
    await loadMembershipRequests();
  } catch {
    error.value = '가입 신청을 처리하지 못했어요.';
  }
}
async function load() {
  loading.value = true;
  try {
    Object.assign(form, await $fetch<Settings>(api.value));
    await loadMembershipRequests();
    error.value = '';
  } catch {
    error.value = 'Forum 설정을 불러올 수 없어요. 관리자 권한을 확인해 주세요.';
  } finally {
    loading.value = false;
  }
}
async function save() {
  saving.value = true;
  error.value = '';
  notice.value = '';
  try {
    Object.assign(form, await $fetch<Settings>(api.value, { method: 'PATCH', body: form }));
    notice.value = 'Forum 설정을 저장했어요. 새 화면부터 변경 사항이 반영됩니다.';
  } catch (caught) {
    const failure = caught as { data?: { statusMessage?: string } };
    error.value = failure.data?.statusMessage || '설정을 저장하지 못했어요.';
  } finally {
    saving.value = false;
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
        <NuxtLink :to="`${forumPath}/admin`">운영 관리</NuxtLink><span> / Forum 설정</span>
      </div>
      <section class="page-heading">
        <div>
          <p class="section-kicker">FORUM SETTINGS</p>
          <h1>Forum 설정</h1>
          <p>상단 왼쪽 이름과 사각 아이콘, Forum 색상을 관리합니다.</p>
        </div>
      </section>
      <p v-if="error" class="page-alert" role="alert">{{ error }}</p>
      <p v-if="notice" class="page-success" role="status">{{ notice }}</p>
      <div v-if="loading" class="page-empty">설정을 불러오는 중…</div>
      <form v-else class="admin-panel forum-settings-form" @submit.prevent="save">
        <label>Forum 이름<input v-model="form.name" required minlength="2" maxlength="60" /></label>
        <label
          >Forum 공개 범위<select v-model="form.visibility">
            <option value="public">공개 Forum</option>
            <option value="private">비공개 Forum (가입 승인제)</option>
          </select></label
        >
        <label
          >댓글 작성 권한<select v-model="form.commentAccess">
            <option value="guest">비회원 포함 (IP 기록)</option>
            <option value="members">로그인 회원만</option>
            <option value="forum_members">Forum 가입 회원만</option>
          </select></label
        >
        <label v-if="form.visibility === 'private'"
          >가입 신청 질문(한 줄에 하나)<textarea
            :value="form.membershipQuestions.join('\n')"
            maxlength="1200"
            placeholder="이 Forum에 가입하려는 이유는 무엇인가요?"
            @input="
              form.membershipQuestions = String(($event.target as HTMLTextAreaElement).value)
                .split('\n')
                .map((item) => item.trim())
                .filter(Boolean)
            "
          />
        </label>
        <section v-if="form.visibility === 'private'" class="admin-panel">
          <h2>가입 신청</h2>
          <p v-if="!membershipRequests.length">대기 중인 가입 신청이 없어요.</p>
          <article
            v-for="request in membershipRequests"
            :key="request.userId"
            class="page-thread-row"
          >
            <div>
              <strong>{{ request.name || '이름 없음' }}</strong>
              <p v-for="(answer, index) in request.answers" :key="index">
                {{ form.membershipQuestions[index] }}: {{ answer }}
              </p>
            </div>
            <div>
              <button
                type="button"
                class="primary-button"
                @click="decideMembership(request.userId, 'approved')"
              >
                승인
              </button>
              <button
                type="button"
                class="secondary-button"
                @click="decideMembership(request.userId, 'rejected')"
              >
                거절
              </button>
            </div>
          </article>
        </section>
        <label>설명<textarea v-model="form.description" maxlength="240" /></label>
        <label
          >커뮤니티 규칙<textarea
            v-model="form.rules"
            maxlength="5000"
            placeholder="1. 서로 존중해 주세요.&#10;2. 주제에 맞는 글을 작성해 주세요."
          />
        </label>
        <label
          >첫 방문 안내<textarea
            v-model="form.welcomeMessage"
            maxlength="1000"
            placeholder="이 Forum에 오신 것을 환영합니다."
          />
        </label>
        <label>사각 아이콘 글자<input v-model="form.iconText" required maxlength="2" /></label>
        <div class="setting-colors">
          <label>아이콘 배경색<input v-model="form.iconBackground" type="color" /></label>
          <label>아이콘 글자색<input v-model="form.iconColor" type="color" /></label>
        </div>
        <label class="forum-settings-toggle"
          ><input v-model="form.allowDarkMode" type="checkbox" /> 이 Forum에서 다크모드 허용</label
        >
        <div class="settings-preview">
          <span
            class="forum-brand-mark"
            :style="{ backgroundColor: form.iconBackground, color: form.iconColor }"
            >{{ form.iconText || 'F' }}</span
          >
          <span
            ><strong>{{ form.name || 'Forum 이름' }}</strong
            ><small>{{ form.description }}</small></span
          >
        </div>
        <label
          >Forum CSS 색상 변수<textarea
            v-model="form.cssCustom"
            class="css-editor"
            spellcheck="false"
            placeholder="--forum-accent: #31664d;&#10;--forum-canvas: #f9faf7;&#10;--forum-surface: #ffffff;"
          />
        </label>
        <p class="settings-help">
          사용 가능: --forum-accent, --forum-canvas, --forum-surface, --forum-text, --forum-muted,
          --forum-border. 각 값은 #RRGGBB 형식으로 입력하세요. 이 설정은 해당 Forum 화면에만
          적용됩니다.
        </p>
        <div>
          <button class="primary-button" type="submit" :disabled="saving">
            {{ saving ? '저장 중…' : '설정 저장' }}
          </button>
        </div>
      </form>
    </main>
  </div>
</template>
