<script setup lang="ts">
defineProps<{ isGlobalAdmin?: boolean }>();
const { user, loggedIn, clear } = useUserSession();
async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' });
  await clear();
  await navigateTo('/');
}
</script>
<template>
  <div class="header-account-actions">
    <ThemeControl />
    <template v-if="loggedIn">
      <div class="header-account-desktop">
        <NuxtLink class="header-profile-link" to="/account/profile"
          ><UserAvatar :src="user?.avatarUrl" :name="user?.name" /><span>{{
            user?.name || '멤버'
          }}</span></NuxtLink
        >
        <NuxtLink v-if="isGlobalAdmin" class="admin-tool-button" to="/admin">관리도구</NuxtLink>
        <button type="button" class="text-button" @click="logout">로그아웃</button>
      </div>
      <details class="header-mobile-menu">
        <summary><UserAvatar :src="user?.avatarUrl" :name="user?.name" /><span>계정</span></summary>
        <div class="header-mobile-menu-panel">
          <NuxtLink to="/account/profile">내 프로필</NuxtLink>
          <NuxtLink v-if="isGlobalAdmin" to="/admin">관리도구</NuxtLink>
          <button type="button" @click="logout">로그아웃</button>
        </div>
      </details>
    </template>
    <NuxtLink v-else class="primary-button header-login" to="/login">로그인</NuxtLink>
  </div>
</template>
