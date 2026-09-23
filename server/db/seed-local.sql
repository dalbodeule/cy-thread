-- Local-only preview data. Do not apply this file to a production database.
INSERT OR IGNORE INTO users (id, email, name, is_global_admin)
VALUES (1, 'preview@cy-thread.local', '민지', 0);

INSERT OR IGNORE INTO forums (id, slug, name, owner_user_id, visibility, settings_json)
VALUES (1, 'cy-thread', 'CY Thread', 1, 'public', '{"description":"함께 나누는 개발과 일상"}');

INSERT OR IGNORE INTO categories (id, forum_id, name, slug, sort_order) VALUES
  (1, 1, '개발 이야기', 'development', 1),
  (2, 1, '커리어', 'career', 2),
  (3, 1, '사이드 프로젝트', 'side-projects', 3),
  (4, 1, '자유 게시판', 'lounge', 4);

INSERT OR IGNORE INTO users (id, email, name, is_global_admin) VALUES
  (2, 'dohyun@cy-thread.local', '도현', 0),
  (3, 'seoyeon@cy-thread.local', '서연', 0),
  (4, 'junho@cy-thread.local', '준호', 0),
  (5, 'yujin@cy-thread.local', '유진', 0),
  (6, 'haneul@cy-thread.local', '하늘', 0);

INSERT OR IGNORE INTO threads (id, forum_id, category_id, title, author_user_id, created_at, last_post_at, is_pinned) VALUES
  (1, 1, 3, '요즘 만들고 있는 사이드 프로젝트, 어디까지 왔나요?', 1, unixepoch() * 1000 - 480000, unixepoch() * 1000 - 480000, 1),
  (2, 1, 2, '주니어 개발자 포트폴리오 리뷰해요 — 서로 피드백 나눠요', 2, unixepoch() * 1000 - 1380000, unixepoch() * 1000 - 1380000, 0),
  (3, 1, 1, 'Vue 3에서 상태 관리는 어디까지가 적당할까요?', 3, unixepoch() * 1000 - 3600000, unixepoch() * 1000 - 3600000, 0),
  (4, 1, 4, '오늘의 작은 성취를 기록하는 스레드 🌱', 4, unixepoch() * 1000 - 7200000, unixepoch() * 1000 - 7200000, 0),
  (5, 1, 1, '첫 오픈소스 PR을 머지했어요!', 5, unixepoch() * 1000 - 10800000, unixepoch() * 1000 - 10800000, 0),
  (6, 1, 2, '혼자 일할 때 루틴, 다들 어떻게 만드시나요?', 6, unixepoch() * 1000 - 18000000, unixepoch() * 1000 - 18000000, 0);

INSERT OR IGNORE INTO posts (id, thread_id, author_user_id, markdown, html_sanitized, created_at, is_deleted) VALUES
  (1, 1, 1, '작게라도 매주 업데이트하는 분들 이야기 듣고 싶어요. 저는 이번 주에 드디어 로그인과 온보딩 흐름을 붙였습니다.', '<p>작게라도 매주 업데이트하는 분들 이야기 듣고 싶어요. 저는 이번 주에 드디어 로그인과 온보딩 흐름을 붙였습니다.</p>', unixepoch() * 1000 - 480000, 0),
  (2, 2, 2, '처음 취업을 준비할 때 어떤 부분을 보여줘야 할지 막막하더라고요. 편하게 링크 남겨 주세요!', '<p>처음 취업을 준비할 때 어떤 부분을 보여줘야 할지 막막하더라고요. 편하게 링크 남겨 주세요!</p>', unixepoch() * 1000 - 1380000, 0),
  (3, 3, 3, '작은 팀에서 Pinia를 도입하면서 느낀 점과 컴포저블로 충분했던 케이스를 정리해봤어요.', '<p>작은 팀에서 Pinia를 도입하면서 느낀 점과 컴포저블로 충분했던 케이스를 정리해봤어요.</p>', unixepoch() * 1000 - 3600000, 0),
  (4, 4, 4, '대단하지 않아도 괜찮아요. 오늘 해낸 일을 한 줄씩 나눠 봐요.', '<p>대단하지 않아도 괜찮아요. 오늘 해낸 일을 한 줄씩 나눠 봐요.</p>', unixepoch() * 1000 - 7200000, 0),
  (5, 5, 5, '사소한 문서 수정이었지만 시작이 반이라는 말이 실감 나네요. 다음엔 코드에도 도전해볼게요.', '<p>사소한 문서 수정이었지만 시작이 반이라는 말이 실감 나네요. 다음엔 코드에도 도전해볼게요.</p>', unixepoch() * 1000 - 10800000, 0),
  (6, 6, 6, '집중이 잘되는 시간대와 쉬는 시간을 정해두니 조금 나아졌어요. 여러분의 방법도 궁금합니다.', '<p>집중이 잘되는 시간대와 쉬는 시간을 정해두니 조금 나아졌어요. 여러분의 방법도 궁금합니다.</p>', unixepoch() * 1000 - 18000000, 0);
