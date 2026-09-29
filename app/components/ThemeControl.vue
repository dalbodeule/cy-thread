<script setup lang="ts">
const { mode, forumAllowsDark, setMode } = useTheme();
</script>
<template>
  <label v-if="forumAllowsDark" class="theme-control">
    <span class="sr-only">화면 테마</span>
    <select
      :value="mode"
      aria-label="화면 테마"
      @change="setMode(($event.target as HTMLSelectElement).value as 'light' | 'dark' | 'system')"
    >
      <option value="light">화이트</option>
      <option value="dark">다크</option>
      <option value="system">시스템</option>
    </select>
  </label>
</template>
