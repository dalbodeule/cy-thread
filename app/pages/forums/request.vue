<script setup lang="ts">
type ForumRequest = {
  id: number;
  name: string;
  slug: string;
  description: string;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
  reapplyBlockedUntil: string | null;
};
type RequestPage = {
  items: ForumRequest[];
  page: number;
  total: number;
  totalPages: number;
  reapplyBlockedUntil: string | null;
};

const { loggedIn } = useUserSession();
const {
  public: { turnstile },
} = useRuntimeConfig();
const name = ref('');
const slug = ref('');
const description = ref('');
const turnstileToken = ref('');
const turnstileKey = ref(0);
const pending = ref(false);
const error = ref('');
const notice = ref('');
const historyError = ref('');
const historyLoading = ref(false);
const requests = ref<ForumRequest[]>([]);
const historyPage = ref(1);
const historyTotal = ref(0);
const historyTotalPages = ref(1);
const reapplyBlockedUntil = ref<string | null>(null);
const availability = ref<'idle' | 'checking' | 'available' | 'taken' | 'error'>('idle');
const slugValid = computed(
  () => slug.value.length <= 50 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug.value)
);
const reapplyBlocked = computed(
  () =>
    Boolean(reapplyBlockedUntil.value) &&
    new Date(reapplyBlockedUntil.value!).getTime() > Date.now()
);
let availabilityTimer: ReturnType<typeof setTimeout> | undefined;
let availabilityRequest = 0;

watch(slug, (value) => {
  const normalized = value.toLowerCase().trim().replace(/\s+/g, '-');
  if (normalized !== value) {
    slug.value = normalized;
    return;
  }
  clearTimeout(availabilityTimer);
  const current = ++availabilityRequest;
  if (!slugValid.value) {
    availability.value = 'idle';
    return;
  }
  availability.value = 'checking';
  availabilityTimer = setTimeout(async () => {
    try {
      const result = await $fetch<{ available: boolean }>('/api/forums/slug-availability', {
        query: { slug: normalized },
      });
      if (current === availabilityRequest)
        availability.value = result.available ? 'available' : 'taken';
    } catch {
      if (current === availabilityRequest) availability.value = 'error';
    }
  }, 300);
});
onBeforeUnmount(() => clearTimeout(availabilityTimer));

async function load(page = historyPage.value) {
  if (!loggedIn.value) return;
  historyLoading.value = true;
  historyError.value = '';
  try {
    const result = await $fetch<RequestPage>('/api/my-forum-requests', { query: { page } });
    historyPage.value = result.page;
    historyTotal.value = result.total;
    historyTotalPages.value = result.totalPages;
    requests.value = result.items;
    reapplyBlockedUntil.value = result.reapplyBlockedUntil;
    if (!result.items.length && page > 1 && result.totalPages < page) await load(result.totalPages);
  } catch {
    historyError.value = '신청 내역을 불러오지 못했어요.';
  } finally {
    historyLoading.value = false;
  }
}
onMounted(() => void load());

async function submit() {
  if (pending.value || reapplyBlocked.value || !slugValid.value || availability.value === 'taken')
    return;
  pending.value = true;
  error.value = '';
  notice.value = '';
  try {
    const result = await $fetch<ForumRequest>('/api/forums', {
      method: 'POST',
      body: {
        name: name.value,
        slug: slug.value,
        description: description.value,
        turnstileToken: turnstileToken.value,
      },
    });
    notice.value = `${result.name} 개설 신청을 접수했어요. 전체 관리자 승인을 기다려 주세요.`;
    name.value = '';
    slug.value = '';
    description.value = '';
    historyPage.value = 1;
    await load(1);
  } catch (caught) {
    error.value =
      (caught as { data?: { statusMessage?: string } }).data?.statusMessage ||
      '개설 신청을 접수하지 못했어요.';
  } finally {
    turnstileToken.value = '';
    turnstileKey.value += 1;
    pending.value = false;
  }
}

function statusLabel(status: string) {
  return status === 'pending' ? '검토 중' : status === 'approved' ? '승인' : '반려';
}

useSeoMeta({ title: 'Forum 개설 신청 | mori.space', robots: 'noindex, nofollow' });
</script>

<template>
  <div class="page-shell">
    <SiteTopbar />
    <main class="page-content">
      <div class="page-breadcrumb">
        <NuxtLink to="/">홈</NuxtLink><span> / Forum 개설 신청</span>
      </div>
      <section class="page-heading">
        <div>
          <p class="section-kicker">NEW FORUM</p>
          <h1>Forum 개설 신청</h1>
          <p>새로운 주제의 커뮤니티를 제안해 주세요. 전체 관리자 검토 후 개설됩니다.</p>
        </div>
      </section>
      <p v-if="!loggedIn" class="page-alert">
        신청하려면 <NuxtLink to="/login">로그인</NuxtLink>해 주세요.
      </p>
      <template v-else>
        <p v-if="error" class="page-alert" role="alert">{{ error }}</p>
        <p v-if="notice" class="page-success" role="status">{{ notice }}</p>
        <p v-if="reapplyBlocked" class="page-alert forum-request-cooldown" role="status">
          새 Forum 신청은 {{ new Date(reapplyBlockedUntil!).toLocaleString('ko-KR') }}부터 할 수
          있어요.
        </p>
        <form class="admin-panel forum-request-form" @submit.prevent="submit">
          <label>
            <span>Forum 이름</span>
            <input
              v-model="name"
              required
              minlength="2"
              maxlength="60"
              placeholder="예: 사진 이야기"
            />
          </label>
          <label>
            <span>주소</span>
            <input
              v-model="slug"
              required
              maxlength="50"
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              placeholder="예: photo-talk"
              autocomplete="off"
              aria-describedby="forum-slug-help"
            />
            <small
              id="forum-slug-help"
              :class="{
                'field-available': availability === 'available',
                'field-unavailable': availability === 'taken',
              }"
            >
              <template v-if="availability === 'checking'">주소 중복 확인 중…</template>
              <template v-else-if="availability === 'available'">사용할 수 있는 주소예요.</template>
              <template v-else-if="availability === 'taken'"
                >이미 사용 중이거나 검토 중인 주소예요.</template
              >
              <template v-else-if="availability === 'error'"
                >중복 확인에 실패했어요. 신청할 때 다시 확인합니다.</template
              >
              <template v-else>영문 소문자, 숫자, 하이픈만 사용할 수 있어요.</template>
            </small>
          </label>
          <label>
            <span>상세 설명</span>
            <textarea
              v-model="description"
              required
              minlength="20"
              maxlength="2000"
              rows="5"
              placeholder="어떤 주제를 다루고, 누구와 어떤 이야기를 나누고 싶은지 적어 주세요."
            />
            <small
              >검토할 때 참고합니다. {{ description.length.toLocaleString('ko-KR') }} /
              2,000자</small
            >
          </label>
          <NuxtTurnstile
            v-if="turnstile.siteKey"
            :key="turnstileKey"
            v-model="turnstileToken"
            :options="{ sitekey: turnstile.siteKey }"
          />
          <button
            class="primary-button"
            :disabled="
              pending ||
              reapplyBlocked ||
              !slugValid ||
              availability === 'taken' ||
              availability === 'checking' ||
              (!!turnstile.siteKey && !turnstileToken)
            "
          >
            <LoadingSpinner v-if="pending" compact label="신청 중…" />
            <template v-else>개설 신청</template>
          </button>
        </form>

        <section class="admin-panel forum-request-history" aria-labelledby="request-history-title">
          <div class="forum-request-history-heading">
            <h2 id="request-history-title">내 신청 내역</h2>
            <span v-if="historyTotal">총 {{ historyTotal.toLocaleString('ko-KR') }}건</span>
          </div>
          <LoadingSpinner v-if="historyLoading" label="신청 내역을 불러오는 중…" />
          <p v-else-if="historyError" class="page-alert" role="alert">{{ historyError }}</p>
          <p v-else-if="!requests.length" class="page-empty">아직 신청한 Forum이 없어요.</p>
          <div v-else class="forum-request-list">
            <article v-for="item in requests" :key="item.id" class="forum-request-item">
              <div class="forum-request-item-head">
                <div>
                  <strong>{{ item.name }}</strong>
                  <small>/{{ item.slug }}</small>
                </div>
                <span class="forum-request-status" :class="`forum-request-status-${item.status}`">{{
                  statusLabel(item.status)
                }}</span>
              </div>
              <p v-if="item.description" class="forum-request-description">
                {{ item.description }}
              </p>
              <div class="forum-request-meta">
                <span>신청 {{ new Date(item.createdAt).toLocaleString('ko-KR') }}</span>
                <span v-if="item.reviewedAt"
                  >처리 {{ new Date(item.reviewedAt).toLocaleString('ko-KR') }}</span
                >
                <NuxtLink
                  v-if="item.status === 'approved'"
                  :to="`/forums/${encodeURIComponent(item.slug)}/threads`"
                  >Forum 방문 →</NuxtLink
                >
              </div>
              <small
                v-if="
                  item.reapplyBlockedUntil &&
                  new Date(item.reapplyBlockedUntil).getTime() > Date.now()
                "
                class="forum-request-block-note"
              >
                {{ new Date(item.reapplyBlockedUntil).toLocaleString('ko-KR') }}까지 새 신청 제한
              </small>
            </article>
          </div>
          <nav
            v-if="historyTotalPages > 1"
            class="forum-request-pagination"
            aria-label="신청 내역 페이지"
          >
            <button
              type="button"
              class="secondary-button"
              :disabled="historyLoading || historyPage <= 1"
              @click="load(historyPage - 1)"
            >
              이전
            </button>
            <span>{{ historyPage }} / {{ historyTotalPages }}</span>
            <button
              type="button"
              class="secondary-button"
              :disabled="historyLoading || historyPage >= historyTotalPages"
              @click="load(historyPage + 1)"
            >
              다음
            </button>
          </nav>
        </section>
      </template>
    </main>
  </div>
</template>
