<script setup lang="ts">
type Profile = {
  id: number;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string;
  isBlocked: boolean;
  threads: Array<{
    id: number;
    title: string;
    forumSlug: string;
    forumName: string;
    category: string;
  }>;
  posts: Array<{
    id: number;
    threadId: number;
    threadTitle: string;
    forumSlug: string;
    forumName: string;
    excerpt: string;
  }>;
};
const route = useRoute();
const { loggedIn } = useUserSession();
const { data: profile, refresh } = await useFetch<Profile>(
  () => `/api/users/${Number(route.params.userId)}`
);
const notice = ref('');
async function toggleBlock() {
  if (!loggedIn.value || !profile.value) return navigateTo('/login');
  try {
    const result = await $fetch<{ blocked: boolean }>('/api/account/blocks', {
      method: 'POST',
      body: { userId: profile.value.id, blocked: !profile.value.isBlocked },
    });
    profile.value.isBlocked = result.blocked;
    notice.value = result.blocked ? '이 사용자를 차단했어요.' : '차단을 해제했어요.';
    await refresh();
  } catch {
    notice.value = '차단 상태를 변경하지 못했어요.';
  }
}
useSeoMeta({
  title: () => `${profile.value?.name || '사용자'} 프로필 | mori.space`,
  robots: 'noindex, nofollow',
});
</script>
<template>
  <div class="page-shell">
    <SiteTopbar />
    <main class="page-content">
      <div v-if="profile" class="profile-public-head">
        <UserAvatar :src="profile.avatarUrl" :name="profile.name" large />
        <div>
          <p class="section-kicker">MEMBER</p>
          <h1>{{ profile.name || '멤버' }}</h1>
          <p>가입 {{ new Date(profile.createdAt).toLocaleDateString('ko-KR') }}</p>
        </div>
        <button v-if="loggedIn" class="secondary-button" type="button" @click="toggleBlock">
          {{ profile.isBlocked ? '차단 해제' : '사용자 차단' }}
        </button>
      </div>
      <p v-if="notice" class="page-success" role="status">{{ notice }}</p>
      <section v-if="profile" class="admin-panel">
        <h2>작성한 게시글</h2>
        <p v-if="!profile.threads.length" class="page-empty">공개 게시글이 없어요.</p>
        <NuxtLink
          v-for="item in profile.threads"
          :key="item.id"
          class="page-thread-row"
          :to="`/forums/${encodeURIComponent(item.forumSlug)}/threads/${item.id}`"
          ><strong>{{ item.title }}</strong
          ><small>{{ item.forumName }} · {{ item.category }}</small></NuxtLink
        >
      </section>
      <section v-if="profile" class="admin-panel">
        <h2>작성한 댓글</h2>
        <p v-if="!profile.posts.length" class="page-empty">공개 댓글이 없어요.</p>
        <NuxtLink
          v-for="item in profile.posts"
          :key="item.id"
          class="page-thread-row"
          :to="`/forums/${encodeURIComponent(item.forumSlug)}/threads/${item.threadId}#post-${item.id}`"
          ><strong>{{ item.threadTitle }}</strong
          ><small>{{ item.excerpt }}</small></NuxtLink
        >
      </section>
    </main>
  </div>
</template>
