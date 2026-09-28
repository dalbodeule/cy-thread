<script setup lang="ts">
import type { NuxtError } from '#app';

const props = defineProps<{ error: NuxtError }>();

const status = computed(() => Number(props.error.statusCode || props.error.status || 500));
const pages: Record<
  number,
  { label: string; title: string; description: string; action: string; path: string }
> = {
  400: {
    label: '잘못된 요청',
    title: '요청을 확인해 주세요',
    description: '주소나 입력 내용을 처리할 수 없어요. 이전 화면에서 다시 확인해 주세요.',
    action: '홈으로 돌아가기',
    path: '/',
  },
  401: {
    label: '로그인 필요',
    title: '로그인이 필요해요',
    description: '이 페이지를 보려면 먼저 로그인해 주세요.',
    action: '로그인하기',
    path: '/login',
  },
  404: {
    label: '페이지를 찾을 수 없음',
    title: '페이지를 찾을 수 없어요',
    description: '주소가 바뀌었거나 페이지가 삭제되었을 수 있어요.',
    action: '커뮤니티 둘러보기',
    path: '/explore',
  },
  500: {
    label: '서버 오류',
    title: '잠시 문제가 생겼어요',
    description: '페이지를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
    action: '홈으로 돌아가기',
    path: '/',
  },
};
const fallback = {
  label: '요청 오류',
  title: '페이지를 표시할 수 없어요',
  description: '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
  action: '홈으로 돌아가기',
  path: '/',
};
const page = computed(() => pages[status.value] || fallback);

useSeoMeta({ title: () => `${status.value} | mori.space`, robots: 'noindex, nofollow' });

function go(path: string) {
  clearError({ redirect: path });
}

function retry() {
  if (import.meta.client) window.location.reload();
}

function goBack() {
  if (import.meta.client && window.history.length > 1) window.history.back();
  else go('/');
}
</script>

<template>
  <div class="error-shell">
    <header class="error-topbar">
      <button type="button" class="error-brand" aria-label="mori.space 홈으로" @click="go('/')">
        <span class="error-brand-icon">m</span>
        <span>mori.space</span>
      </button>
    </header>

    <main class="error-main">
      <section class="error-card" aria-labelledby="error-title">
        <div class="error-visual" aria-hidden="true">
          <span class="error-orbit error-orbit-one" />
          <span class="error-orbit error-orbit-two" />
          <span class="error-code">{{ status }}</span>
        </div>
        <div class="error-copy">
          <p class="error-kicker">{{ page.label }}</p>
          <h1 id="error-title">{{ page.title }}</h1>
          <p class="error-description">{{ page.description }}</p>
          <div class="error-actions">
            <button type="button" class="error-primary" @click="go(page.path)">
              {{ page.action }} <span aria-hidden="true">→</span>
            </button>
            <button v-if="status === 500" type="button" class="error-secondary" @click="retry">
              다시 시도
            </button>
            <button
              v-else
              type="button"
              class="error-secondary"
              @click="status === 400 ? goBack() : go('/')"
            >
              {{ status === 400 ? '이전 페이지' : '홈으로' }}
            </button>
          </div>
        </div>
      </section>
    </main>

    <footer class="error-footer">
      <span>mori.space</span>
      <span>관심사가 모이는 커뮤니티</span>
    </footer>
  </div>
</template>

<style scoped>
.error-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f8faf7;
  color: #26392e;
  font-family: Pretendard, 'Noto Sans KR', system-ui, sans-serif;
}
.error-topbar {
  min-height: 72px;
  display: flex;
  align-items: center;
  padding: 0 clamp(20px, 4vw, 52px);
  border-bottom: 1px solid #e0e9e0;
  background: #fff;
}
.error-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  border: 0;
  background: none;
  color: #26392e;
  font-size: 20px;
  font-weight: 800;
  cursor: pointer;
}
.error-brand-icon {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 9px;
  background: #31664d;
  color: #fff;
  font-size: 21px;
  line-height: 1;
}
.error-main {
  width: 100%;
  flex: 1;
  display: grid;
  place-items: center;
  padding: 48px 20px 72px;
}
.error-card {
  width: min(100%, 840px);
  display: grid;
  grid-template-columns: minmax(240px, 0.85fr) minmax(0, 1fr);
  align-items: center;
  gap: clamp(32px, 5vw, 64px);
  padding: clamp(28px, 6vw, 64px);
  border: 1px solid #dce6dc;
  border-radius: 22px;
  background: #fff;
  box-shadow: 0 16px 50px #244c340b;
}
.error-visual {
  position: relative;
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 22px;
  background: radial-gradient(circle at 30% 25%, #eff8eb, #dcecdf 68%, #d2e8d8);
}
.error-orbit {
  position: absolute;
  width: 120%;
  height: 120%;
  border: 1px solid #b5d5bf;
  border-radius: 50%;
  transform: translate(26%, 27%);
}
.error-orbit-two {
  width: 90%;
  height: 90%;
  transform: translate(-34%, -35%);
}
.error-code {
  position: relative;
  color: #31664d;
  font-size: clamp(76px, 11vw, 116px);
  font-weight: 900;
  line-height: 1;
  letter-spacing: -0.09em;
  padding-right: 0.09em;
}
.error-kicker {
  margin: 0 0 12px;
  color: #57856a;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.12em;
}
.error-copy h1 {
  margin: 0;
  font-size: clamp(26px, 4vw, 36px);
  font-weight: 800;
  line-height: 1.3;
  letter-spacing: -0.04em;
}
.error-description {
  margin: 18px 0 0;
  color: #65786a;
  font-size: 15px;
  line-height: 1.8;
}
.error-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 32px;
}
.error-actions button {
  min-height: 44px;
  padding: 11px 18px;
  border-radius: 9px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}
.error-primary {
  border: 1px solid #31664d;
  background: #31664d;
  color: #fff;
}
.error-primary span {
  margin-left: 8px;
}
.error-primary:hover {
  background: #28553e;
}
.error-secondary {
  border: 1px solid #d6e2d7;
  background: #fff;
  color: #31664d;
}
.error-secondary:hover {
  background: #f1f6f0;
}
.error-actions button:focus-visible,
.error-brand:focus-visible {
  outline: 2px solid #31664d;
  outline-offset: 3px;
}
.error-footer {
  display: flex;
  gap: 10px;
  justify-content: space-between;
  padding: 24px clamp(20px, 4vw, 52px);
  border-top: 1px solid #e0e9e0;
  color: #758578;
  font-size: 12px;
}
.error-footer span:first-child {
  color: #31664d;
  font-weight: 800;
}
@media (max-width: 700px) {
  .error-card {
    max-width: 480px;
    grid-template-columns: 1fr;
  }
  .error-visual {
    width: 100%;
    max-height: 220px;
    aspect-ratio: 1.8;
  }
  .error-code {
    font-size: 88px;
  }
}
@media (prefers-color-scheme: dark) {
  .error-shell {
    background: #101714;
    color: #ecf5ee;
  }
  .error-topbar,
  .error-card {
    background: #1b2821;
    border-color: #304437;
  }
  .error-brand {
    color: #ecf5ee;
  }
  .error-visual {
    background: radial-gradient(circle at 30% 25%, #294b33, #203b2a 70%, #1c3325);
  }
  .error-orbit {
    border-color: #40664a;
  }
  .error-code,
  .error-kicker {
    color: #a8d8b4;
  }
  .error-description,
  .error-footer {
    color: #abc1af;
  }
  .error-secondary {
    background: #203227;
    border-color: #405746;
    color: #d9ebdc;
  }
  .error-footer {
    border-color: #304437;
  }
}
</style>
