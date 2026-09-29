<script setup lang="ts">
const ToastViewer = defineAsyncComponent(
  () => import('../../../../components/editor/ToastViewer.vue')
);
type Detail = {
  id: number;
  title: string;
  tags: string[];
  format: 'discussion' | 'question' | 'poll' | 'announcement';
  pollOptions: string[];
  pollCounts: number[];
  myPollOption: number | null;
  acceptedPostId: number | null;
  lastReadPostId: number | null;
  subscribed: boolean;
  hasMoreReplies: boolean;
  category: string;
  categorySlug: string;
  author: string | null;
  authorAvatarUrl: string | null;
  createdAt: string;
  isLocked: boolean;
  isPinned: boolean;
  isBookmarked: boolean;
  reactionCount: number;
  reacted: boolean;
  canModerate: boolean;
  isAuthor: boolean;
  commentAccess: 'guest' | 'members' | 'forum_members';
  canComment: boolean;
  replies: Array<{
    id: number;
    author: string | null;
    guestName: string | null;
    authorAvatarUrl: string | null;
    authorId: number;
    markdown: string;
    createdAt: string;
    updatedAt: string | null;
    parentPostId: number | null;
    depth: number;
    isDeleted: boolean;
    isAuthor: boolean;
    reactionCount: number;
    reacted: boolean;
  }>;
};
type Category = { id: number; name: string; slug: string };
const route = useRoute();
const { loggedIn } = useUserSession();
const {
  public: { turnstile },
} = useRuntimeConfig();
const token = ref('');
const turnstileKey = ref(0);
function resetTurnstile() {
  token.value = '';
  turnstileKey.value += 1;
}
const draft = ref('');
const guestName = ref('');
const draftKey = computed(
  () => `mori-draft:reply:${String(route.params.slug)}:${String(route.params.threadId)}`
);
const reportReason = ref('spam');
const reportDetails = ref('');
const reportOpen = ref(false);
const reportPostId = ref<number | null>(null);
const editingThread = ref(false);
const editingTitle = ref('');
const editingCategory = ref('');
const editingTags = ref('');
const editingFormat = ref<'discussion' | 'question' | 'poll' | 'announcement'>('discussion');
const editingPollOptions = ref('');
const pollCounts = ref<number[]>([]);
const myPollOption = ref<number | null>(null);
const subscribed = ref(false);
const loadingMoreReplies = ref(false);
const editingPostId = ref<number | null>(null);
const editingPostBody = ref('');
const replyTo = ref<{ id: number; author: string | null; depth: number } | null>(null);
const bookmarked = ref(false);
const reacted = ref(false);
const reactionCount = ref(0);
const categories = ref<Category[]>([]);
const { data: initialDetail } = await useFetch<Detail>(
  () =>
    `/api/forums/${encodeURIComponent(String(route.params.slug))}/threads/${Number(route.params.threadId)}`,
  { key: `thread-${String(route.params.slug)}-${String(route.params.threadId)}` }
);
if (!initialDetail.value) throw createError({ statusCode: 404, statusMessage: 'Thread not found' });
const detail = ref<Detail | null>(initialDetail.value);
bookmarked.value = Boolean(initialDetail.value?.isBookmarked);
reacted.value = Boolean(initialDetail.value?.reacted);
reactionCount.value = Number(initialDetail.value?.reactionCount || 0);
pollCounts.value = initialDetail.value?.pollCounts || [];
myPollOption.value = initialDetail.value?.myPollOption ?? null;
subscribed.value = Boolean(initialDetail.value?.subscribed);
const error = ref('');
const sending = ref(false);
const slug = computed(() => String(route.params.slug));
const threadId = computed(() => Number(route.params.threadId));
const forumPath = computed(() => `/forums/${encodeURIComponent(slug.value)}`);
const api = (path = '') =>
  `/api/forums/${encodeURIComponent(slug.value)}/threads/${threadId.value}${path}`;
const seoTitle = computed(() =>
  detail.value ? `${detail.value.title} | mori.space` : '게시글 | mori.space'
);
const seoDescription = computed(
  () =>
    (detail.value?.replies[0]?.markdown || '')
      .replace(/[#*_>`[\]()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 155) || 'mori.space 커뮤니티 게시글'
);
const canonical = computed(
  () =>
    `https://community.mori.space/forums/${encodeURIComponent(slug.value)}/threads/${threadId.value}`
);
useSeoMeta({
  title: seoTitle,
  description: seoDescription,
  ogTitle: seoTitle,
  ogDescription: seoDescription,
  ogType: 'article',
  ogUrl: canonical,
  twitterTitle: seoTitle,
  twitterDescription: seoDescription,
});
useHead(() => ({ link: [{ rel: 'canonical', href: canonical.value }] }));
async function load() {
  try {
    const [loaded, loadedCategories] = await Promise.all([
      $fetch<Detail>(api()),
      $fetch<Category[]>(`/api/forums/${encodeURIComponent(slug.value)}/categories`).catch(
        () => []
      ),
    ]);
    detail.value = loaded;
    bookmarked.value = Boolean(loaded.isBookmarked);
    reacted.value = Boolean(loaded.reacted);
    reactionCount.value = Number(loaded.reactionCount || 0);
    pollCounts.value = loaded.pollCounts || [];
    myPollOption.value = loaded.myPollOption ?? null;
    subscribed.value = Boolean(loaded.subscribed);
    categories.value = loadedCategories;
    error.value = '';
    if (route.hash) {
      await nextTick();
      document.querySelector(route.hash)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  } catch {
    error.value = '게시글을 찾을 수 없거나 불러오지 못했어요.';
  }
}
async function toggleReaction(target: 'thread' | 'post', targetId = threadId.value) {
  if (!loggedIn.value) return navigateTo('/login');
  const current =
    target === 'thread'
      ? reacted.value
      : detail.value?.replies.find((post) => post.id === targetId)?.reacted;
  const next = !current;
  if (target === 'thread') {
    reacted.value = next;
    reactionCount.value += next ? 1 : -1;
  }
  try {
    await $fetch<{ reacted: boolean; count: number }>(api('/reaction'), {
      method: 'POST',
      body: { target, targetId, reacted: next },
    });
    if (target === 'post') {
      const post = detail.value?.replies.find((item) => item.id === targetId);
      if (post) {
        post.reacted = next;
        post.reactionCount += next ? 1 : -1;
      }
    }
  } catch {
    if (target === 'thread') {
      reacted.value = !next;
      reactionCount.value += next ? -1 : 1;
    }
    error.value = '반응을 저장하지 못했어요.';
  }
}
async function toggleBookmark() {
  if (!loggedIn.value) return navigateTo('/login');
  bookmarked.value = !bookmarked.value;
  try {
    await $fetch(api('/bookmark'), { method: 'POST', body: { bookmarked: bookmarked.value } });
  } catch {
    bookmarked.value = !bookmarked.value;
    error.value = '저장 상태를 변경하지 못했어요.';
  }
}
async function reply() {
  if (!detail.value) return;
  if (detail.value.commentAccess !== 'guest' && !loggedIn.value) return navigateTo('/login');
  if (!draft.value.trim()) return;
  sending.value = true;
  try {
    await $fetch(api('/posts'), {
      method: 'POST',
      body: {
        body: draft.value,
        guestName: guestName.value,
        parentPostId: replyTo.value?.id,
        turnstileToken: token.value,
      },
    });
    draft.value = '';
    localStorage.removeItem(draftKey.value);
    resetTurnstile();
    replyTo.value = null;
    await load();
  } catch {
    error.value = '댓글을 등록하지 못했어요. 로그인과 입력 내용을 확인해 주세요.';
  } finally {
    sending.value = false;
  }
}
function beginThreadEdit() {
  if (!detail.value) return;
  editingTitle.value = detail.value.title;
  editingCategory.value = detail.value.categorySlug;
  editingTags.value = detail.value.tags.join(', ');
  editingFormat.value = detail.value.format;
  editingPollOptions.value = detail.value.pollOptions.join('\n');
  editingThread.value = true;
}
async function saveThread() {
  if (!detail.value) return;
  try {
    await $fetch(api(), {
      method: 'PATCH',
      body: {
        title: editingTitle.value,
        categorySlug: editingCategory.value,
        tags: editingTags.value,
        format: editingFormat.value,
        pollOptions: editingPollOptions.value,
      },
    });
    editingThread.value = false;
    await load();
  } catch {
    error.value = '게시글을 수정하지 못했어요.';
  }
}
async function votePoll(index: number) {
  if (!loggedIn.value) return navigateTo('/login');
  try {
    const result = await $fetch<{ optionIndex: number; counts: number[] }>(api('/poll'), {
      method: 'POST',
      body: { optionIndex: index },
    });
    pollCounts.value = result.counts;
    myPollOption.value = result.optionIndex;
  } catch {
    error.value = '투표를 저장하지 못했어요.';
  }
}
async function acceptAnswer(postId: number) {
  if (!detail.value) return;
  const next = detail.value.acceptedPostId === postId ? null : postId;
  try {
    await $fetch(api(), { method: 'PATCH', body: { acceptedPostId: next } });
    detail.value.acceptedPostId = next;
  } catch {
    error.value = '채택 답변을 저장하지 못했어요.';
  }
}
async function copyPostLink(postId: number) {
  const url = `${window.location.origin}${route.path}#post-${postId}`;
  try {
    await navigator.clipboard.writeText(url);
    error.value = '댓글 링크를 복사했어요.';
  } catch {
    error.value = '댓글 링크를 복사하지 못했어요.';
  }
}
async function toggleSubscription() {
  if (!loggedIn.value) return navigateTo('/login');
  const next = !subscribed.value;
  try {
    await $fetch(api('/subscribe'), { method: 'POST', body: { subscribed: next } });
    subscribed.value = next;
  } catch {
    error.value = '글 구독 상태를 변경하지 못했어요.';
  }
}
async function loadMoreReplies() {
  if (!detail.value || loadingMoreReplies.value || !detail.value.hasMoreReplies) return;
  loadingMoreReplies.value = true;
  try {
    const loaded = await $fetch<Detail>(api(), {
      params: { limit: 100, offset: detail.value.replies.length },
    });
    detail.value.replies.push(...loaded.replies);
    detail.value.hasMoreReplies = loaded.hasMoreReplies;
  } catch {
    error.value = '댓글을 더 불러오지 못했어요.';
  } finally {
    loadingMoreReplies.value = false;
  }
}
function beginPostEdit(post: Detail['replies'][number]) {
  editingPostId.value = post.id;
  editingPostBody.value = post.markdown;
}
async function savePost(postId: number) {
  try {
    await $fetch(api(`/posts/${postId}`), {
      method: 'PATCH',
      body: { body: editingPostBody.value },
    });
    editingPostId.value = null;
    await load();
  } catch {
    error.value = '댓글을 수정하지 못했어요.';
  }
}
async function deletePost(postId: number) {
  if (!window.confirm('이 댓글을 삭제할까요? 답글은 기록을 위해 남겨 둡니다.')) return;
  try {
    await $fetch(api(`/posts/${postId}`), { method: 'DELETE' });
    await load();
  } catch {
    error.value = '댓글을 삭제하지 못했어요.';
  }
}
async function reportPost(postId: number) {
  if (!loggedIn.value) return navigateTo('/login');
  try {
    await $fetch(api(`/posts/${postId}/report`), {
      method: 'POST',
      body: {
        reason: reportReason.value,
        details: reportDetails.value,
        turnstileToken: token.value,
      },
    });
    reportPostId.value = null;
    reportDetails.value = '';
    resetTurnstile();
    error.value = '댓글 신고를 운영진에게 전달했어요.';
  } catch {
    error.value = '댓글 신고를 접수하지 못했어요.';
  }
}
async function report() {
  if (!loggedIn.value) return navigateTo('/login');
  try {
    await $fetch(api('/report'), {
      method: 'POST',
      body: {
        reason: reportReason.value,
        details: reportDetails.value,
        turnstileToken: token.value,
      },
    });
    reportOpen.value = false;
    reportDetails.value = '';
    resetTurnstile();
    error.value = '신고를 운영진에게 전달했어요.';
  } catch {
    error.value = '신고를 접수하지 못했어요.';
  }
}
async function moderate(action: 'lock' | 'pin') {
  if (!detail.value?.canModerate) return;
  const key = action === 'lock' ? 'isLocked' : 'isPinned';
  try {
    const updated = await $fetch<{ isLocked: boolean; isPinned: boolean }>(
      `/api/forums/${encodeURIComponent(slug.value)}/moderation/threads/${threadId.value}`,
      {
        method: 'PATCH',
        body: { [key]: !detail.value[key] },
      }
    );
    detail.value.isLocked = updated.isLocked;
    detail.value.isPinned = updated.isPinned;
  } catch {
    error.value = '운영 설정을 저장하지 못했어요.';
  }
}
async function removeThread() {
  if (
    !(detail.value?.canModerate || detail.value?.isAuthor) ||
    !window.confirm('이 게시글과 댓글을 숨길까요? 운영 기록은 유지됩니다.')
  )
    return;
  try {
    await $fetch(api(), { method: 'DELETE' });
    await navigateTo(`${forumPath.value}/threads`);
  } catch {
    error.value = '게시글을 숨기지 못했어요.';
  }
}
onMounted(load);
onMounted(async () => {
  if (!loggedIn.value || !detail.value?.replies.length) return;
  const last = detail.value.replies[detail.value.replies.length - 1];
  await $fetch(api('/read'), { method: 'POST', body: { postId: last?.id } }).catch(() => undefined);
});
onMounted(() => {
  try {
    draft.value = localStorage.getItem(draftKey.value) || '';
  } catch {
    /* Ignore unavailable storage. */
  }
});
watch(draft, (value) => {
  if (!import.meta.client) return;
  if (value) localStorage.setItem(draftKey.value, value);
  else localStorage.removeItem(draftKey.value);
});
</script>

<template>
  <div class="page-shell forum-page" :data-forum-slug="slug">
    <ForumTopbar :slug="slug" />
    <main class="page-content">
      <div class="page-breadcrumb">
        <NuxtLink :to="`${forumPath}/threads`">이야기 목록</NuxtLink><span> / 게시글</span>
      </div>
      <p v-if="error" class="page-alert" role="status">{{ error }}</p>
      <article v-if="detail" class="detail-page-card">
        <div class="page-row-meta">
          <span class="thread-category tag-green">{{ detail.category }}</span
          ><span v-for="tag in detail.tags" :key="tag" class="thread-tag">#{{ tag }}</span
          ><span v-if="detail.format === 'question'" class="page-pinned">질문</span
          ><span v-if="detail.format === 'poll'" class="page-pinned">투표</span
          ><span v-if="detail.format === 'announcement'" class="page-pinned">공지</span
          ><span v-if="detail.isPinned" class="page-pinned">고정</span
          ><time>{{ new Date(detail.createdAt).toLocaleString('ko-KR') }}</time>
        </div>
        <div class="detail-title-row">
          <h1>{{ detail.title }}</h1>
          <div class="detail-title-actions">
            <button class="secondary-button" type="button" @click="toggleBookmark">
              {{ bookmarked ? '★ 저장됨' : '☆ 저장' }}
            </button>
            <button class="secondary-button" type="button" @click="toggleReaction('thread')">
              {{ reacted ? '♥ 좋아요' : '♡ 좋아요' }} {{ reactionCount || '' }}
            </button>
            <button class="secondary-button" type="button" @click="toggleSubscription">
              {{ subscribed ? '✓ 글 구독 중' : '글 구독' }}
            </button>
            <button
              v-if="detail.canModerate || detail.isAuthor"
              class="secondary-button"
              type="button"
              @click="beginThreadEdit"
            >
              제목·카테고리 수정
            </button>
          </div>
        </div>
        <div v-if="editingThread" class="thread-edit-form">
          <label>제목<input v-model="editingTitle" maxlength="120" /></label>
          <label
            >카테고리<select v-model="editingCategory">
              <option v-for="category in categories" :key="category.id" :value="category.slug">
                {{ category.name }}
              </option>
            </select></label
          >
          <label
            >태그 <small>(쉼표로 구분, 최대 5개)</small
            ><input v-model="editingTags" maxlength="150"
          /></label>
          <label
            >게시글 형식<select v-model="editingFormat">
              <option value="discussion">일반 이야기</option>
              <option value="question">질문</option>
              <option value="poll">투표</option>
              <option value="announcement">공지</option>
            </select></label
          >
          <label v-if="editingFormat === 'poll'"
            >투표 항목(한 줄에 하나)<textarea
              v-model="editingPollOptions"
              rows="4"
              maxlength="1000"
            />
          </label>
          <div>
            <button type="button" class="primary-button" @click="saveThread">변경 저장</button
            ><button type="button" class="secondary-button" @click="editingThread = false">
              취소
            </button>
          </div>
        </div>
        <section v-if="detail.format === 'poll'" class="thread-poll">
          <h2>투표</h2>
          <button
            v-for="(option, index) in detail.pollOptions"
            :key="option"
            type="button"
            :class="{ selected: myPollOption === index }"
            @click="votePoll(index)"
          >
            <span>{{ option }}</span
            ><strong>{{ pollCounts[index] || 0 }}</strong>
          </button>
          <small>로그인 후 한 번 투표할 수 있어요.</small>
        </section>
        <div
          v-for="post in detail.replies"
          :id="`post-${post.id}`"
          :key="post.id"
          class="detail-page-post nested-post"
          :class="`post-depth-${post.depth}`"
        >
          <div class="detail-page-author">
            <UserAvatar :src="post.authorAvatarUrl" :name="post.author || post.guestName" /><span
              ><NuxtLink v-if="post.authorId" :to="`/users/${post.authorId}`"
                ><strong>{{ post.author || post.guestName || '비회원' }}</strong></NuxtLink
              ><strong v-else>{{ post.author || post.guestName || '비회원' }}</strong
              ><small
                >{{ new Date(post.createdAt).toLocaleString('ko-KR')
                }}<template v-if="post.updatedAt"> · 수정됨</template></small
              ></span
            >
          </div>
          <template v-if="post.isDeleted"><p class="deleted-post">삭제된 댓글입니다.</p></template>
          <template v-else-if="editingPostId === post.id">
            <textarea
              v-model="editingPostBody"
              rows="5"
              class="post-edit-input"
              :aria-label="`${post.author || '댓글'} 댓글 수정`"
            />
            <div class="post-action-row">
              <button type="button" class="primary-button" @click="savePost(post.id)">저장</button
              ><button type="button" class="secondary-button" @click="editingPostId = null">
                취소
              </button>
            </div></template
          >
          <template v-else
            ><ToastViewer :id="`post-page-${post.id}`" :model-value="post.markdown" />
            <div class="post-action-row">
              <button
                v-if="post.depth < 2 && !detail.isLocked"
                type="button"
                class="post-text-action"
                @click="replyTo = { id: post.id, author: post.author, depth: post.depth }"
              >
                답글</button
              ><button
                v-if="post.isAuthor || detail.canModerate"
                type="button"
                class="post-text-action"
                @click="beginPostEdit(post)"
              >
                수정</button
              ><button
                v-if="post.parentPostId !== null && (post.isAuthor || detail.canModerate)"
                type="button"
                class="post-text-action post-danger-action"
                @click="deletePost(post.id)"
              >
                삭제</button
              ><button
                class="post-text-action"
                type="button"
                @click="toggleReaction('post', post.id)"
              >
                {{ post.reacted ? '♥' : '♡' }} {{ post.reactionCount }}</button
              ><button
                v-if="detail.format === 'question' && (detail.isAuthor || detail.canModerate)"
                class="post-text-action"
                type="button"
                @click="acceptAnswer(post.id)"
              >
                {{ detail.acceptedPostId === post.id ? '✓ 채택됨' : '답변 채택' }}</button
              ><button class="post-text-action" type="button" @click="copyPostLink(post.id)">
                링크 복사</button
              ><button
                v-if="!post.isAuthor"
                class="post-text-action"
                @click="reportPostId = post.id"
              >
                신고
              </button>
            </div></template
          >
          <form
            v-if="reportPostId === post.id"
            class="report-page-form post-report-form"
            @submit.prevent="reportPost(post.id)"
          >
            <label :for="`post-report-reason-${post.id}`">신고 사유</label
            ><select :id="`post-report-reason-${post.id}`" v-model="reportReason">
              <option value="spam">스팸 또는 광고</option>
              <option value="harassment">괴롭힘 또는 혐오</option>
              <option value="unsafe">부적절한 콘텐츠</option>
              <option value="other">기타</option></select
            ><textarea
              v-model="reportDetails"
              rows="2"
              placeholder="추가 설명 (선택)"
              :aria-label="`${post.author || '댓글'} 신고 추가 설명`"
            /><NuxtTurnstile
              v-if="turnstile.siteKey && reportPostId === post.id"
              :key="turnstileKey"
              v-model="token"
              :options="{ sitekey: turnstile.siteKey }"
            />
            <div>
              <button class="secondary-button" :disabled="!!turnstile.siteKey && !token">
                신고 접수</button
              ><button type="button" class="post-text-action" @click="reportPostId = null">
                취소
              </button>
            </div>
          </form>
        </div>
        <button
          v-if="detail.hasMoreReplies"
          type="button"
          class="load-more"
          :disabled="loadingMoreReplies"
          @click="loadMoreReplies"
        >
          {{ loadingMoreReplies ? '댓글을 불러오는 중…' : '댓글 더 보기 ↓' }}
        </button>
        <div v-if="detail.canModerate || detail.isAuthor" class="moderator-tools">
          <strong>운영 도구</strong
          ><button type="button" @click="moderate('pin')">
            {{ detail.isPinned ? '고정 해제' : '게시글 고정' }}</button
          ><button type="button" @click="moderate('lock')">
            {{ detail.isLocked ? '댓글 잠금 해제' : '댓글 잠금' }}</button
          ><button type="button" class="danger-button" @click="removeThread">게시글 숨기기</button>
        </div>
        <div v-if="!detail.isLocked && detail.canComment" class="detail-page-reply">
          <h2>
            {{ replyTo ? `${replyTo.author || '비회원'}님에게 답글` : '댓글 남기기'
            }}<button v-if="replyTo" type="button" class="post-text-action" @click="replyTo = null">
              취소
            </button>
          </h2>
          <label v-if="detail.commentAccess === 'guest' && !loggedIn" class="guest-name-field"
            >이름(선택)<input v-model="guestName" maxlength="40" placeholder="비회원" /></label
          ><textarea
            v-model="draft"
            rows="5"
            placeholder="대화에 참여해 보세요."
            aria-label="댓글 내용"
          /><NuxtTurnstile
            v-if="turnstile.siteKey && reportPostId === null && !reportOpen"
            :key="turnstileKey"
            v-model="token"
            :options="{ sitekey: turnstile.siteKey }"
          /><button
            type="button"
            class="primary-button"
            :disabled="sending || !draft.trim() || (!!turnstile.siteKey && !token)"
            @click="reply"
          >
            {{ sending ? '등록 중…' : '댓글 등록' }}
          </button>
        </div>
        <p v-else-if="!detail.isLocked" class="page-empty">
          {{
            detail.commentAccess === 'forum_members'
              ? 'Forum 가입 승인 후 댓글을 작성할 수 있어요.'
              : '로그인 후 댓글을 작성할 수 있어요.'
          }}
          <NuxtLink v-if="!loggedIn" class="back-link" to="/login">로그인</NuxtLink>
        </p>
        <div v-if="!detail.isAuthor" class="report-page-inline">
          <button type="button" class="report-link" @click="reportOpen = !reportOpen">
            이 게시글 신고하기
          </button>
          <form v-if="reportOpen" class="report-page-form" @submit.prevent="report">
            <label for="report-reason">신고 사유</label
            ><select id="report-reason" v-model="reportReason">
              <option value="spam">스팸 또는 광고</option>
              <option value="harassment">괴롭힘 또는 혐오</option>
              <option value="unsafe">부적절한 콘텐츠</option>
              <option value="other">기타</option></select
            ><textarea
              v-model="reportDetails"
              rows="3"
              placeholder="추가 설명 (선택)"
              aria-label="게시글 신고 추가 설명"
            /><NuxtTurnstile
              v-if="turnstile.siteKey && reportPostId === null && reportOpen"
              :key="turnstileKey"
              v-model="token"
              :options="{ sitekey: turnstile.siteKey }"
            /><button class="secondary-button" :disabled="!!turnstile.siteKey && !token">
              신고 접수
            </button>
          </form>
        </div>
      </article>
      <NuxtLink class="back-link" :to="`${forumPath}/threads`">← 이야기 목록으로</NuxtLink>
    </main>
  </div>
</template>
