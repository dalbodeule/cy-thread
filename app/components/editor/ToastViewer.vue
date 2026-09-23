<script setup lang="ts">
import Viewer from '@toast-ui/editor/viewer';
import '@toast-ui/editor/toastui-editor-viewer.css';
import codeSyntaxHighlight from '@toast-ui/editor-plugin-code-syntax-highlight';
import 'prismjs/themes/prism.css';
import '@toast-ui/editor-plugin-code-syntax-highlight/dist/toastui-editor-plugin-code-syntax-highlight.css';
import tableMergedCell from '@toast-ui/editor-plugin-table-merged-cell';
import '@toast-ui/editor-plugin-table-merged-cell/dist/toastui-editor-plugin-table-merged-cell.css';

const props = defineProps<{ modelValue: string; id: string }>();
const viewerElement = ref<HTMLDivElement | null>(null);
const viewerInstance = shallowRef<Viewer | null>(null);

onMounted(() => {
  if (!viewerElement.value) return;
  viewerInstance.value = new Viewer({
    el: viewerElement.value,
    initialValue: props.modelValue,
    plugins: [codeSyntaxHighlight, tableMergedCell],
  });
});

watch(
  () => props.modelValue,
  (value) => viewerInstance.value?.setMarkdown(value)
);
onBeforeUnmount(() => {
  viewerInstance.value?.destroy();
  viewerInstance.value = null;
});
</script>

<template>
  <div :id="id" ref="viewerElement" class="editor custom viewer" />
</template>
