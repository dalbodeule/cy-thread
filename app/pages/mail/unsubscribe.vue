<script setup lang="ts">
const route = useRoute();
const token = computed(() => String(route.query.token || ''));
const finished = ref(false);
const error = ref('');
useSeoMeta({ title: '이메일 수신 거부 | mori.space', robots: 'noindex, nofollow' });
async function unsubscribe() {
  try {
    await $fetch('/api/mail/unsubscribe', { method: 'POST', body: { token: token.value } });
    finished.value = true;
  } catch {
    error.value = '수신 설정을 변경하지 못했어요. 링크를 확인해 주세요.';
  }
}
</script>

<template>
  <main class="page-shell page-content">
    <NuxtLink class="back-link" to="/">← mori.space</NuxtLink>
    <section class="admin-panel">
      <h1>이메일 수신 거부</h1>
      <p v-if="finished" role="status">운영 안내 메일 수신을 해제했어요.</p>
      <template v-else>
        <p>
          운영 안내 메일을 더 이상 받지 않습니다. 계정 또는 Forum 이용 정지 안내는 계속 전달될 수
          있습니다.
        </p>
        <p v-if="error" class="page-alert" role="alert">{{ error }}</p>
        <button class="primary-button" :disabled="!token" @click="unsubscribe">
          수신 거부하기
        </button>
      </template>
    </section>
  </main>
</template>
