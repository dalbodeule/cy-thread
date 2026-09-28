<script setup lang="ts">
const route = useRoute();
const token = computed(() => String(route.query.token || ''));
const verified = ref(false);
const error = ref('');
useSeoMeta({ title: '연락 이메일 확인 | mori.space', robots: 'noindex, nofollow' });
async function verify() {
  try {
    await $fetch('/api/account/verify-email', { method: 'POST', body: { token: token.value } });
    verified.value = true;
  } catch {
    error.value = '링크가 만료되었거나 이미 사용되었습니다.';
  }
}
</script>
<template>
  <main class="page-shell page-content">
    <section class="admin-panel">
      <h1>연락 이메일 확인</h1>
      <p v-if="verified" role="status">
        이메일 주소가 확인되었습니다. 운영 관련 안내를 받을 수 있어요.
      </p>
      <template v-else
        ><p>메일을 받은 주소의 소유자라면 아래 버튼을 눌러 확인해 주세요.</p>
        <p v-if="error" class="page-alert" role="alert">
          {{ error }} <NuxtLink to="/account/email">확인 메일 다시 보내기</NuxtLink>
        </p>
        <button class="primary-button" :disabled="!token" @click="verify">
          이메일 확인
        </button></template
      >
      <NuxtLink class="back-link" to="/">홈으로</NuxtLink>
    </section>
  </main>
</template>
