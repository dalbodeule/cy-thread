<script setup lang="ts">
const props = defineProps<{ src?: string | null; name?: string | null; large?: boolean }>();
const failed = ref(false);
watch(
  () => props.src,
  () => {
    failed.value = false;
  }
);
</script>
<template>
  <span
    class="user-avatar"
    :class="{ 'user-avatar-large': large }"
    :aria-label="`${name || '멤버'} 프로필 사진`"
  >
    <img
      v-if="src && !failed"
      :src="src"
      :alt="`${name || '멤버'} 프로필 사진`"
      referrerpolicy="no-referrer"
      @error="failed = true"
    />
    <span v-else aria-hidden="true">{{ (name || '멤버').slice(0, 1) }}</span>
  </span>
</template>
