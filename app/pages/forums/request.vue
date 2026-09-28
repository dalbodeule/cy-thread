<script setup lang="ts">
const { loggedIn } = useUserSession();
const name = ref('');
const slug = ref('');
const pending = ref(false);
const error = ref('');
const notice = ref('');
type Request = { id: number; name: string; slug: string; status: string };
const requests = ref<Request[]>([]);
async function load() {
  if (!loggedIn.value) return;
  requests.value = await $fetch<Request[]>('/api/my-forum-requests').catch(() => []);
}
onMounted(load);
async function submit() {
  pending.value = true;
  error.value = '';
  try {
    const result = await $fetch<Request>('/api/forums', {
      method: 'POST',
      body: { name: name.value, slug: slug.value },
    });
    notice.value = `${result.name} 개설 신청을 접수했어요. 전체 관리자 승인을 기다려 주세요.`;
    name.value = '';
    slug.value = '';
    await load();
  } catch (caught) {
    error.value =
      (caught as { data?: { statusMessage?: string } }).data?.statusMessage ||
      '개설 신청을 접수하지 못했어요.';
  } finally {
    pending.value = false;
  }
}
useSeoMeta({ title: 'Forum 개설 신청 | mori.space', robots: 'noindex, nofollow' });
</script>
<template>
  <div class="page-shell">
    <header class="page-topbar">
      <NuxtLink class="home-brand" to="/"
        ><span class="home-brand-icon">m</span><span>mori.space</span></NuxtLink
      ><ThemeControl />
    </header>
    <main class="page-content">
      <div class="page-breadcrumb">
        <NuxtLink to="/">홈</NuxtLink><span> / Forum 개설 신청</span>
      </div>
      <section class="page-heading">
        <div>
          <p class="section-kicker">NEW FORUM</p>
          <h1>Forum 개설 신청</h1>
          <p>새로운 주제의 커뮤니티를 제안해 주세요. 전체 관리자 검토 후 개설됩니다.</p>
        </div>
      </section>
      <p v-if="!loggedIn" class="page-alert">
        신청하려면 <NuxtLink to="/login">로그인</NuxtLink>해 주세요.
      </p>
      <template v-else
        ><p v-if="error" class="page-alert" role="alert">{{ error }}</p>
        <p v-if="notice" class="page-success" role="status">{{ notice }}</p>
        <form class="admin-panel mail-compose-form" @submit.prevent="submit">
          <label
            ><span>Forum 이름</span
            ><input
              v-model="name"
              required
              minlength="2"
              maxlength="60"
              placeholder="예: 사진 이야기"
          /></label>
          <label
            ><span>주소</span
            ><input
              v-model="slug"
              required
              maxlength="50"
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              placeholder="예: photo-talk"
          /></label>
          <button class="primary-button" :disabled="pending">
            {{ pending ? '신청 중…' : '개설 신청' }}
          </button>
        </form>
        <section v-if="requests.length" class="admin-panel">
          <h2>내 신청 내역</h2>
          <p v-for="item in requests" :key="item.id">
            {{ item.name }} · /{{ item.slug }} ·
            {{
              item.status === 'pending' ? '검토 중' : item.status === 'approved' ? '승인' : '거절'
            }}
          </p>
        </section>
      </template>
    </main>
  </div>
</template>
