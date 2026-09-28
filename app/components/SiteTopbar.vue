<script setup lang="ts">
const { data: adminStatus } = await useFetch<{ isGlobalAdmin: boolean }>('/api/admin/status');
</script>
<template>
  <header class="page-topbar site-topbar">
    <NuxtLink class="home-brand" to="/"
      ><span class="home-brand-icon">m</span><span>mori.space</span></NuxtLink
    >
    <nav class="page-nav" aria-label="사이트 메뉴">
      <NuxtLink to="/">홈</NuxtLink><NuxtLink to="/explore">카테고리</NuxtLink
      ><NuxtLink to="/forums/request">Forum 개설</NuxtLink>
    </nav>
    <HeaderAccountActions :is-global-admin="adminStatus?.isGlobalAdmin" />
  </header>
</template>
