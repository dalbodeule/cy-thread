<script setup lang="ts">
import Editor from "@toast-ui/editor";
import "@toast-ui/editor/toastui-editor.css";
import "@toast-ui/editor/dist/i18n/ko-kr";

import colorSyntax from "@toast-ui/editor-plugin-color-syntax";
import "tui-color-picker/dist/tui-color-picker.css";
import "@toast-ui/editor-plugin-color-syntax/dist/toastui-editor-plugin-color-syntax.css";

import codeSyntaxHighlight from '@toast-ui/editor-plugin-code-syntax-highlight';
import 'prismjs/themes/prism.css';
import '@toast-ui/editor-plugin-code-syntax-highlight/dist/toastui-editor-plugin-code-syntax-highlight.css'

import tableMergedCell from '@toast-ui/editor-plugin-table-merged-cell';
import '@toast-ui/editor-plugin-table-merged-cell/dist/toastui-editor-plugin-table-merged-cell.css'

const props = defineProps<{
  modelValue: string;
  id: string;
}>();

const viewer = ref(`${props.id}`);

onMounted(() => {
  const v = Editor.factory({
    el: viewer.value,
    viewer: true,
    initialValue: props.modelValue,
    plugins: [colorSyntax, codeSyntaxHighlight, tableMergedCell],
  });

  watch(
      () => props.modelValue,
      (newValue) => {
        v.setMarkdown(newValue);
      },
  );
});
</script>

<template>
  <div ref="viewer" class="editor custom" />
</template>
