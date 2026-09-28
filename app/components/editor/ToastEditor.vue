<script setup lang="ts">
import Editor from '@toast-ui/editor';
import '@toast-ui/editor/toastui-editor.css';
import '@toast-ui/editor/dist/i18n/ko-kr';
import codeSyntaxHighlight from '@toast-ui/editor-plugin-code-syntax-highlight';
import 'prismjs/themes/prism.css';
import '@toast-ui/editor-plugin-code-syntax-highlight/dist/toastui-editor-plugin-code-syntax-highlight.css';
import tableMergedCell from '@toast-ui/editor-plugin-table-merged-cell';
import '@toast-ui/editor-plugin-table-merged-cell/dist/toastui-editor-plugin-table-merged-cell.css';

const props = defineProps<{
  id: string;
  content: string;
  forumSlug: string;
  turnstileToken?: string;
}>();
const emit = defineEmits<{ 'update:content': [value: string]; 'turnstile-used': [] }>();
const editorElement = ref<HTMLDivElement | null>(null);
const editorInstance = shallowRef<Editor | null>(null);
const {
  public: { turnstile },
} = useRuntimeConfig();

watch(
  () => props.content,
  (value) => {
    if (editorInstance.value?.getMarkdown() !== value) editorInstance.value?.setMarkdown(value);
  }
);

onMounted(() => {
  if (!editorElement.value) return;
  editorInstance.value = new Editor({
    el: editorElement.value,
    height: '360px',
    initialEditType: 'wysiwyg',
    initialValue: props.content,
    previewStyle: 'tab',
    language: 'ko-KR',
    plugins: [codeSyntaxHighlight, tableMergedCell],
    events: {
      change: () => {
        const markdown = editorInstance.value?.getMarkdown();
        if (markdown !== undefined) emit('update:content', markdown);
      },
    },
    hooks: {
      addImageBlobHook: async (blob: Blob, callback: (url: string, text: string) => void) => {
        if (turnstile.siteKey && !props.turnstileToken) {
          window.alert('이미지를 첨부하려면 먼저 아래 보안 확인을 완료해 주세요.');
          return false;
        }
        const extensions: Record<string, string> = {
          'image/jpeg': 'jpg',
          'image/png': 'png',
          'image/gif': 'gif',
          'image/webp': 'webp',
        };
        const extension = extensions[blob.type];
        if (!extension) {
          window.alert('JPG, PNG, GIF, WebP 이미지만 첨부할 수 있어요.');
          return false;
        }

        try {
          const form = new FormData();
          form.append('file', new File([blob], `image.${extension}`, { type: blob.type }));
          form.append('turnstileToken', props.turnstileToken || '');
          const response = await fetch(
            `/api/forums/${encodeURIComponent(props.forumSlug)}/attachments`,
            {
              method: 'POST',
              body: form,
            }
          );
          if (!response.ok) throw new Error('Upload failed');
          const result = (await response.json()) as { url: string };
          callback(result.url, `image.${extension}`);
          return true;
        } catch {
          window.alert('이미지를 업로드하지 못했어요. 로그인과 저장소 설정을 확인해 주세요.');
          return false;
        } finally {
          if (turnstile.siteKey) emit('turnstile-used');
        }
      },
    },
  });
});

onBeforeUnmount(() => {
  editorInstance.value?.destroy();
  editorInstance.value = null;
});
</script>

<template>
  <div>
    <div :id="id" ref="editorElement" class="editor custom" />
  </div>
</template>

<style>
html[data-theme='dark'] .editor.custom .toastui-editor-defaultUI-toolbar {
  background: #f7f9fc !important;
}
html[data-theme='dark'] .editor.custom .toastui-editor-toolbar-icons {
  background-color: transparent !important;
  filter: none !important;
}
html[data-theme='dark']
  .editor.custom
  :is(
    .toastui-editor-ww-container .ProseMirror,
    .toastui-editor-md-preview .toastui-editor-contents
  )
  :is(p, li, h1, h2, h3, h4, h5, h6, blockquote) {
  color: #e6f0e8 !important;
}
.editor.custom p,
.editor.custom span,
.editor.custom strike,
.editor.custom strong,
.editor.custom em,
.editor.custom u,
.editor.custom del,
.editor.custom a,
.editor.custom ul,
.editor.custom ol,
.editor.custom li,
.editor.custom blockquote {
  font-size: 14px;
}
.editor.custom h1 > span {
  font-size: 24px;
}
.editor.custom h2 > span {
  font-size: 22px;
}
.editor.custom h3 > span {
  font-size: 20px;
}
.editor.custom h4 > span {
  font-size: 18px;
}
.editor.custom h5 > span {
  font-size: 16px;
}
.editor.custom h6 > span {
  font-size: 14px;
}
</style>
