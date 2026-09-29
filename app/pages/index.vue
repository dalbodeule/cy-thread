<script setup lang="ts">
type Forum = {
  id: number;
  slug: string;
  name: string;
  description: string;
  iconText: string;
  iconBackground: string;
  iconColor: string;
};
type FeaturedCategory = {
  id: number;
  name: string;
  slug: string;
  forumSlug: string;
  forumName: string;
  threadCount: number;
  activityCount: number;
};
type LatestThread = {
  id: number;
  title: string;
  excerpt: string | null;
  forumSlug: string;
  forumName: string;
  categoryName: string;
  authorName: string | null;
  lastPostAt: number;
};

const [forumFetch, featuredFetch, latestFetch, adminStatusFetch] = await Promise.all([
  useFetch<Forum[]>('/api/forums'),
  useFetch<FeaturedCategory[]>('/api/featured-categories'),
  useFetch<LatestThread[]>('/api/latest-threads'),
  useFetch<{ isGlobalAdmin: boolean }>('/api/admin/status'),
]);
const { data: forums } = forumFetch;
const { data: featured } = featuredFetch;
const { data: latest } = latestFetch;
const { data: adminStatus } = adminStatusFetch;
const hasFeaturedActivity = computed(() =>
  (featured.value || []).some((item) => item.activityCount > 0)
);
const query = ref('');
const filteredForums = computed(() =>
  (forums.value || []).filter((forum) =>
    `${forum.name} ${forum.description} ${forum.slug}`
      .toLocaleLowerCase()
      .includes(query.value.trim().toLocaleLowerCase())
  )
);
const excerpt = (value: string | null) =>
  (value || '')
    .replace(/[#*_>`[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 130);
const date = (value: number) => new Date(value).toLocaleDateString('ko-KR');
useSeoMeta({
  title: 'mori.space | 관심사가 모이는 커뮤니티',
  description: '다양한 Forum과 게시글 모음을 둘러보고 관심 있는 주제의 대화에 참여하세요.',
  ogTitle: 'mori.space | 관심사가 모이는 커뮤니티',
  ogDescription: '다양한 Forum과 게시글 모음을 둘러보고 관심 있는 주제의 대화에 참여하세요.',
});
useHead({ link: [{ rel: 'canonical', href: 'https://community.mori.space/' }] });
</script>

<template>
  <div class="page-shell home-page">
    <header class="page-topbar home-topbar">
      <NuxtLink class="home-brand" to="/"
        ><span class="home-brand-icon">m</span><span>mori.space</span></NuxtLink
      >
      <nav class="page-nav" aria-label="주 메뉴">
        <a href="#forums">Forum 둘러보기</a>
        <a href="#latest">최근 이야기</a>
        <NuxtLink to="/explore">카테고리 찾기</NuxtLink>
      </nav>
      <HeaderAccountActions :is-global-admin="adminStatus?.isGlobalAdmin" />
    </header>

    <main class="page-content home-content">
      <section class="home-hero">
        <div>
          <p class="section-kicker">COMMUNITIES TOGETHER</p>
          <h1>좋아하는 주제에서<br />대화를 시작하세요.</h1>
          <p>Forum을 찾고, 게시글 모음을 살펴보고, 여러 사람의 이야기에 참여할 수 있어요.</p>
          <div class="home-hero-actions">
            <a class="primary-button" href="#forums">Forum 둘러보기</a>
            <NuxtLink class="secondary-button" to="/forums/request">Forum 개설 신청</NuxtLink>
          </div>
        </div>
        <div class="home-hero-visual" aria-hidden="true">
          <span>✳</span><span>✦</span><span>◈</span>
        </div>
      </section>

      <section id="forums" class="home-section">
        <div class="home-section-heading">
          <div>
            <p class="section-kicker">FORUMS</p>
            <h2>Forum 둘러보기</h2>
            <p>관심 있는 커뮤니티를 선택해 이야기를 만나보세요.</p>
          </div>
          <NuxtLink class="link-button" to="/search">전체 글 검색 ↗</NuxtLink>
          <span>{{ (forums || []).length }}개 Forum</span>
        </div>
        <label class="home-search"
          ><span>⌕</span
          ><input
            v-model="query"
            type="search"
            placeholder="Forum 이름, 설명, 주소 검색"
            aria-label="Forum 검색"
        /></label>
        <div v-if="filteredForums.length" class="home-forum-grid">
          <NuxtLink
            v-for="forum in filteredForums"
            :key="forum.id"
            class="home-forum-card"
            :to="`/forums/${encodeURIComponent(forum.slug)}/threads`"
          >
            <span
              class="home-forum-icon"
              :style="{ backgroundColor: forum.iconBackground, color: forum.iconColor }"
              >{{ forum.iconText }}</span
            >
            <strong>{{ forum.name }}</strong>
            <small>/{{ forum.slug }}</small>
            <p>{{ forum.description || 'Forum에 방문해 이야기를 나눠보세요.' }}</p>
            <span class="home-forum-open">이야기 보기 ↗</span>
          </NuxtLink>
        </div>
        <p v-else class="page-empty">
          {{ query ? '검색 결과가 없어요.' : '공개된 Forum이 아직 없어요.' }}
        </p>
      </section>

      <section v-if="featured?.length" class="home-section">
        <div class="home-section-heading">
          <div>
            <p class="section-kicker">TOPICS</p>
            <h2>{{ hasFeaturedActivity ? '활발한 카테고리' : '카테고리 둘러보기' }}</h2>
            <p>
              {{
                hasFeaturedActivity
                  ? '여러 Forum에서 대화가 이어지는 주제입니다.'
                  : '관심 있는 주제에서 첫 대화를 시작해 보세요.'
              }}
            </p>
          </div>
          <NuxtLink to="/explore">전체 카테고리 →</NuxtLink>
        </div>
        <div class="home-topic-grid">
          <NuxtLink
            v-for="item in featured"
            :key="item.id"
            class="home-topic-card"
            :to="`/forums/${encodeURIComponent(item.forumSlug)}/threads?category=${encodeURIComponent(item.slug)}`"
          >
            <small>{{ item.forumName }}</small
            ><strong>{{ item.name }}</strong
            ><span>게시글 {{ item.threadCount }}개</span>
          </NuxtLink>
        </div>
      </section>

      <section id="latest" class="home-section">
        <div class="home-section-heading">
          <div>
            <p class="section-kicker">LATEST</p>
            <h2>최근 이야기</h2>
            <p>공개 Forum 전체에서 최근 올라온 게시글입니다.</p>
          </div>
        </div>
        <div v-if="latest?.length" class="home-latest-list">
          <NuxtLink
            v-for="thread in latest"
            :key="`${thread.forumSlug}-${thread.id}`"
            class="home-latest-row"
            :to="`/forums/${encodeURIComponent(thread.forumSlug)}/threads/${thread.id}`"
          >
            <span class="home-latest-context"
              >{{ thread.forumName }} · {{ thread.categoryName }}</span
            >
            <strong>{{ thread.title }}</strong>
            <p v-if="excerpt(thread.excerpt)">{{ excerpt(thread.excerpt) }}</p>
            <small>{{ thread.authorName || '멤버' }} · {{ date(thread.lastPostAt) }}</small>
          </NuxtLink>
        </div>
        <p v-else class="page-empty">
          아직 공개된 게시글이 없어요. Forum을 선택해 첫 글을 작성해 보세요.
        </p>
      </section>
    </main>
  </div>
</template>
