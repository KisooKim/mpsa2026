# MPSA 2026 Program Viewer — 설계 문서

작성일: 2026-04-11

## 1. 목적

MPSA 2026 컨퍼런스(83rd Annual Midwest Political Science Association, 2026-04-23 ~ 2026-04-26)의 공식 프로그램은 allacademic 플랫폼에서 제공되는데, 세션이 길고 단조로운 목록 형태로만 보여서 관심 세션을 찾고 일정을 짜기 어렵다. 이 프로젝트는 공식 데이터를 한 번 추출해서 로컬 HTML+CSS+JavaScript 뷰어로 다시 구성한다. 목표는 네 가지다.

1. 날짜·저자·분과·주제·세션 타입으로 빠르게 필터링해서 관심 세션만 좁혀 본다.
2. 필터링된 결과를 시간대별로 정렬된 타임슬롯 뷰로 보여줘서 동시간대 세션(평행 세션)을 한눈에 비교한다.
3. 세션을 클릭하면 의장·토론자·논문·저자까지 상세 정보를 그 자리에서 펼쳐 본다.
4. 필터 조합을 "Saved Views"로 저장해서 여러 관심사(예: American Politics 트랙, 친구 패널, 민주주의 주제)를 프리셋처럼 전환한다.

최종 결과물은 정적 파일(`index.html`, CSS, JS, `program.json`) 한 세트. 로컬에서 파일을 열거나 `python -m http.server` 같은 간단한 정적 서버로 띄운다.

**언어**: 사이트 UI는 영어로 작성한다 (원본 데이터가 영어이고, 학술 용어 혼재 방지). 설계·개발 논의는 한국어.

## 2. 데이터 수집 (두 단계)

공식 allacademic 사이트는 두 가지 뷰를 제공한다:
- **Day 리스팅 페이지** — 하루 치 세션 목록, 각 세션은 제목·시간·분과·타입만. PHPSESSID 쿠키가 필요해서 브라우저에서 덤프해야 함.
- **세션 상세 페이지** — Chair, Discussant, 논문, 저자, 소속까지 전부 포함. **`online_program_direct_link` 엔드포인트를 통해 쿠키 없이 공개적으로 접근 가능.**

즉, 사용자가 해야 할 수동 단계는 **day 리스팅 덤프 4번**뿐이고, 상세 페이지는 스크립트가 자동으로 긁어온다.

### 2.1 Day 리스팅 덤프 (수동, 4회)
1. 브라우저에서 MPSA 프로그램 사이트에 로그인/진입
2. "Browse by Day"로 4/23 페이지를 열고 lazy-load가 있다면 끝까지 스크롤
3. DevTools Console에서: `copy(document.documentElement.outerHTML)`
4. `raw_html/day1-2026-04-23.html`에 저장
5. 4/24 → `day2-...`, 4/25 → `day3-...`, 4/26 → `day4-...` 반복

### 2.2 상세 페이지 일괄 수집 (자동)

`scripts/fetch_details.py`를 실행하면:
1. 4개 day 리스팅 HTML을 파싱해서 세션 ID 추출 (day1=298, day2=363, day3=351, day4=87, 총 1,099개)
2. 각 ID에 대해 다음 URL을 10-worker 병렬로 요청:
   ```
   http://convention2.allacademic.com/one/mpsa/mpsa26/index.php?program_focus=view_session&selected_session_id={id}&cmd=online_program_direct_link&sub_action=online_program
   ```
3. 응답을 `raw_html/details/session_{id}.html`로 저장
4. 전체 ~26 MB, 첫 실행은 5분 내, 이후는 캐싱되어 즉시 완료

`raw_html/` 전체는 `.gitignore`에 올려서 저장소에 올라가지 않게 한다 (저작권·PII 고려).

### 2.3 파서 입력

Task 3+의 파서는 **오직 `raw_html/details/session_*.html`만 읽는다.** 리스팅 페이지는 세션 ID 수집 용도로만 쓰이고 파서와 관련 없다. 상세 페이지 헤더가 날짜·시간·방·타입·분과를 전부 담고 있어서 리스팅을 교차참조할 필요가 없다.

## 3. 파서 (Python, 일회성)

`raw_html/details/session_*.html` 파일 1,099개를 읽고 단일 `program.json`으로 구조화한다.

**기술 선택**:
- Python 3 + `beautifulsoup4` + `lxml`
- 스크립트 한 개: `scripts/parse_mpsa.py`
- 실행: `python scripts/parse_mpsa.py --details raw_html/details/ --out data/program.json`

**추출 필드**:
- 세션 레벨: `id`, `date` (ISO), `start_time`, `end_time`, `time_slot` (예: "8:00 AM"), `room`, `title`, `session_type` (Paper Panel / Roundtable / Poster / 등), `division` (Section), `chair[]`, `co_chair[]`, `discussant[]`
- 논문 레벨 (세션에 중첩): `title`, `authors[]` (각 `{name, affiliation}`)
- 세션 파생 필드 `all_people[]` — 의장·공동의장·토론자·논문 저자의 이름을 하나로 합친 소문자 문자열 배열. 저자 필터 매칭용.

세션 `id`는 HTML에 noted된 official ID가 있으면 그걸 쓰고, 없으면 `{date}-{start_time}-{room}-hash` 같은 안정적 해시로 생성.

파서는 "잘 안 맞으면 로그 찍고 그 세션만 건너뛰기" 원칙. 한 개 세션이 이상해도 전체 변환이 실패하지 않게.

**출력 JSON 구조** (단순화):
```json
{
  "meta": {
    "conference": "MPSA 2026",
    "generated_at": "2026-04-11T...",
    "days": ["2026-04-23", "2026-04-24", "2026-04-25", "2026-04-26"]
  },
  "divisions": ["American Politics", "Comparative Politics", "..."],
  "session_types": ["Paper Panel", "Roundtable", "..."],
  "sessions": [
    {
      "id": "...",
      "date": "2026-04-23",
      "start_time": "08:00",
      "end_time": "09:30",
      "time_slot": "8:00 AM",
      "room": "Room 101",
      "title": "...",
      "session_type": "Paper Panel",
      "division": "Comparative Politics",
      "chair": [{"name": "...", "affiliation": "..."}],
      "co_chair": [],
      "discussant": [{"name": "...", "affiliation": "..."}],
      "papers": [
        {
          "title": "...",
          "authors": [{"name": "...", "affiliation": "..."}]
        }
      ],
      "all_people": ["jane smith", "robert chen", "m. kim", "..."]
    }
  ]
}
```

## 4. 프론트엔드 구조

**기술 스택**: Vanilla HTML + CSS + JavaScript. 프레임워크·번들러 없이. 이유는 (a) 데이터가 정적이고, (b) 기능이 단일 페이지 안에서 끝나고, (c) 사용자가 로컬에서 쉽게 실행·수정하도록.

**파일 구조**:
```
mpsa-viewer/
├── index.html           # 단일 페이지
├── css/
│   └── main.css
├── js/
│   ├── app.js           # 부트스트랩, 이벤트 바인딩
│   ├── filters.js       # 필터 상태 관리
│   ├── storage.js       # localStorage 래퍼 (filters + saved views)
│   ├── render.js        # 세션 렌더링 (timeline view)
│   └── search.js        # 저자/키워드 검색 로직 (인덱싱)
├── data/
│   └── program.json     # 파서 출력
├── scripts/
│   └── parse_mpsa.py    # 일회성 파서
└── raw_html/            # (gitignore) 원본 HTML 덤프
```

**모듈 경계**:
- `storage.js` — `loadFilters()`, `saveFilters()`, `listPresets()`, `savePreset(name)`, `updatePreset(id)`, `deletePreset(id)`, `loadPreset(id)`. localStorage 키는 `mpsa2026-filters`, `mpsa2026-presets`.
- `filters.js` — 현재 필터 상태(`FilterState` 객체)를 관리. 변화 이벤트를 발행. 활성 프리셋 ID와 "수정됨" 플래그 추적.
- `search.js` — `program.json`을 로드한 후 사람 이름 / 키워드를 lowercase 인덱스로 만들어 fuzzy 매칭 지원. 간단한 부분 문자열 매칭으로 시작(Levenshtein 불필요).
- `render.js` — 현재 `FilterState` + `program.json`을 받아 메인 영역을 다시 그림. 날짜별 섹션 → 시간대 row → parallel slot cards.
- `app.js` — DOMContentLoaded 시 program.json fetch → storage 복원 → 초기 렌더.

각 모듈은 글로벌 namespace(`MPSA.storage` 등) 하나만 노출. ES modules(`<script type="module">`)로 구성하면 더 깔끔하지만 로컬 `file://` 열기 시 CORS 제약이 있어서 일반 `<script>` + namespace 방식으로 간다.

## 5. UI 설계 (English)

### 5.1 레이아웃

- **헤더**: "MPSA 2026 Program" 타이틀, 날짜 범위 "Apr 23–26, 2026", 우측에 light/dark 토글(선택사항 — 2차). 높이 48px 정도로 좁게.
- **사이드바** (left, 260px 고정): 필터 패널. 페이지 스크롤 시 sticky. 화면 아래쪽에 "✓ Auto-saved" 상태와 "Reset all" 버튼.
- **메인 영역** (right, 나머지): 상단에 필터 요약바(active filter chips + 결과 개수 + 활성 프리셋 배지), 아래에 날짜 섹션들이 세로로 쭉 스크롤.

### 5.2 사이드바 구성 (위에서 아래로)

1. **Saved Views** — 저장된 프리셋 리스트, "+ Save current" 버튼, "Manage" 버튼
2. **Date** — 4개 체크박스 (Thu Apr 23, Fri Apr 24, Sat Apr 25, Sun Apr 26). 각 옆에 해당 날짜의 **전체** 세션 개수 (다른 필터 무관, 정적).
3. **Author** — **자동완성 검색창 + 선택 칩**. 사용자가 이름을 입력하면 `search.js`의 사람 인덱스에서 부분 문자열로 매칭되는 사람을 드롭다운으로 표시 (이름 + 소속 표시, 매칭 부분 하이라이트, 상위 8명). 드롭다운 항목 클릭 → 해당 사람이 칩으로 추가되고 입력창 비워짐. 칩의 × 버튼으로 제거. 복수 선택 = OR 조건.
4. **Division** — **체크박스 목록 + 상단 필터링 검색창**. `program.json`을 파싱할 때 세션에서 유니크 분과 목록을 추출해서 알파벳 정렬. 각 항목 옆에 그 분과에 속한 **전체** 세션 개수 표시 (정적, 재계산 안 함). 목록이 길어도 전부 보이지만, 상단 검색창에 타이핑하면 매칭되는 항목만 남도록 목록을 좁힘 (선택한 체크 상태는 유지). 복수 선택 = OR 조건.
5. **Topic / Keyword** — **자유 텍스트 검색**. 단일 입력창. 입력된 문자열을 소문자로 정규화한 뒤, 세션 제목 + 논문 제목에서 부분 문자열 매칭. 복수 키워드 입력 시 공백으로 분리해서 AND 조건(모든 키워드가 어딘가에 있어야 함). 따옴표 처리·정규식은 지원 안 함 (YAGNI). 입력값은 필터 상태에 그대로 저장.
6. **Session Type** — 체크박스 리스트 (Paper Panel, Roundtable, Poster 등 파싱된 유니크 값). 각 옆에 전체 세션 개수 (정적). 복수 선택 = OR 조건.

각 섹션 사이에 구분선. 사이드바 콘텐츠가 길면 사이드바 자체가 스크롤.

**필터 간 조합 규칙**: 각 카테고리 내부는 OR, 카테고리 간은 AND. 예: `(Thu OR Fri) AND (American OR Comparative) AND (Smith OR Lee) AND (contains "democracy") AND (Paper Panel)`.

### 5.3 메인 영역

**필터 요약 바** (항상 상단):
- 왼쪽: 활성 프리셋 배지(있으면) + 활성 필터 chip 요약
- 오른쪽: "N sessions" 카운트

**날짜 섹션** (체크된 날짜만):
- 섹션 헤더: "Thursday, April 23"
- 그 아래 시간대 row들. 각 row는 좌측에 time label ("8:00 AM"), 우측에 그 시간대에 열리는 세션 카드들이 가로로 나란히.
- 한 시간대에 필터 통과 세션이 여럿이면 카드가 나란히 (동시간대 평행 세션 시각화).

**세션 카드 (collapsed)**:
- 제목(bold), 분과 태그, 방, 논문 수
- 전체 카드 클릭 가능

**세션 카드 (expanded)**:
- 같은 시간대 row 안에서, 클릭된 카드는 그대로의 위치를 유지하면서 **카드 아래쪽에 상세 영역이 나타남** (카드 높이가 세로로 늘어남). 평행 세션 카드들은 건드리지 않음 (옆으로 밀리거나 축소되지 않음). 한 row 안에서 여러 카드가 동시에 펼쳐질 수 있음.
- 상세 영역 내용: Chair / Co-chair / Discussant 이름+소속, 그리고 Papers 리스트 (각 논문 제목 + 저자 이름+소속).
- 다시 같은 카드 클릭 → 접힘.

### 5.4 빈 상태 (Empty State)

필터가 비어있고 저장된 뷰도 없을 때(첫 방문):
- 사이드바: 저장된 뷰 칸에 "No saved views yet" 플레이스홀더. 나머지는 빈 체크박스.
- 메인: 중앙 정렬 안내 카드
  - 아이콘(placeholder emoji OK)
  - "MPSA 2026 Program" 제목
  - 설명: "Filter sessions by author, division, topic, or date to build your schedule."
  - 힌트 박스: "← Pick filters in the sidebar. Save combinations you like as Saved Views."

필터를 1개라도 걸면 메인이 타임슬롯 뷰로 전환.

### 5.5 상호작용 세부

- 필터 변경 → 즉시 반영 (debounce 없음, 데이터가 수백 세션 수준이라 충분히 빠름).
- 필터 변경 → 즉시 localStorage에 저장 → 사이드바 하단 "Auto-saved" 타임스탬프 갱신.
- "Save current" 클릭 → 이름 입력 모달(prompt로 시작해도 됨) → 프리셋 추가.
- 프리셋 클릭 → 현재 필터 상태 덮어쓰기, 활성 프리셋 갱신.
- 활성 프리셋이 있을 때 필터 변경 → "modified" 플래그 on → 이름 옆에 "●" 표시 + 사이드바 버튼이 "Update [이름]" / "Save as new" 둘로 전환.
- "Manage" → 간단한 모달/drawer에서 rename/delete.
- "Reset all" → 모든 필터 해제, 활성 프리셋 해제, 빈 상태로 돌아감.

## 6. 저장소 (localStorage)

두 개의 키:
- `mpsa2026-filters` → 현재 세션의 필터 상태 (JSON)
- `mpsa2026-presets` → 저장된 뷰 목록 (`[{id, name, filters, createdAt, updatedAt}]`)

별도의 `mpsa2026-active-preset` 키로 현재 활성 프리셋 ID만 따로 저장.

`FilterState` 스키마:
```ts
{
  dates: string[],          // ISO 날짜 (예: "2026-04-23")
  authors: string[],        // 사람의 canonical name (program.json에서 추출된 그대로)
  divisions: string[],      // 분과 이름
  sessionTypes: string[],   // 세션 타입 이름
  keyword: string           // 자유 텍스트 입력 원본 (소문자 정규화는 렌더 시)
}
```

`Preset` 스키마:
```ts
{
  id: string,               // uuid 또는 timestamp 기반 ID
  name: string,             // 사용자가 입력한 이름
  filters: FilterState,
  createdAt: number,        // epoch ms
  updatedAt: number
}
```

## 7. 파일 오프닝 방식

사용자가 `index.html`을 파일 더블클릭으로 열면 `fetch('data/program.json')`이 CORS 에러로 실패할 수 있다. 두 가지 대응:
1. **권장**: 프로젝트 루트에서 `python -m http.server 8000` 돌리고 `http://localhost:8000` 접속. README에 한 줄로 안내.
2. **대안**: 파서가 `program.json` 대신 `program.js` (`window.MPSA_DATA = {...}`)를 생성하도록 옵션 제공. 그러면 `<script src="data/program.js">`로 로드 가능.

1번을 기본으로 가고, 2번은 "로컬 서버 띄우기 싫을 때" 메모로만 README에 적는다.

## 8. 범위 밖 (YAGNI)

다음 기능은 이번 버전에 포함하지 않는다:
- 사용자 인증, 서버 백엔드
- 세션 팔로우/알림, 캘린더 내보내기, iCal export
- 세션 충돌 자동 감지/경고 (시각적으로 평행 카드가 보이면 충분)
- 노트/태그 기능
- 다국어 UI
- 반응형 모바일 최적화 (데스크탑 우선, 모바일은 기본적인 가독성만 보장)
- 프리셋 내보내기/공유

필요해지면 그때 추가한다.

## 9. 테스팅 전략

- **파서**: 실제 HTML 샘플이 있어야 진짜 검증이 가능하므로 사용자가 HTML을 덤프해 준 다음 파서 돌려보고 눈으로 확인. 자동 테스트는 `session_count > 0`, 필수 필드 non-null 정도만.
- **프론트엔드**: `program.json` 고정 샘플을 만들어놓고, 필터 로직 단위 테스트. 커버할 케이스: 카테고리 내부 OR (날짜·분과·저자·세션타입), 카테고리 간 AND, 키워드 공백 분리 AND, 모든 필터가 빈 상태 = empty state. DOM 통합 테스트는 과함 — 브라우저에서 클릭해보면 끝.
- **스토리지**: localStorage 래퍼 함수 단위 테스트(저장·로드·삭제·비정상 JSON 복구).

테스트 러너는 Node.js 기본 `node:test` 또는 가볍게 `<script>` 기반 브라우저 테스트 페이지. 굳이 Jest/Vitest 설치 안 함.

## 10. 작업 순서 (다음 단계)

설계 확정 후 다음 스킬은 `writing-plans`로 넘어가서 구체적인 구현 계획을 만든다. 예상 순서:

1. 사용자가 4일치 HTML 덤프 → `raw_html/` 에 저장
2. Python 파서 작성 → `program.json` 생성
3. `index.html` + CSS 스캐폴드 (레이아웃·사이드바·메인 영역)
4. `storage.js` + `filters.js` — 필터 상태·저장 로직
5. `search.js` — 인덱싱
6. `render.js` — 타임슬롯 뷰 렌더링
7. 카드 확장 인터랙션
8. Saved Views 프리셋 기능
9. 빈 상태, 필터 요약 바 폴리싱
10. README (실행 방법, HTML 수집 방법)
