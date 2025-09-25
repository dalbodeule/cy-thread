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
  id: string;
  content: string;
}>();
const emit = defineEmits<{
  'update:content': [string];
}>()
const content = ref<string>(props.content);
const editor = ref(`${props.id}`);

watch(() => props.content, () => { emit("update:content", content.value); });

onMounted(() => {
  console.log(content.value)
  const e = new Editor({
    el: editor.value,
    height: "500px",
    initialEditType: "wysiwyg",
    initialValue: content.value,
    previewStyle: "tab",
    language: "ko-KR",
    hooks: {
      addImageBlobHook: async (
          blob: Blob,
          callback: (url: string, text: string) => void,
      ) => {
        try {
          /* const formData = new FormData();
          formData.append('file', blob);

          const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
          });

          if (!response.ok) {
            throw new Error('Upload failed');
          }

          const data: { url: string, filename: string } = await response.json();
          callback(data.url, data.filename);
          return true; */
          throw Error("Not Implemented.")
        } catch (error) {
          console.error('Image upload error:', error);
          alert('이미지 업로드에 실패했습니다.');
          return false;
        }
      },
    },
    plugins: [colorSyntax, codeSyntaxHighlight, tableMergedCell],
  });
});
</script>

<template>
  <div ref="editor" class="editor custom" />
</template>

<style lang="scss">
.editor.custom {
  p,
  span,
  strike,
  strong,
  em,
  u,
  del,
  a,
  ul,
  ol,
  li,
  blockquote {
    font-size: 16px;
  }

  h1 > span {
    font-size: 24px;
  }

  h2 > span {
    font-size: 22px;
  }

  h3 > span {
    font-size: 20px;
  }

  h4 > span {
    font-size: 18px;
  }

  h5 > span {
    font-size: 16px;
  }

  h6 > span {
    font-size: 14px;
  }
}
</style>
