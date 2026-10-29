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
          게시글·댓글을 삭제하거나 게시글을 잠그고, Forum 이용자를 일정 기간 또는 영구 제한할 수
          있습니다. 문의와 재검토 요청은
          <a href="mailto:webmaster@mori.space">webmaster@mori.space</a>로 보내 주세요.
        </p>
      </section>
      <section class="admin-panel">
        <h2>데이터 처리</h2>
        <p>
          서비스 제공을 위해 계정 이름·프로필 사진·이메일 주소, Google 또는 CHZZK 계정 식별자,
          게시글·댓글·첨부 이미지·신고 기록, 비공개 Forum 가입 신청, Forum 팔로우, 글
          북마크·구독·읽음 위치, 반응·투표, 인앱 알림, 메일 수신 설정, 사용자 차단·Forum 뮤트,
          정지·운영 조치 기록을 저장합니다. 로그인하지 않은 사용자가 댓글을 작성하면 입력한 표시
          이름(미입력 시 기본값)과 요청 헤더에서 확인 가능한 접속 IP 주소를 댓글과 함께 저장합니다.
          로그인 사용자의 댓글은 해당 계정에 연결되며 익명 이름과 IP 필드에는 값을 저장하지
          않습니다. 게시글과 댓글은 삭제 후에도 운영 및 데이터 일관성을 위해 데이터베이스에 삭제
          표시된 상태로 남을 수 있습니다. 게시글에서 제거한 이미지는 미사용 상태로 바뀐 뒤 24시간
          유예 후 정리되며, 삭제된 게시글·댓글의 이미지 파일은 삭제 후 30일이 지나면 정리됩니다.
          삭제 전에 만들어진 백업 사본은 백업 보존 기간 동안 더 남을 수 있습니다.
        </p>
        <p>
          공개 Forum의 게시글과 댓글은 공개될 수 있으며, 비공개 Forum의 콘텐츠는 승인 멤버, 해당
          Forum의 소유자·운영진, 전체 관리자에게 표시됩니다. 계정 페이지에서 계정 ID·이름·이메일·
          연락 이메일·가입 시각과 최근 게시글(Thread) 최대 1,000개, 작성한 본문·댓글 Post 최대
          5,000건, 신고 최대 1,000건을 JSON으로 내려받을 수 있습니다. 이 내보내기에는 프로필 사진과
          그 밖의 활동 기록이 포함되지 않습니다. 삭제 표시된 게시글·Post도 내보내기에 포함됩니다.
          현재 계정 삭제 기능은 제공하지 않으며, 계정 데이터 관련 문의는
          <a href="mailto:webmaster@mori.space">webmaster@mori.space</a>로 보내 주세요.
        </p>
      </section>
    </main>
  </div>
</template>
