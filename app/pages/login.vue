<script setup lang="ts">
const enabled = ref({ google: false, chzzk: false });
const { loggedIn } = useUserSession();
const route = useRoute();
useSeoMeta({ title: '로그인 | mori.space', robots: 'noindex, nofollow' });
onMounted(async () => {
  if (loggedIn.value) {
    await navigateTo('/');
    return;
  }
  enabled.value = await $fetch<{ google: boolean; chzzk: boolean }>(
    '/api/auth/provider-status'
  ).catch(() => ({ google: false, chzzk: false }));
});
</script>

<template>
  <div class="page-shell login-shell">
    <header class="page-topbar">
      <NuxtLink class="home-brand" to="/"
        ><span class="home-brand-icon">m</span><span>mori.space</span></NuxtLink
      ><NuxtLink class="text-button" to="/">홈으로 돌아가기</NuxtLink>
    </header>
    <main class="login-card">
      <div class="login-symbol">m</div>
      <p class="section-kicker">WELCOME TO MORI.SPACE</p>
      <h1>대화에 참여해 보세요</h1>
      <p>로그인하면 이야기를 쓰고, 댓글과 북마크를 남길 수 있어요.</p>
      <p v-if="route.query.auth === 'error'" class="page-alert" role="alert">
        로그인을 완료하지 못했어요. 다시 시도해 주세요.
      </p>
      <a v-if="enabled.google" class="primary-button login-button" href="/api/auth/google"
        >Google 계정으로 로그인 <span>↗</span></a
      ><a v-if="enabled.chzzk" class="primary-button login-button" href="/api/auth/chzzk"
        >CHZZK 계정으로 로그인 <span>↗</span></a
      ><small v-if="!enabled.google && !enabled.chzzk"
        >운영자가 소셜 로그인 설정을 완료하면 로그인할 수 있습니다.</small
      ><NuxtLink class="back-link" to="/">둘러보기로 계속하기</NuxtLink>
    </main>
  </div>
</template>
