<script setup lang="ts">
const { user, loggedIn, fetch: refreshSession } = useUserSession();
const { data: emailStatus } = await useFetch<{
  identityEmail: string | null;
  contactEmail: string | null;
  contactEmailVerified: boolean;
}>('/api/account/email-status', { immediate: loggedIn.value });
const name = ref(user.value?.name || '');
const saving = ref(false);
const notice = ref('');
const error = ref('');
const { data: bookmarks } = await useFetch<
  Array<{ id: number; title: string; forumSlug: string; forumName: string; category: string }>
>('/api/account/bookmarks', { immediate: loggedIn.value });
const { data: notifications, refresh: refreshNotifications } = await useFetch<{
  items: Array<{
    id: number;
    message: string;
    actorName: string | null;
    threadId: number | null;
    forumSlug: string | null;
    readAt: string | null;
  }>;
  unread: number;
}>('/api/account/notifications', { immediate: loggedIn.value });
async function markNotificationsRead() {
  await $fetch('/api/account/notifications', { method: 'PATCH', body: { all: true } });
  await refreshNotifications();
}
type AvatarSettings = {
  source: string;
  currentUrl: string | null;
  providerUrl: string | null;
  uploadedUrl: string | null;
  gravatarUrl: string | null;
};
const { data: avatarSettings, refresh: refreshAvatarSettings } = await useFetch<AvatarSettings>(
  '/api/account/avatar-settings',
  { immediate: loggedIn.value }
);
const selectedFile = ref<File | null>(null);
const localPreview = ref<string | null>(null);
const avatarBusy = ref(false);
function selectFile(event: Event) {
  if (localPreview.value) URL.revokeObjectURL(localPreview.value);
  const file = (event.target as HTMLInputElement).files?.[0] || null;
  selectedFile.value = file;
  localPreview.value = file ? URL.createObjectURL(file) : null;
}
onBeforeUnmount(() => {
  if (localPreview.value) URL.revokeObjectURL(localPreview.value);
});
async function chooseAvatar(source: 'provider' | 'upload' | 'gravatar') {
  avatarBusy.value = true;
  error.value = '';
  try {
    await $fetch('/api/account/avatar', { method: 'PATCH', body: { source } });
    await Promise.all([refreshSession(), refreshAvatarSettings()]);
    notice.value = '프로필 사진을 변경했어요.';
  } catch {
    error.value = '프로필 사진을 변경하지 못했어요.';
  } finally {
    avatarBusy.value = false;
  }
}
async function uploadAvatar() {
  if (!selectedFile.value) return;
  avatarBusy.value = true;
  error.value = '';
  try {
    const form = new FormData();
    form.append('file', selectedFile.value);
    await $fetch('/api/account/avatar', { method: 'POST', body: form });
    await Promise.all([refreshSession(), refreshAvatarSettings()]);
    notice.value = '새 프로필 사진을 적용했어요.';
    selectedFile.value = null;
    if (localPreview.value) URL.revokeObjectURL(localPreview.value);
    localPreview.value = null;
  } catch {
    error.value = '사진을 올리지 못했어요. 2 MB 이하의 JPG, PNG 또는 WebP 파일을 선택해 주세요.';
  } finally {
    avatarBusy.value = false;
  }
}
watch(user, (value) => {
  if (value && !name.value) name.value = value.name || '';
});
async function save() {
  saving.value = true;
  error.value = '';
  try {
    await $fetch('/api/account/profile', { method: 'PATCH', body: { name: name.value } });
    await refreshSession();
    notice.value = '프로필을 저장했어요.';
  } catch {
    error.value = '이름을 저장하지 못했어요. 2~40자로 입력해 주세요.';
  } finally {
    saving.value = false;
  }
}
useSeoMeta({ title: '프로필 | mori.space', robots: 'noindex, nofollow' });
</script>
<template>
  <div class="page-shell">
    <SiteTopbar />
    <main class="page-content">
      <div class="page-breadcrumb"><NuxtLink to="/">홈</NuxtLink><span> / 프로필</span></div>
      <section class="page-heading">
        <div>
          <p class="section-kicker">ACCOUNT</p>
          <h1>프로필</h1>
          <p>커뮤니티에서 사용할 이름과 사진을 관리합니다.</p>
        </div>
      </section>
      <p v-if="!loggedIn" class="page-alert"><NuxtLink to="/login">로그인</NuxtLink>해 주세요.</p>
      <div v-else>
        <p v-if="error" class="page-alert" role="alert">{{ error }}</p>
        <p v-if="notice" class="page-success" role="status">{{ notice }}</p>
        <section class="admin-panel">
          <div class="page-heading">
            <div>
              <h2>알림</h2>
              <p>답글과 멘션을 확인하세요. 읽지 않은 알림 {{ notifications?.unread || 0 }}개</p>
            </div>
            <button
              v-if="notifications?.unread"
              class="secondary-button"
              type="button"
              @click="markNotificationsRead"
            >
              모두 읽음
            </button>
          </div>
          <p v-if="!notifications?.items.length" class="page-empty">새 알림이 없어요.</p>
          <NuxtLink
            v-for="item in notifications?.items"
            :key="item.id"
            class="page-thread-row"
            :class="{ 'font-semibold': !item.readAt }"
            :to="
              item.threadId && item.forumSlug
                ? `/forums/${encodeURIComponent(item.forumSlug)}/threads/${item.threadId}`
                : '/account/profile'
            "
            @click="
              !item.readAt &&
              $fetch('/api/account/notifications', { method: 'PATCH', body: { id: item.id } })
            "
            >{{ item.message }} · {{ item.actorName || '멤버' }}</NuxtLink
          >
        </section>
        <section class="admin-panel">
          <div class="page-heading">
            <div>
              <h2>저장한 글</h2>
              <p>나중에 다시 읽을 게시글입니다.</p>
            </div>
          </div>
          <p v-if="!bookmarks?.length" class="page-empty">저장한 글이 없어요.</p>
          <NuxtLink
            v-for="item in bookmarks"
            :key="item.id"
            class="page-thread-row"
            :to="`/forums/${encodeURIComponent(item.forumSlug)}/threads/${item.id}`"
            ><strong>{{ item.title }}</strong
            ><small>{{ item.forumName }} · {{ item.category }}</small></NuxtLink
          >
        </section>
        <section class="admin-panel profile-photo-panel">
          <div class="profile-photo-heading">
            <UserAvatar :src="user?.avatarUrl" :name="user?.name" large />
            <div>
              <h2>프로필 사진</h2>
              <p>
                첫 로그인 서비스의 사진을 기본으로 사용합니다. 직접 올린 사진이나 Gravatar로 바꿀 수
                있어요.
              </p>
            </div>
          </div>
          <div class="avatar-source-options">
            <button
              type="button"
              :aria-pressed="avatarSettings?.source === 'provider'"
              :disabled="avatarBusy"
              @click="chooseAvatar('provider')"
            >
              <UserAvatar :src="avatarSettings?.providerUrl" :name="user?.name" /><span
                >첫 로그인 사진</span
              >
            </button>
            <button
              type="button"
              :aria-pressed="avatarSettings?.source === 'upload'"
              :disabled="avatarBusy || !avatarSettings?.uploadedUrl"
              @click="chooseAvatar('upload')"
            >
              <UserAvatar :src="avatarSettings?.uploadedUrl" :name="user?.name" /><span
                >업로드한 사진</span
              >
            </button>
            <button
              type="button"
              :aria-pressed="avatarSettings?.source === 'gravatar'"
              :disabled="avatarBusy || !avatarSettings?.gravatarUrl"
              @click="chooseAvatar('gravatar')"
            >
              <UserAvatar :src="avatarSettings?.gravatarUrl" :name="user?.name" /><span
                >Gravatar</span
              >
            </button>
          </div>
          <p v-if="!avatarSettings?.gravatarUrl" class="permission-note">
            Gravatar를 사용하려면 확인된 이메일 주소가 필요합니다.
          </p>
          <div class="avatar-upload-row">
            <label
              >사진 업로드<input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                @change="selectFile" /></label
            ><UserAvatar v-if="localPreview" :src="localPreview" :name="user?.name" /><button
              type="button"
              class="secondary-button"
              :disabled="avatarBusy || !selectedFile"
              @click="uploadAvatar"
            >
              {{ avatarBusy ? '적용 중…' : '사진 올리고 적용' }}
            </button>
          </div>
          <small>JPG, PNG, WebP · 최대 2 MB</small>
        </section>
        <form class="admin-panel mail-compose-form" @submit.prevent="save">
          <label
            ><span>닉네임</span><input v-model="name" required minlength="2" maxlength="40"
          /></label>
          <p>
            연락 이메일: {{ user?.email || '미등록' }}
            <span v-if="emailStatus?.contactEmail && !emailStatus.contactEmailVerified"
              >(확인 대기)</span
            >
          </p>
          <NuxtLink
            v-if="emailStatus?.contactEmail && !emailStatus.contactEmailVerified"
            class="back-link"
            to="/account/email"
            >확인 메일 다시 보내기 →</NuxtLink
          >
          <button class="primary-button" :disabled="saving">
            {{ saving ? '저장 중…' : '저장' }}
          </button>
        </form>
      </div>
    </main>
  </div>
</template>
