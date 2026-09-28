<script setup lang="ts">
const route = useRoute();
const slug = computed(() => String(route.params.slug));
const base = computed(() => `/forums/${encodeURIComponent(slug.value)}`);
const endpoint = computed(() => `/api/forums/${encodeURIComponent(slug.value)}/moderation/mail`);
const { user } = useUserSession();
const { data: moderators } = await useFetch<Array<{ id: number; role: string }>>(
  () => `/api/forums/${encodeURIComponent(slug.value)}/moderation/moderators`
);
const canManage = computed(
  () =>
    moderators.value?.some(
      (moderator) =>
        moderator.id === Number(user.value?.id) &&
        ['global', 'owner', 'admin'].includes(moderator.role)
    ) || false
);
useSeoMeta({ title: 'Forum 메일 관리 | mori.space', robots: 'noindex, nofollow' });
</script>
<template>
  <div class="page-shell forum-page" :data-forum-slug="slug">
    <ForumTopbar :slug="slug" />
    <main class="page-content">
      <div class="page-breadcrumb">
        <NuxtLink :to="`${base}/admin`">운영 관리</NuxtLink><span> / 메일 관리</span>
      </div>
      <section class="page-heading">
        <div>
          <p class="section-kicker">EMAIL</p>
          <h1>Forum 메일 관리</h1>
          <p>이 Forum에 참여한 사용자에게 운영 안내를 보냅니다.</p>
        </div>
      </section>
      <MailComposer v-if="canManage" :endpoint="endpoint" forum-only />
      <p v-else class="page-alert">
        Forum 관리자 권한이 필요합니다. <NuxtLink to="/login">로그인</NuxtLink>
      </p>
    </main>
  </div>
</template>
