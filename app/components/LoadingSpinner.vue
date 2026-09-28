<script setup lang="ts">
withDefaults(defineProps<{ label?: string; compact?: boolean }>(), {
  label: '불러오는 중…',
  compact: false,
});
</script>

<template>
  <span class="loading-state" :class="{ 'loading-state-compact': compact }" role="status">
    <span class="loading-spinner" aria-hidden="true" />
    <span>{{ label }}</span>
  </span>
</template>

<style scoped>
.loading-state {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: inherit;
  font-size: 14px;
  font-weight: 600;
}
.loading-state-compact {
  font-size: 12px;
}
.loading-spinner {
  width: 18px;
  height: 18px;
  flex: none;
  border: 2px solid #d3e5d6;
  border-top-color: currentColor;
  border-radius: 50%;
  animation: loading-spin 0.7s linear infinite;
}
.loading-state-compact .loading-spinner {
  width: 15px;
  height: 15px;
}
@keyframes loading-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .loading-spinner {
    animation-duration: 1.8s;
  }
}
</style>
