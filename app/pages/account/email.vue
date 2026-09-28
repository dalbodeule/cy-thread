<script setup lang="ts">
const { loggedIn, fetch: refreshSession } = useUserSession();
const email = ref('');
const saving = ref(false);
const error = ref('');
const saved = ref(false);
onMounted(async () => {
  if (!loggedIn.value) return navigateTo('/login');
  const status = await $fetch<{
    identityEmail: string | null;
    contactEmail: string | null;
    contactEmailVerified: boolean;
  }>('/api/account/email-status').catch(() => null);
  if (status?.identityEmail || status?.contactEmailVerified) return navigateTo('/');
  email.value = status?.contactEmail || '';
});
async function save() {
  saving.value = true;
  error.value = '';
  try {
    await $fetch('/api/account/email', { method: 'PATCH', body: { email: email.value } });
    await refreshSession();
    saved.value = true;
  } catch (caught) {
    error.value =
      (caught as { data?: { statusMessage?: string } }).data?.statusMessage ||
      '이메일을 저장하지 못했어요.';
  } finally {
    saving.value = false;
  }
}
</script>
<template>
  <div class="page-shell login-shell">
    <header class="page-topbar">
      <NuxtLink class="home-brand" to="/"
        ><span class="home-brand-icon">m</span><span>mori.space</span></NuxtLink
      ><ThemeControl />
    </header>
    <main class="login-card">
      <p class="section-kicker">CHZZK ACCOUNT</p>
      <h1>연락 이메일을 입력해 주세요</h1>
      <p>
        치지직은 이메일 주소를 제공하지 않습니다. 운영 관련 안내에 사용할 주소를 직접 입력해 주세요.
      </p>
      <p class="permission-note">
        입력한 주소는 계정 인증이나 Google 로그인 연결에 사용하지 않습니다.
      </p>
      <p v-if="error" class="page-alert" role="alert">{{ error }}</p>
      <p v-if="saved" class="page-success" role="status">
        확인 메일을 보냈어요. 받은 편지함에서 확인 링크를 열어 주세요.
      </p>
      <form v-if="!saved" class="contact-email-form" @submit.prevent="save">
        <label
          >이메일 주소<input
            v-model="email"
            type="email"
            autocomplete="email"
            required
            maxlength="254"
            placeholder="name@example.com"
        /></label>
        <button class="primary-button" :disabled="saving || !email.trim()">
          {{ saving ? '저장 중…' : '이메일 저장' }}
        </button>
      </form>
    </main>
  </div>
</template>
