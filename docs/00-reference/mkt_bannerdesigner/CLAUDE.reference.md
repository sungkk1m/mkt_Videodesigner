# CLAUDE.md — Today Banner Designer

이 파일은 **이 프로젝트 고유 규칙 + 작업 규율**만 담는다.
역할·커뮤니케이션(한/영)·자율성 경계·free-tier 기본값은 전역 `~/.claude/CLAUDE.md`가 이미 규정하므로 여기서 중복하지 않는다.

---

## 1. 작업 규율

- **Think before coding**: 가정은 명시한다. 모호하면 추측하지 말고 멈춰서 묻는다. 해석이 갈리면 임의로 하나 고르지 말고 제시한다.
- **Surgical changes**: 요청과 직접 연결된 라인만 수정. 인접 코드·주석·포맷을 임의로 "개선"하지 않는다. 안 깨진 건 리팩터링하지 않는다. 기존 스타일을 따른다. 내 변경이 만든 orphan만 정리한다.
- **Goal-driven**: 작업 전 성공 기준을 정하고, 끝나면 그 기준으로 검증한다 ("동작하게" 같은 약한 기준 금지).
- **Simplicity**: 요청 범위만. 추측성 추상화·설정·불필요한 방어코드 금지.

## 2. 절대 하지 말 것

- 내 허락 없이 파일 삭제 금지
- 모르면 추측하지 말고 반드시 묻기
- 작업 중간에 임의로 다른 방향으로 바꾸지 말 것

## 3. 정책 (모든 신규 템플릿에 적용 — v1.5+)

- **Single 모드 + Batch 모드 양쪽 지원 의무**: 모든 신규 템플릿은 단건 export(현재 화면 1장)와 배치 export(언어/사이즈/테마 조합 ZIP) 둘 다 제공해야 한다. 다국어 UA 운영 워크플로우 요구사항이며, 새 템플릿 PR은 양쪽 동작을 검증한다.
- **다국어 4종 기본**: ko / en / ja / zh-TW LANG_PACK 확장이 디폴트. 일부 템플릿이 별도 LANG_PACK(예: AS_LANG_PACK)을 둘 수 있으나 동일한 4언어 키를 쓴다.
- **언어별 폰트 자동 스왑**: Pretendard(ko/en) / Noto Sans JP(ja) / Noto Sans TC(zh-TW). `data-lang` 속성 + CSS 셀렉터 + Canvas의 `getFontFamilyForLang/asFontFamily`로 일관 적용.
- **사용자 결정 (2026-04-25, App Store Screenshot 기준)**:
  - 자동 번역 도입 안 함 → 4언어 직접 입력
  - 픽셀 퍼펙트 모방 → 외관은 실 App Store 페이지 충실 재현
  - 테마는 디자인 1개당 1테마 (다크 또는 라이트 단일) — Batch ZIP은 4언어 × 1테마 = 4장
  - 키아트는 4언어 공용 (1장 업로드)
  - 디바이스 프레임(베젤) 미포함 → App Store 페이지 자체만 9:16 채움
  - 로케일 전용 컬럼(한국 등급/이벤트 등)은 4컬럼으로 통일

## 4. 프로젝트 개요

- **본체**: `today-banner-designer.html` (단일 HTML 사내 툴, Apple "Today" 스타일 광고 배너 생성)
- **문서**: `README.md` / PDCA 문서는 `docs/01-plan ~ 04-report`
- **담당**: UA Manager 김성권 (ksk@superplanet.net)
- **repo**: https://github.com/sungkk1m/mkt_bannerdesigner (main)

## 5. 현재 상태  (갱신 시 덮어쓰기 — 누적 금지, 5~10줄 이내)

- 템플릿 10종: today-tap, app-badge, sd-showcase, keyvisual-review, pickup, steam-review, ask-me-anything, appstore-screenshot, google-play-screenshot, install-plz
- 최신 작업: App Store Screenshot v1.17 — 1:1(1080×1080) 레이아웃 개편(채택 시안 siaan3). 1:1은 **상태바(시간)·헤더(검색) 제거**하고 그 공간으로 키아트를 **16:9 무크롭(551px)** 표시. 구성: 상단여백(topPad 40) → 앱아이콘 슬롯+앱정보 → 스탯 4컬럼(평점·연령·차트·개발자) → 키아트. 디바이스 라벨·설명 본문·탭바는 계속 미출력. KO 고지문구는 1:1에서만 IAP 우측 인라인(`앱 내 구입 · 확률형 아이템 포함`). 9:16은 상태바/헤더 포함 완전 무변경(회귀 0, O-2 B). 공유 헬퍼 asIapLabelText/asSquareKeyartH/asSizeDim + AS_SQUARE.topPad. 배치 GP식 독립 fan-out. 브라우저 실측: DOM=Canvas 일치(1:1 크롬부재·키아트551·스탯4컬럼·IAP고지)·9:16 회귀 0·node --check 통과
- 4언어(ko/en/ja/zh-TW) × Single+Batch 전 템플릿 지원

## 6. 이력·히스토리 참조 규칙  ★

- 과거 PDCA 상세(Plan/Design/Analysis/Report)와 결정 근거는 `docs/01-plan ~ 04-report`, `.bkit/audit/`, git history에 보존돼 있다. **CLAUDE.md에 날짜별 누적 로그를 쌓지 말 것.**
- 과거 맥락이 필요하면 그때 해당 `docs/` 파일만 on-demand로 연다 (이 파일에 미리 복사해두지 않는다).
- "현재 상태"(섹션 5)는 갱신 시 **append가 아니라 덮어쓰기** — 오래된 항목은 지우고 최신만 유지한다.
- 버그·이슈는 재발 방지에 꼭 필요한 핵심만 짧게. 상세 재현/수정 내역은 해당 PDCA 문서·커밋에 둔다.
