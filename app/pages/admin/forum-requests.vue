<script setup lang="ts">
type Request = {
  id: number;
  name: string;
  slug: string;
  description: string;
  requester: string | null;
  requesterEmail: string | null;
  createdAt: string;
};
type RequestPage = { items: Request[]; page: number; total: number; totalPages: number };

const requests = ref<Request[]>([]);
const page = ref(1);
const total = ref(0);
const totalPages = ref(1);
const loading = ref(false);
const error = ref('');
const busyId = ref<number | null>(null);
const blockOnReject = ref<Record<number, boolean>>({});

async function load(nextPage = page.value) {
  loading.value = true;
  error.value = '';
  try {
    const result = await $fetch<RequestPage>('/api/admin/forum-requests', {
      query: { page: nextPage },
    });
    if (nextPage > result.totalPages) {
      await load(result.totalPages);
      return;
    }
    requests.value = result.items;
    page.value = result.page;
    total.value = result.total;
    totalPages.value = result.totalPages;
  } catch {
    error.value = '개설 신청을 불러오지 못했어요. 전체 관리자 권한을 확인해 주세요.';
  } finally {
    loading.value = false;
  }
}
async function decide(request: Request, decision: 'approve' | 'reject') {
  busyId.value = request.id;
  error.value = '';
  try {
    await $fetch(`/api/admin/forum-requests/${request.id}`, {
      method: 'PATCH',
      body: {
        decision,
        blockReapply: decision === 'reject' ? !!blockOnReject.value[request.id] : false,
      },
    });
    await load();
  } catch (caught) {
    error.value =
      (caught as { data?: { statusMessage?: string } }).data?.statusMessage ||
      '신청을 처리하지 못했어요. 주소 중복 또는 상태를 확인해 주세요.';
  } finally {
    busyId.value = null;
  }
}
onMounted(() => void load());
</script>

<template>
  <div class="page-shell">
    <SiteTopbar />
    <main class="page-content">
      <section class="page-heading">
        <div>
          <p class="section-kicker">GLOBAL ADMIN</p>
          <h1>Forum 개설 신청</h1>
          <p>신청 내용과 주소를 확인한 뒤 승인하거나 반려합니다.</p>
        </div>
      </section>
      <p v-if="error" class="page-alert" role="alert">{{ error }}</p>
      <section class="admin-panel forum-request-review" aria-label="개설 신청 목록">
        <div class="forum-request-history-heading">
          <h2>검토 대기</h2>
          <span>총 {{ total.toLocaleString('ko-KR') }}건</span>
        </div>
        <LoadingSpinner v-if="loading" label="신청 목록을 불러오는 중…" />
        <p v-else-if="!requests.length" class="page-empty">대기 중인 신청이 없습니다.</p>
        <div v-else class="forum-request-list">
          <article v-for="request in requests" :key="request.id" class="forum-request-item">
            <div class="forum-request-item-head">
              <div>
                <strong>{{ request.name }}</strong>
                <small>/{{ request.slug }}</small>
              </div>
              <span class="forum-request-status forum-request-status-pending">검토 중</span>
            </div>
            <p v-if="request.description" class="forum-request-description">
              {{ request.description }}
            </p>
            <div class="forum-request-meta">
              <span>{{ request.requester || '멤버' }}</span>
              <span v-if="request.requesterEmail">{{ request.requesterEmail }}</span>
              <span>신청 {{ new Date(request.createdAt).toLocaleString('ko-KR') }}</span>
            </div>
            <div class="forum-request-review-actions">
              <label class="forum-request-reject-option">
                <input
                  v-model="blockOnReject[request.id]"
                  type="checkbox"
                  :disabled="busyId !== null"
                />
                반려하면 1주일간 새 신청 제한
              </label>
              <div>
                <button
                  class="primary-button"
                  :disabled="busyId !== null"
                  @click="decide(request, 'approve')"
                >
                  <LoadingSpinner v-if="busyId === request.id" compact label="처리 중…" />
                  <template v-else>승인</template>
                </button>
                <button
                  class="secondary-button"
                  :disabled="busyId !== null"
                  @click="decide(request, 'reject')"
                >
                  반려
                </button>
              </div>
            </div>
          </article>
        </div>
        <nav v-if="totalPages > 1" class="forum-request-pagination" aria-label="개설 신청 페이지">
          <button
            type="button"
            class="secondary-button"
            :disabled="loading || page <= 1"
            @click="load(page - 1)"
          >
            이전
          </button>
          <span>{{ page }} / {{ totalPages }}</span>
          <button
            type="button"
            class="secondary-button"
            :disabled="loading || page >= totalPages"
            @click="load(page + 1)"
          >
            다음
          </button>
        </nav>
      </section>
    </main>
  </div>
</template>
