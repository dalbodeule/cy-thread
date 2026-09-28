<script setup lang="ts">
const { user, loggedIn, fetch: refreshSession } = useUserSession();
const { data: emailStatus } = await useFetch<{
  identityEmail: string | null;
  contactEmail: string | null;
  contactEmailVerified: boolean;
}>('/api/account/email-status', { immediate: loggedIn.value });
const name = ref(user.value?.name || '');
const saving = ref(false);
const notice = ref('');
const error = ref('');
watch(user, (value) => {
  if (value && !name.value) name.value = value.name || '';
});
async function save() {
  saving.value = true;
  error.value = '';
  try {
    await $fetch('/api/account/profile', { method: 'PATCH', body: { name: name.value } });
    await refreshSession();
    notice.value = '프로필을 저장했어요.';
  } catch {
    error.value = '이름을 저장하지 못했어요. 2~40자로 입력해 주세요.';
  } finally {
    saving.value = false;
  }
}
useSeoMeta({ title: '프로필 | mori.space', robots: 'noindex, nofollow' });
</script>
<template>
  <div class="page-shell">
    <header class="page-topbar">
      <NuxtLink class="home-brand" to="/"
        ><span class="home-brand-icon">m</span><span>mori.space</span></NuxtLink
      ><ThemeControl />
    </header>
    <main class="page-content">
      <div class="page-breadcrumb"><NuxtLink to="/">홈</NuxtLink><span> / 프로필</span></div>
      <section class="page-heading">
        <div>
          <p class="section-kicker">ACCOUNT</p>
          <h1>프로필</h1>
          <p>커뮤니티에서 사용할 이름을 변경할 수 있어요.</p>
        </div>
      </section>
      <p v-if="!loggedIn" class="page-alert"><NuxtLink to="/login">로그인</NuxtLink>해 주세요.</p>
      <form v-else class="admin-panel mail-compose-form" @submit.prevent="save">
        <p v-if="error" class="page-alert" role="alert">{{ error }}</p>
        <p v-if="notice" class="page-success" role="status">{{ notice }}</p>
        <label
          ><span>닉네임</span><input v-model="name" required minlength="2" maxlength="40"
        /></label>
        <p>
          연락 이메일: {{ user?.email || '미등록' }}
          <span v-if="emailStatus?.contactEmail && !emailStatus.contactEmailVerified"
            >(확인 대기)</span
          >
        </p>
        <NuxtLink
          v-if="emailStatus?.contactEmail && !emailStatus.contactEmailVerified"
          class="back-link"
          to="/account/email"
          >확인 메일 다시 보내기 →</NuxtLink
        >
        <button class="primary-button" :disabled="saving">
          {{ saving ? '저장 중…' : '저장' }}
        </button>
      </form>
    </main>
  </div>
</template>
