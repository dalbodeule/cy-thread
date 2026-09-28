<script setup lang="ts">
const { data: status } = await useFetch<{ isGlobalAdmin: boolean }>('/api/admin/status');
useSeoMeta({ title: '전체 메일 관리 | mori.space', robots: 'noindex, nofollow' });
</script>
<template>
  <div class="page-shell">
    <header class="page-topbar">
      <NuxtLink class="brand" to="/">mori.space</NuxtLink><NuxtLink to="/admin">관리도구</NuxtLink>
    </header>
    <main class="page-content">
      <div class="page-breadcrumb">
        <NuxtLink to="/admin">전체 관리자</NuxtLink><span> / 메일 관리</span>
      </div>
      <section class="page-heading">
        <div>
          <p class="section-kicker">EMAIL</p>
          <h1>전체 메일 관리</h1>
          <p>전체 사용자, Forum 또는 선택한 사용자에게 안내 메일을 보냅니다.</p>
        </div>
      </section>
      <MailComposer v-if="status?.isGlobalAdmin" endpoint="/api/admin/mail" />
      <p v-else class="page-alert">
        전체 관리자 권한이 필요합니다. <NuxtLink to="/login">로그인</NuxtLink>
      </p>
    </main>
  </div>
</template>
