<script setup lang="ts">
const props = defineProps<{ slug: string }>();
type ForumBrandData = {
  name: string;
  iconText: string;
  iconBackground: string;
  iconColor: string;
  cssCustom: string;
  allowDarkMode: boolean;
};
const { data } = await useFetch<ForumBrandData>(
  () => `/api/forums/${encodeURIComponent(props.slug)}`,
  {
    key: `forum-brand-${props.slug}`,
  }
);
const safeSlug = computed(() => (/^[a-z0-9-]+$/.test(props.slug) ? props.slug : ''));
const scopedCss = computed(() =>
  safeSlug.value && data.value?.cssCustom
    ? `.forum-page[data-forum-slug="${safeSlug.value}"] { ${data.value.cssCustom} }`
    : ''
);
useHead(() => ({ style: scopedCss.value ? [{ innerHTML: scopedCss.value }] : [] }));
</script>

<template>
  <NuxtLink class="brand forum-brand" :to="`/forums/${encodeURIComponent(slug)}/threads`">
    <span
      class="forum-brand-mark"
      :style="{
        backgroundColor: data?.iconBackground || '#31664d',
        color: data?.iconColor || '#ffffff',
      }"
      >{{ data?.iconText || 'F' }}</span
    >
    <span class="forum-brand-name">{{ data?.name || slug }}</span>
  </NuxtLink>
</template>
