<script setup lang="ts">
type Report = {
  id: number;
  reason: string;
  details: string | null;
  status: string;
  createdAt: string;
  threadId: number | null;
  threadTitle: string | null;
  threadAuthorUserId: number | null;
  threadDeleted: boolean;
  reporter: string | null;
};
const route = useRoute();
const slug = computed(() => String(route.params.slug));
const forumPath = computed(() => `/forums/${encodeURIComponent(slug.value)}`);
const status = ref<'open' | 'resolved' | 'dismissed'>('open');
const rows = ref<Report[]>([]);
const error = ref('');
const loading = ref(false);
const api = (path: string) => `/api/forums/${encodeURIComponent(slug.value)}/moderation${path}`;
async function load() {
  loading.value = true;
  try {
    rows.value = await $fetch<Report[]>(api('/reports'), {
      params: { status: status.value, limit: 100 },
    });
    error.value = '';
  } catch {
    rows.value = [];
    error.value = '운영진 권한이 필요하거나 신고 목록을 불러오지 못했어요.';
  } finally {
    loading.value = false;
  }
}
async function update(report: Report, next: 'resolved' | 'dismissed') {
  try {
    await $fetch(api(`/reports/${report.id}`), { method: 'PATCH', body: { status: next } });
    await load();
  } catch {
    error.value = '신고 상태를 변경하지 못했어요.';
  }
}
async function ban(report: Report) {
  if (!report.threadAuthorUserId || !window.confirm('게시글 작성자를 이 커뮤니티에서 차단할까요?'))
    return;
  try {
    await $fetch(api('/bans'), {
      method: 'POST',
      body: {
        userId: report.threadAuthorUserId,
        banned: true,
        reason: `신고 검토: ${report.reason}`,
      },
    });
    if (report.status === 'open') await update(report, 'resolved');
    else await load();
  } catch {
    error.value = '멤버를 차단하지 못했어요.';
  }
}
watch([slug, status], () => void load(), { immediate: true });
function date(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value)
  );
}
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
      <NuxtLink class="text-button" to="/login">계정</NuxtLink>
    </header>
    <main class="page-content">
      <div class="page-breadcrumb">
        <NuxtLink :to="`${forumPath}/admin`">운영 관리</NuxtLink><span> / 신고함</span>
      </div>
      <section class="page-heading">
        <div>
          <p class="section-kicker">COMMUNITY SAFETY</p>
          <h1>신고함</h1>
          <p>신고 내용을 검토하고 조치를 기록합니다.</p>
        </div>
      </section>
      <div class="page-tabs report-tabs">
        <button
          v-for="item in [
            ['open', '미처리'],
            ['resolved', '처리 완료'],
            ['dismissed', '기각'],
          ] as const"
          :key="item[0]"
          :class="{ active: status === item[0] }"
          @click="status = item[0]"
        >
          {{ item[1] }}
        </button>
      </div>
      <p v-if="error" class="page-alert" role="alert">{{ error }}</p>
      <div v-if="loading" class="page-empty">신고를 불러오는 중…</div>
      <div v-else-if="!rows.length && !error" class="page-empty">
        <strong>확인할 신고가 없습니다</strong>
        <p>새 신고가 접수되면 이곳에서 검토할 수 있어요.</p>
      </div>
      <section v-else class="report-page-list">
        <article v-for="report in rows" :key="report.id" class="report-page-card">
          <div class="report-page-head">
            <span class="role-badge" :class="`report-${report.status}`">{{ report.reason }}</span
            ><time>{{ date(report.createdAt) }}</time>
          </div>
          <h2>
            {{
              report.threadDeleted ? '숨김 처리된 게시글' : report.threadTitle || '삭제된 게시글'
            }}
          </h2>
          <p>{{ report.details || '추가 설명이 없습니다.' }}</p>
          <small
            >신고자 {{ report.reporter || '멤버' }} · 게시글 작성자
            {{ report.threadAuthorUserId || '확인 불가' }}</small
          >
          <div class="report-page-actions">
            <NuxtLink
              v-if="report.threadId && !report.threadDeleted"
              class="secondary-button"
              :to="`${forumPath}/threads/${report.threadId}`"
              >게시글 보기</NuxtLink
            ><button
              v-if="status === 'open'"
              class="secondary-button"
              @click="update(report, 'dismissed')"
            >
              기각</button
            ><button
              v-if="status === 'open'"
              class="primary-button"
              @click="update(report, 'resolved')"
            >
              처리 완료</button
            ><button v-if="report.threadAuthorUserId" class="danger-button" @click="ban(report)">
              작성자 차단
            </button>
          </div>
        </article>
      </section>
      <NuxtLink class="back-link" :to="`${forumPath}/admin`">← 운영 관리</NuxtLink>
    </main>
  </div>
</template>
