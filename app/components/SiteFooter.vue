<script setup lang="ts">
const route = useRoute();
const forumPath = computed(() => {
  const slug = /^\/forums\/([a-z0-9-]+)(?:\/|$)/.exec(route.path)?.[1];
  return slug ? `/forums/${encodeURIComponent(slug)}/threads` : null;
});
</script>
<template>
  <footer class="site-footer">
    <div class="site-footer-inner">
      <div class="site-footer-about">
        <NuxtLink to="/">mori.space</NuxtLink><span>관심사가 모이는 커뮤니티</span>
      </div>
      <nav aria-label="바닥글 메뉴">
        <NuxtLink to="/">홈</NuxtLink><NuxtLink to="/explore">카테고리</NuxtLink
        ><NuxtLink to="/forums/request">Forum 개설</NuxtLink
        ><NuxtLink v-if="forumPath" :to="forumPath">Forum 게시글</NuxtLink>
      </nav>
      <a class="site-footer-contact" href="mailto:webmaster@mori.space"
        >문의 webmaster@mori.space</a
      >
    </div>
  </footer>
</template>
