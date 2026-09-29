<script setup lang="ts">
type Log = {
  id: number;
  targetType: string;
  targetId: number | null;
  action: string;
  reason: string | null;
  createdAt: string;
  actorName: string | null;
};
const route = useRoute();
const slug = computed(() => String(route.params.slug));
const forumPath = computed(() => `/forums/${encodeURIComponent(slug.value)}`);
const { data: logs, error } = await useFetch<Log[]>(
  () => `/api/forums/${encodeURIComponent(slug.value)}/moderation/logs`
);
useSeoMeta({ title: '운영 기록 | mori.space', robots: 'noindex, nofollow' });
</script>
<template>
  <div class="page-shell forum-page" :data-forum-slug="slug">
    <ForumTopbar :slug="slug" />
    <main class="page-content">
      <div class="page-breadcrumb">
        <NuxtLink :to="`${forumPath}/admin`">운영 관리</NuxtLink><span> / 운영 기록</span>
      </div>
      <div class="page-heading">
        <div>
          <p class="section-kicker">MODERATION LOG</p>
          <h1>운영 기록</h1>
          <p>운영진의 조치와 신고 처리 이력을 확인합니다.</p>
        </div>
      </div>
      <p v-if="error" class="page-alert" role="alert">운영 기록을 불러오지 못했어요.</p>
      <p v-else-if="!logs?.length" class="page-empty">아직 운영 기록이 없어요.</p>
      <div v-else class="admin-panel">
        <div v-for="log in logs" :key="log.id" class="page-thread-row">
          <div>
            <strong>{{ log.action }}</strong
            ><small
              >{{ log.actorName || '운영진' }} · {{ log.targetType
              }}{{ log.targetId ? ` #${log.targetId}` : '' }}</small
            >
          </div>
          <time>{{ new Date(log.createdAt).toLocaleString('ko-KR') }}</time>
        </div>
      </div>
      <NuxtLink class="back-link" :to="`${forumPath}/admin`">← 운영 관리</NuxtLink>
    </main>
  </div>
</template>
