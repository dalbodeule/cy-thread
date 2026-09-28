<script setup lang="ts">
const props = defineProps<{ endpoint: string; forumOnly?: boolean }>();
const route = useRoute();
const preselectedIds =
  !props.forumOnly && typeof route.query.users === 'string'
    ? [...new Set(route.query.users.split(',').map(Number))]
        .filter((id) => Number.isSafeInteger(id) && id > 0)
        .slice(0, 500)
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
const templates = {
  notice: {
    label: '일반 안내',
    subject: '[mori.space] 운영 안내',
    body: '안녕하세요, mori.space 운영진입니다.\n\n{{안내 내용}}\n\n궁금한 점은 이 메일에 회신해 주세요.',
  },
  maintenance: {
    label: '서비스 점검',
    subject: '[mori.space] 서비스 점검 안내',
    body: '안녕하세요, mori.space 운영진입니다.\n\n서비스 점검 일시: {{점검 일시}}\n영향받는 기능: {{영향받는 기능}}\n\n이용에 불편을 드려 죄송합니다. 점검이 끝나면 다시 안내드리겠습니다.',
  },
  policy: {
    label: '운영 정책',
    subject: '[mori.space] 운영 정책 안내',
    body: '안녕하세요, mori.space 운영진입니다.\n\n변경 또는 안내 사항: {{변경 사항}}\n적용 일시: {{적용 일시}}\n\n자세한 내용은 mori.space에서 확인해 주세요.',
  },
} as const;
type TemplateKey = keyof typeof templates;
const selectedTemplate = ref<TemplateKey>('notice');
const hasUnfilledFields = computed(() => /\{\{[^{}]+\}\}/.test(body.value));
const recipientDescription = computed(() => {
  if (props.forumOnly) return '이 Forum의 참여 사용자';
  if (audience.value === 'all') return '전체 사용자';
  if (audience.value === 'forum')
    return forumSlug.value.trim() ? `${forumSlug.value.trim()} Forum 참여 사용자` : 'Forum 미선택';
  const count = [...new Set(selectedText.value.split(/[\s,]+/).filter(Boolean))].length;
  return `선택한 사용자 ${count}명`;
});
function applyTemplate() {
  if (
    (subject.value.trim() || body.value.trim()) &&
    !window.confirm('작성 중인 제목과 본문을 선택한 양식으로 바꿀까요?')
  )
    return;
  const template = templates[selectedTemplate.value];
  subject.value = template.subject;
  body.value = template.body;
}
function statusLabel(status: string, queuedCount: number) {
  if (status === 'completed' && queuedCount === 0) return '발송 대상 없음';
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
  if (hasUnfilledFields.value) {
    error.value = '양식의 중괄호 항목을 실제 내용으로 바꿔 주세요.';
    return;
  }
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
      `${recipientDescription.value}에게 실제 이메일을 발송할까요? 발송 대기열에 등록되면 취소할 수 없습니다.`
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
    <form class="mail-compose-form" @submit.prevent="submit">
      <div class="mail-template-picker">
        <label
          ><span>안내 양식</span
          ><select v-model="selectedTemplate">
            <option v-for="(template, key) in templates" :key="key" :value="key">
              {{ template.label }}
            </option>
          </select></label
        >
        <button class="secondary-button" type="button" @click="applyTemplate">양식 불러오기</button>
      </div>
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
        ><span>사용자 ID</span
        ><input v-model="selectedText" required placeholder="12, 23, 45" /><small
          ><NuxtLink to="/admin/users">사용자 목록에서 수신자를 선택할 수 있어요 →</NuxtLink></small
        ></label
      >
      <label
        ><span>제목</span><input v-model="subject" required minlength="3" maxlength="150"
      /></label>
      <label
        ><span>본문</span
        ><textarea v-model="body" required minlength="5" maxlength="10000" rows="9" />
        <small>{{ body.length.toLocaleString('ko-KR') }} / 10,000자</small>
        <small v-if="hasUnfilledFields" class="mail-template-warning"
          >중괄호 항목을 실제 내용으로 바꿔야 발송할 수 있어요.</small
        >
      </label>
      <div class="mail-preview" aria-label="메일 미리보기">
        <div class="mail-preview-heading">
          <span>발송 전 미리보기</span><small>HTML · 일반 텍스트 함께 발송</small>
        </div>
        <div class="mail-preview-paper">
          <strong>mori.space</strong>
          <p class="mail-preview-subject">
            {{ subject.trim() || '메일 제목이 여기에 표시됩니다.' }}
          </p>
          <p class="mail-preview-body">
            {{ body.trim() || '본문을 작성하면 여기에서 내용을 확인할 수 있어요.' }}
          </p>
          <small>발신: webmaster@mori.space · 수신: {{ recipientDescription }}</small>
          <small>단체 메일에는 수신 거부 링크가 자동으로 추가됩니다.</small>
        </div>
      </div>
      <button
        class="primary-button"
        :disabled="busy || !subject.trim() || !body.trim() || hasUnfilledFields"
      >
        {{ busy ? '등록 중…' : '발송 대기열에 등록' }}
      </button>
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
            {{ statusLabel(item.status, item.queuedCount) }}</small
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
