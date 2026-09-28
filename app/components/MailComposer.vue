<script setup lang="ts">
const props = defineProps<{ endpoint: string; forumOnly?: boolean }>();
const route = useRoute();
const preselectedIds =
  !props.forumOnly && typeof route.query.users === 'string'
    ? [...new Set(route.query.users.split(',').map(Number))].filter(
        (id) => Number.isSafeInteger(id) && id > 0
      ).slice(0, 500)
    : [];
type Campaign = {
  id: number;
  subject: string;
  audience: string;
  status: string;
  queuedCount: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
};
const audience = ref<'all' | 'forum' | 'selected'>(
  props.forumOnly ? 'forum' : preselectedIds.length ? 'selected' : 'all'
);
const forumSlug = ref('');
const selectedText = ref(preselectedIds.join(', '));
const subject = ref('');
const body = ref('');
const campaigns = ref<Campaign[]>([]);
const error = ref('');
const notice = ref('');
const busy = ref(false);
function statusLabel(status: string) {
  return (
    (
      {
        queued: '대기',
        expanding: '대상 선정 중',
        sending: '발송 중',
        completed: '발송 완료',
        completed_with_errors: '일부 실패',
      } as Record<string, string>
    )[status] || status
  );
}
async function load() {
  try {
    campaigns.value = await $fetch<Campaign[]>(props.endpoint);
  } catch {
    error.value = '발송 기록을 불러오지 못했어요.';
  }
}
async function submit() {
  const selectedIds = selectedText.value
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
  if (
    audience.value === 'selected' &&
    (!selectedIds.length || selectedIds.some((id) => !Number.isSafeInteger(id) || id < 1))
  ) {
    error.value = '사용자 ID를 쉼표로 구분해 입력해 주세요.';
    return;
  }
  if (
    !window.confirm(
      '이 내용으로 발송 대기열을 생성할까요? 대상 사용자에게 실제 이메일이 전송됩니다.'
    )
  )
    return;
  busy.value = true;
  error.value = '';
  try {
    const response = await $fetch<{ id: number }>(props.endpoint, {
      method: 'POST',
      body: {
        audience: audience.value,
        forumSlug: forumSlug.value,
        selectedIds,
        subject: subject.value,
        body: body.value,
      },
    });
    notice.value = `메일 #${response.id}을 발송 대기열에 등록했어요.`;
    subject.value = '';
    body.value = '';
    await load();
  } catch {
    error.value = '메일을 예약하지 못했어요. 대상과 입력 내용을 확인해 주세요.';
  } finally {
    busy.value = false;
  }
}
onMounted(load);
</script>

<template>
  <section class="admin-panel appoint-panel">
    <h2>안내 메일 작성</h2>
    <p>
      발신: webmaster@mori.space (서버 설정에서 변경 가능). 수신을 허용하고 확인된 이메일 주소가
      등록된 사용자에게 발송합니다. Forum 대상은 소유자, 운영진, 팔로워, 게시글·댓글 작성자를
      포함합니다.
    </p>
    <p v-if="error" class="page-alert" role="alert">{{ error }}</p>
    <p v-if="notice" class="page-success" role="status">{{ notice }}</p>
    <form class="appoint-form mail-compose-form" @submit.prevent="submit">
      <label v-if="!forumOnly"
        ><span>발송 대상</span
        ><select v-model="audience">
          <option value="all">전체 사용자</option>
          <option value="forum">특정 Forum</option>
          <option value="selected">선택한 사용자</option>
        </select></label
      >
      <label v-if="!forumOnly && audience === 'forum'"
        ><span>Forum 주소(slug)</span><input v-model="forumSlug" required placeholder="notice"
      /></label>
      <label v-if="!forumOnly && audience === 'selected'"
        ><span>사용자 ID</span><input v-model="selectedText" required placeholder="12, 23, 45"
      /></label>
      <label
        ><span>제목</span><input v-model="subject" required minlength="3" maxlength="150"
      /></label>
      <label
        ><span>본문</span
        ><textarea v-model="body" required minlength="5" maxlength="10000" rows="9" />
      </label>
      <button class="primary-button" :disabled="busy">{{ busy ? '등록 중…' : '발송 예약' }}</button>
    </form>
  </section>
  <section class="admin-panel">
    <div class="admin-section-title">
      <h2>최근 발송</h2>
      <button class="secondary-button" @click="load">새로고침</button>
    </div>
    <p v-if="!campaigns.length" class="page-empty">발송 기록이 없습니다.</p>
    <div v-else class="moderator-list">
      <article v-for="item in campaigns" :key="item.id" class="moderator-row">
        <span class="moderator-identity"
          ><strong>#{{ item.id }} {{ item.subject }}</strong
          ><small
            >{{ new Date(item.createdAt).toLocaleString('ko-KR') }} · {{ item.audience }} ·
            {{ statusLabel(item.status) }}</small
          ></span
        >
        <span
          >대기 {{ item.queuedCount }} · 발송 {{ item.sentCount }} · 실패
          {{ item.failedCount }}</span
        >
      </article>
    </div>
  </section>
</template>
