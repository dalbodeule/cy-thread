<script setup lang="ts">
type Category = {
  id: number;
  name: string;
  slug: string;
  threadCount: number;
  deletedThreadCount: number;
};
const route = useRoute();
const slug = computed(() => String(route.params.slug));
const forumPath = computed(() => `/forums/${encodeURIComponent(slug.value)}`);
const api = (path: string) => `/api/forums/${encodeURIComponent(slug.value)}/moderation${path}`;
const categories = ref<Category[]>([]);
const name = ref('');
const categorySlug = ref('');
const error = ref('');
const notice = ref('');
async function load() {
  try {
    categories.value = await $fetch<Category[]>(
      `/api/forums/${encodeURIComponent(slug.value)}/categories`
    );
    error.value = '';
  } catch {
    error.value = '카테고리를 불러오지 못했어요.';
  }
}
async function add() {
  try {
    await $fetch(api('/categories'), {
      method: 'POST',
      body: { name: name.value, slug: categorySlug.value },
    });
    name.value = '';
    categorySlug.value = '';
    notice.value = '카테고리를 추가했어요.';
    await load();
  } catch {
    error.value = '추가하지 못했어요. 이름과 주소를 확인해 주세요.';
  }
}
async function save(category: Category) {
  try {
    await $fetch(api(`/categories/${category.id}`), {
      method: 'PATCH',
      body: { name: category.name, slug: category.slug },
    });
    notice.value = '변경 사항을 저장했어요.';
    await load();
  } catch {
    error.value = '저장하지 못했어요. 이름과 주소가 중복되지 않는지 확인해 주세요.';
  }
}
async function remove(category: Category) {
  if (
    category.threadCount + category.deletedThreadCount ||
    !window.confirm(`“${category.name}” 카테고리를 삭제할까요?`)
  )
    return;
  try {
    await $fetch(api(`/categories/${category.id}`), { method: 'DELETE' });
    notice.value = '카테고리를 삭제했어요.';
    await load();
  } catch {
    error.value = '글이나 숨김 기록이 있는 카테고리는 삭제할 수 없어요.';
  }
}
watch(slug, () => void load());
onMounted(load);
</script>

<template>
  <div class="page-shell">
    <header class="page-topbar">
      <NuxtLink class="brand" to="/"
        ><span class="brand-mark">c<span>y</span></span
        ><span class="brand-word">thread<span class="brand-dot">.</span></span></NuxtLink
      >
      <nav class="page-nav">
        <NuxtLink :to="`${forumPath}/admin`">운영 관리</NuxtLink
        ><NuxtLink :to="`${forumPath}/reports`">신고함</NuxtLink>
      </nav>
      <NuxtLink class="text-button" to="/login">계정</NuxtLink>
    </header>
    <main class="page-content">
      <div class="page-breadcrumb">
        <NuxtLink :to="`${forumPath}/admin`">운영 관리</NuxtLink><span> / 카테고리 관리</span>
      </div>
      <section class="page-heading">
        <div>
          <p class="section-kicker">DISCUSSION TOPICS</p>
          <h1>카테고리 관리</h1>
          <p>대화 주제를 만들고 이름과 주소를 관리합니다.</p>
        </div>
      </section>
      <p v-if="error" class="page-alert" role="alert">{{ error }}</p>
      <p v-if="notice" class="page-success" role="status">{{ notice }}</p>
      <form class="admin-panel appoint-form category-appoint" @submit.prevent="add">
        <label
          ><span>이름</span
          ><input
            v-model="name"
            required
            minlength="2"
            maxlength="50"
            placeholder="예: 질문과 답변" /></label
        ><label
          ><span>주소</span
          ><input
            v-model="categorySlug"
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            maxlength="50"
            placeholder="questions" /></label
        ><button class="primary-button">추가</button>
      </form>
      <section class="category-admin-list">
        <article v-for="category in categories" :key="category.id" class="category-admin-row">
          <label><span>카테고리 이름</span><input v-model="category.name" maxlength="50" /></label
          ><label><span>주소</span><input v-model="category.slug" maxlength="50" /></label
          ><small
            >{{ category.threadCount }}개 이야기<span v-if="category.deletedThreadCount">
              · 숨김 {{ category.deletedThreadCount }}개</span
            ></small
          >
          <div>
            <button class="secondary-button" @click="save(category)">저장</button
            ><button
              class="danger-button"
              :disabled="category.threadCount + category.deletedThreadCount > 0"
              @click="remove(category)"
            >
              삭제
            </button>
          </div>
        </article>
      </section>
      <NuxtLink class="back-link" :to="`${forumPath}/admin`">← 운영 관리</NuxtLink>
    </main>
  </div>
</template>
