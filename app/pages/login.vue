<script setup lang="ts">
const enabled = ref(false);
const { loggedIn } = useUserSession();
onMounted(async () => {
  if (loggedIn.value) {
    await navigateTo('/');
    return;
  }
  enabled.value = (
    await $fetch<{ google: boolean }>('/api/auth/provider-status').catch(() => ({ google: false }))
  ).google;
});
</script>

<template>
  <div class="page-shell login-shell">
    <header class="page-topbar">
      <NuxtLink class="brand" to="/"
        ><span class="brand-mark">c<span>y</span></span
        ><span class="brand-word">thread<span class="brand-dot">.</span></span></NuxtLink
      ><NuxtLink class="text-button" to="/">커뮤니티로 돌아가기</NuxtLink>
    </header>
    <main class="login-card">
      <div class="login-symbol">c<span>y</span></div>
      <p class="section-kicker">WELCOME TO CY THREAD</p>
      <h1>대화에 참여해 보세요</h1>
      <p>로그인하면 이야기를 쓰고, 댓글과 북마크를 남길 수 있어요.</p>
      <a v-if="enabled" class="primary-button login-button" href="/api/auth/google"
        >Google 계정으로 로그인 <span>↗</span></a
      ><button v-else class="primary-button login-button" disabled>
        Google 로그인을 준비하고 있어요</button
      ><small v-if="!enabled"
        >운영자가 Google OAuth 설정을 완료하면 로그인을 사용할 수 있습니다.</small
      ><NuxtLink class="back-link" to="/">둘러보기로 계속하기</NuxtLink>
    </main>
  </div>
</template>
