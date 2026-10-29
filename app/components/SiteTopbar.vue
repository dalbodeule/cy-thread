<script setup lang="ts">
const route = useRoute();
const mobileMenuOpen = ref(false);
const { data: adminStatus } = await useFetch<{ isGlobalAdmin: boolean }>('/api/admin/status');
watch(
  () => route.fullPath,
  () => {
    mobileMenuOpen.value = false;
  }
);
</script>
<template>
  <header class="page-topbar site-topbar" @keydown.esc="mobileMenuOpen = false">
    <NuxtLink class="home-brand" to="/"
      ><span class="home-brand-icon">m</span><span>mori.space</span></NuxtLink
    >
    <nav class="page-nav" aria-label="사이트 메뉴">
      <NuxtLink to="/">홈</NuxtLink><NuxtLink to="/explore">카테고리</NuxtLink
      ><NuxtLink to="/forums/request">Forum 개설</NuxtLink>
    </nav>
    <HeaderAccountActions :is-global-admin="adminStatus?.isGlobalAdmin" />
    <button
      class="site-mobile-menu-button"
      type="button"
      aria-label="사이트 메뉴 열기"
      :aria-expanded="mobileMenuOpen"
      aria-controls="site-mobile-menu"
      @click="mobileMenuOpen = !mobileMenuOpen"
    >
      <span aria-hidden="true">☰</span>
    </button>
    <Transition name="mobile-drawer-backdrop">
      <div
        v-if="mobileMenuOpen"
        class="site-mobile-menu-backdrop"
        aria-hidden="true"
        @click="mobileMenuOpen = false"
      />
    </Transition>
    <Transition name="mobile-drawer-panel">
      <aside
        v-if="mobileMenuOpen"
        id="site-mobile-menu"
        class="site-mobile-menu is-open"
        role="dialog"
        aria-modal="true"
        aria-label="사이트 메뉴"
      >
        <div class="site-mobile-menu-head">
          <strong>메뉴</strong>
          <button type="button" aria-label="메뉴 닫기" @click="mobileMenuOpen = false">×</button>
        </div>
        <nav class="site-mobile-menu-nav" aria-label="사이트 메뉴">
          <NuxtLink to="/" @click="mobileMenuOpen = false">홈</NuxtLink>
          <NuxtLink to="/explore" @click="mobileMenuOpen = false">카테고리</NuxtLink>
          <NuxtLink to="/forums/request" @click="mobileMenuOpen = false">Forum 개설</NuxtLink>
        </nav>
        <HeaderAccountActions :is-global-admin="adminStatus?.isGlobalAdmin" mobile-drawer />
      </aside>
    </Transition>
  </header>
</template>
