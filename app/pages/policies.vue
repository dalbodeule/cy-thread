<script setup lang="ts">
useSeoMeta({
  title: '이용 정책 | mori.space',
  description: 'mori.space 이용·개인정보·신고 처리 안내',
});
</script>
<template>
  <div class="page-shell">
    <SiteTopbar />
    <main class="page-content policy-page">
      <div class="page-heading">
        <div>
          <p class="section-kicker">POLICIES</p>
          <h1>이용 정책</h1>
          <p>커뮤니티를 안전하게 이용하기 위한 기본 안내입니다.</p>
        </div>
      </div>
      <section class="admin-panel">
        <h2>커뮤니티 이용</h2>
        <p>
          타인을 존중하고 주제에 맞는 글을 작성해 주세요. 개인정보, 불법 행위, 괴롭힘, 스팸과 악성
          링크는 허용하지 않습니다. 각 Forum의 운영 규칙이 더 구체적인 기준을 정할 수 있습니다.
        </p>
      </section>
      <section class="admin-panel">
        <h2>신고와 검토</h2>
        <p>
          게시글과 댓글의 신고 버튼으로 사유를 남겨 주세요. 운영진은 신고 내용과 관련 기록을 검토해
          숨김·잠금·회원 제한 등의 조치를 할 수 있습니다. 문의와 재검토 요청은
          <a href="mailto:webmaster@mori.space">webmaster@mori.space</a>로 보내 주세요.
        </p>
      </section>
      <section class="admin-panel">
        <h2>데이터 처리</h2>
        <p>
          서비스 제공에 필요한 계정·게시글·댓글·신고 기록을 저장합니다. 공개 Forum의 게시글과 댓글은
          공개될 수 있으며, 비공개 Forum은 승인 멤버에게만 표시됩니다. 계정 관련 문의는 이메일로
          요청할 수 있습니다.
        </p>
      </section>
    </main>
  </div>
</template>
