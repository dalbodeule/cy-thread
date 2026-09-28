<script setup lang="ts">
type Request = {
  id: number;
  name: string;
  slug: string;
  requester: string | null;
  requesterEmail: string | null;
  createdAt: string;
};
const requests = ref<Request[]>([]);
const error = ref('');
const busyId = ref<number | null>(null);
async function load() {
  try {
    requests.value = await $fetch<Request[]>('/api/admin/forum-requests');
    error.value = '';
  } catch {
    error.value = '전체 관리자만 개설 신청을 검토할 수 있어요.';
  }
}
async function decide(request: Request, decision: 'approve' | 'reject') {
  busyId.value = request.id;
  try {
    await $fetch(`/api/admin/forum-requests/${request.id}`, {
      method: 'PATCH',
      body: { decision },
    });
    await load();
  } catch {
    error.value = '신청을 처리하지 못했어요. 주소 중복 또는 상태를 확인해 주세요.';
  } finally {
    busyId.value = null;
  }
}
onMounted(load);
</script>
<template>
  <div class="page-shell">
    <header class="page-topbar">
      <NuxtLink class="home-brand" to="/"
        ><span class="home-brand-icon">m</span><span>mori.space</span></NuxtLink
      >
      <nav class="page-nav">
        <NuxtLink to="/">홈</NuxtLink><NuxtLink to="/admin">전체 관리</NuxtLink>
      </nav>
    </header>
    <main class="page-content">
      <section class="page-heading">
        <div>
          <p class="section-kicker">GLOBAL ADMIN</p>
          <h1>Forum 개설 신청</h1>
          <p>신청 내용을 확인한 뒤 승인하거나 거절합니다.</p>
        </div>
      </section>
      <p v-if="error" class="page-alert" role="alert">{{ error }}</p>
      <section v-else class="category-admin-list">
        <article v-for="request in requests" :key="request.id" class="category-admin-row">
          <div>
            <strong>{{ request.name }}</strong>
            <p>/{{ request.slug }}</p>
            <small
              >{{ request.requester || request.requesterEmail || '멤버' }} ·
              {{ new Date(request.createdAt).toLocaleString('ko-KR') }}</small
            >
          </div>
          <div>
            <button
              class="primary-button"
              :disabled="busyId !== null"
              @click="decide(request, 'approve')"
            >
              승인</button
            ><button
              class="secondary-button"
              :disabled="busyId !== null"
              @click="decide(request, 'reject')"
            >
              거절
            </button>
          </div>
        </article>
        <p v-if="!requests.length" class="page-empty">대기 중인 신청이 없습니다.</p>
      </section>
    </main>
  </div>
</template>
