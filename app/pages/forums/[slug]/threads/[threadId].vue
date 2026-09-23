<script setup lang="ts">
const ToastViewer = defineAsyncComponent(
  () => import('../../../../components/editor/ToastViewer.vue')
);
type Detail = {
  id: number;
  title: string;
  category: string;
  author: string | null;
  createdAt: string;
  isLocked: boolean;
  isPinned: boolean;
  canModerate: boolean;
  isAuthor: boolean;
  replies: Array<{ id: number; author: string | null; markdown: string; createdAt: string }>;
};
const route = useRoute();
const { loggedIn } = useUserSession();
const {
  public: { turnstile },
} = useRuntimeConfig();
const token = ref('');
const draft = ref('');
const reportReason = ref('spam');
const reportDetails = ref('');
const reportOpen = ref(false);
const detail = ref<Detail | null>(null);
const error = ref('');
const sending = ref(false);
const slug = computed(() => String(route.params.slug));
const threadId = computed(() => Number(route.params.threadId));
const forumPath = computed(() => `/forums/${encodeURIComponent(slug.value)}`);
const api = (path = '') =>
  `/api/forums/${encodeURIComponent(slug.value)}/threads/${threadId.value}${path}`;
async function load() {
  try {
    detail.value = await $fetch<Detail>(api());
    error.value = '';
  } catch {
    error.value = '게시글을 찾을 수 없거나 불러오지 못했어요.';
  }
}
async function reply() {
  if (!loggedIn.value) return navigateTo('/login');
  if (!draft.value.trim()) return;
  sending.value = true;
  try {
    await $fetch(api('/posts'), {
      method: 'POST',
      body: { body: draft.value, turnstileToken: token.value },
    });
    draft.value = '';
    token.value = '';
    await load();
  } catch {
    error.value = '댓글을 등록하지 못했어요. 로그인과 입력 내용을 확인해 주세요.';
  } finally {
    sending.value = false;
  }
}
async function report() {
  if (!loggedIn.value) return navigateTo('/login');
  try {
    await $fetch(api('/report'), {
      method: 'POST',
      body: {
        reason: reportReason.value,
        details: reportDetails.value,
        turnstileToken: token.value,
      },
    });
    reportOpen.value = false;
    reportDetails.value = '';
    token.value = '';
    error.value = '신고를 운영진에게 전달했어요.';
  } catch {
    error.value = '신고를 접수하지 못했어요.';
  }
}
async function moderate(action: 'lock' | 'pin') {
  if (!detail.value?.canModerate) return;
  const key = action === 'lock' ? 'isLocked' : 'isPinned';
  try {
    const updated = await $fetch<{ isLocked: boolean; isPinned: boolean }>(
      `/api/forums/${encodeURIComponent(slug.value)}/moderation/threads/${threadId.value}`,
      {
        method: 'PATCH',
        body: { [key]: !detail.value[key] },
      }
    );
    detail.value.isLocked = updated.isLocked;
    detail.value.isPinned = updated.isPinned;
  } catch {
    error.value = '운영 설정을 저장하지 못했어요.';
  }
}
async function removeThread() {
  if (
    !(detail.value?.canModerate || detail.value?.isAuthor) ||
    !window.confirm('이 게시글과 댓글을 숨길까요? 운영 기록은 유지됩니다.')
  )
    return;
  try {
    await $fetch(api(), { method: 'DELETE' });
    await navigateTo(`${forumPath.value}/threads`);
  } catch {
    error.value = '게시글을 숨기지 못했어요.';
  }
}
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
        ><NuxtLink :to="`${forumPath}/admin`">운영 관리</NuxtLink>
      </nav>
      <NuxtLink class="text-button" to="/login">로그인</NuxtLink>
    </header>
    <main class="page-content page-detail">
      <div class="page-breadcrumb">
        <NuxtLink :to="`${forumPath}/threads`">이야기 목록</NuxtLink><span> / 게시글</span>
      </div>
      <p v-if="error" class="page-alert" role="status">{{ error }}</p>
      <article v-if="detail" class="detail-page-card">
        <div class="page-row-meta">
          <span class="thread-category tag-green">{{ detail.category }}</span
          ><span v-if="detail.isPinned" class="page-pinned">고정</span
          ><time>{{ new Date(detail.createdAt).toLocaleString('ko-KR') }}</time>
        </div>
        <h1>{{ detail.title }}</h1>
        <div v-for="post in detail.replies" :key="post.id" class="detail-page-post">
          <div class="detail-page-author">
            <span class="avatar mint">{{ (post.author || '멤')[0] }}</span
            ><span
              ><strong>{{ post.author || '멤버' }}</strong
              ><small>{{ new Date(post.createdAt).toLocaleString('ko-KR') }}</small></span
            >
          </div>
          <ToastViewer :id="`post-page-${post.id}`" :model-value="post.markdown" />
        </div>
        <div v-if="detail.canModerate || detail.isAuthor" class="moderator-tools">
          <strong>운영 도구</strong
          ><button @click="moderate('pin')">
            {{ detail.isPinned ? '고정 해제' : '게시글 고정' }}</button
          ><button @click="moderate('lock')">
            {{ detail.isLocked ? '댓글 잠금 해제' : '댓글 잠금' }}</button
          ><button class="danger-button" @click="removeThread">게시글 숨기기</button>
        </div>
        <div v-if="!detail.isLocked" class="detail-page-reply">
          <h2>댓글 남기기</h2>
          <textarea
            v-model="draft"
            rows="5"
            placeholder="대화에 참여해 보세요."
            aria-label="댓글 내용"
          /><NuxtTurnstile
            v-if="turnstile.siteKey"
            v-model="token"
            :options="{ sitekey: turnstile.siteKey }"
          /><button
            class="primary-button"
            :disabled="sending || !draft.trim() || (!!turnstile.siteKey && !token)"
            @click="reply"
          >
            {{ sending ? '등록 중…' : '댓글 등록' }}
          </button>
        </div>
        <div v-if="!detail.isAuthor" class="report-page-inline">
          <button class="report-link" @click="reportOpen = !reportOpen">이 게시글 신고하기</button>
          <form v-if="reportOpen" class="report-page-form" @submit.prevent="report">
            <label for="report-reason">신고 사유</label
            ><select id="report-reason" v-model="reportReason">
              <option value="spam">스팸 또는 광고</option>
              <option value="harassment">괴롭힘 또는 혐오</option>
              <option value="inappropriate">부적절한 콘텐츠</option>
              <option value="other">기타</option></select
            ><textarea
              v-model="reportDetails"
              rows="3"
              placeholder="추가 설명 (선택)"
            /><NuxtTurnstile
              v-if="turnstile.siteKey"
              v-model="token"
              :options="{ sitekey: turnstile.siteKey }"
            /><button class="secondary-button" :disabled="!!turnstile.siteKey && !token">
              신고 접수
            </button>
          </form>
        </div>
      </article>
      <NuxtLink class="back-link" :to="`${forumPath}/threads`">← 이야기 목록으로</NuxtLink>
    </main>
  </div>
</template>
