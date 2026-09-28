<script setup lang="ts">
const route = useRoute();
const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''));
const verified = ref(false);
const verifying = ref(false);
const error = ref('');
useSeoMeta({ title: '연락 이메일 확인 | mori.space', robots: 'noindex, nofollow' });
async function verify() {
  if (!token.value || verifying.value) return;
  verifying.value = true;
  error.value = '';
  try {
    await $fetch('/api/account/verify-email', { method: 'POST', body: { token: token.value } });
    verified.value = true;
  } catch {
    error.value = '링크가 만료되었거나 이미 사용되었습니다.';
  } finally {
    verifying.value = false;
  }
}
</script>
<template>
  <div class="page-shell email-verify-shell">
    <header class="page-topbar">
      <NuxtLink class="home-brand" to="/">
        <span class="home-brand-icon">m</span><span>mori.space</span>
      </NuxtLink>
      <ThemeControl />
    </header>
    <main class="email-verify-main">
      <section class="email-verify-card" aria-labelledby="email-verify-title">
        <span class="email-verify-icon" aria-hidden="true">✉</span>
        <p class="section-kicker">ACCOUNT EMAIL</p>
        <h1 id="email-verify-title">연락 이메일 확인</h1>
        <p v-if="verified" class="email-verify-description" role="status">
          이메일 주소가 확인되었습니다. 이제 운영 관련 안내를 받을 수 있어요.
        </p>
        <template v-else>
          <p class="email-verify-description">
            메일을 받은 주소의 소유자라면 아래 버튼을 눌러 확인해 주세요.
          </p>
          <p v-if="!token" class="page-alert" role="alert">
            확인 링크에 필요한 정보가 없습니다. 메일에 있는 링크를 다시 열어 주세요.
          </p>
          <p v-if="error" class="page-alert" role="alert">
            {{ error }} <NuxtLink to="/account/email">확인 메일 다시 보내기</NuxtLink>
          </p>
        </template>
        <div class="email-verify-actions">
          <button
            v-if="!verified"
            class="primary-button"
            type="button"
            :disabled="!token || verifying"
            @click="verify"
          >
            {{ verifying ? '확인 중…' : '이메일 확인' }}
          </button>
          <NuxtLink class="email-verify-home" to="/">홈으로</NuxtLink>
        </div>
      </section>
    </main>
  </div>
</template>
