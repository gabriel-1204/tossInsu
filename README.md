# 보험 자격시험 모의고사

손해보험·생명보험·변액보험 자격시험 대비 모의고사 웹앱.

## 현재 시스템 구성

| 보험 종류 | 출제 방식 | 문항/시간 | 데이터 소스 | 해설 |
|---|---|---|---|---|
| 손해보험 | 통합 풀 랜덤 | 50/60분 | `data/questions.js` | 없음 |
| 변액보험 | 통합 풀 랜덤 | 40/50분 | `data/변액보험_questions.js` | 없음 |
| **생명보험** | **회차 단위** | **40/50분** | `data/exams/생명보험/{key}.json` (24회차) | **PDF 원본 해설 표시** |

생명보험은 2025년 + 2026년 1월 모의고사 24회분을 PDF에서 자동 추출하여 **실제 시험과 동일한 회차 단위**로 풀이한다. 손해보험·변액보험은 향후 동일 패턴으로 전환 예정 (가이드는 아래 참조).

---

## 회차 단위 시스템 (생명보험 기준)

### 데이터 구조

```
data/exams/생명보험/
├── _index.json              # 회차 목록 + complete 플래그
├── 2025_01_1.json
├── 2025_01_2.json
├── ...
└── 2026_01_2.json           # 총 24개
```

**`_index.json`**
```json
{
  "type": "생명보험",
  "textbookYear": 2025,
  "exams": [
    { "key": "2026_01_2", "title": "2026년 1월 2회", "year": 2026, "month": 1, "round": 2, "complete": true },
    ...
  ]
}
```

**`{key}.json`**
```json
{
  "key": "2025_01_1",
  "title": "2025년 1월 1회",
  "year": 2025, "month": 1, "round": 1,
  "duration": 50,
  "totalQuestions": 40,
  "sections": [
    { "name": "보험이론 및 윤리", "range": [1, 10],  "points": 3 },
    { "name": "보험법규",         "range": [11, 20], "points": 3 },
    { "name": "생명보험",         "range": [21, 30], "points": 4 },
    { "name": "제3보험",          "range": [31, 40], "points": 4 }
  ],
  "questions": [
    {
      "id": 1,
      "section": "보험이론 및 윤리",
      "question": "...",
      "options": ["...", "...", "..."],
      "answer": 1,
      "explanation": "PDF 원본 해설 텍스트",
      "points": 3
    }
  ]
}
```

### 화면 흐름

```
[index.html]  생명보험 탭 → 모의고사 카드 클릭
                            ↓
                연도/회차 드롭다운 인라인 펼침
                            ↓
                  [시험 시작] 클릭
                            ↓
[exam.html]   회차 JSON fetch → 40문제 풀이 (50분, 섹션 라벨)
                            ↓
[result.html] 4섹션 채점 + 60% 합격 판정
              오답 카드 → "📖 해설 보기" → PDF 원본 해설 즉시 표시
```

**AI API 호출 없음.** 모든 해설은 PDF 추출 시점에 사전 저장된 텍스트.

---

## 데이터 추출 파이프라인

[scripts/parse_lifeinsurance.py](scripts/parse_lifeinsurance.py) — 모의고사 PDF → 회차별 JSON 자동 변환.

### 3단계 폴백 구조

```
PDF 입력
  ↓
[1] 텍스트 추출 (pdfplumber)  ← 텍스트 PDF
  ↓ 실패 (이미지 PDF)
[2] Gemini Vision OCR (페이지 단위, gemini-2.5-flash)
  ↓ 일부 페이지 누락 또는 timeout
[3] gemini-2.5-pro 자동 fallback (페이지 단위)
  ↓ 여전히 누락
[4] PDF inline + structured output (gemini-2.5-pro, --fill-missing)
  ↓
회차 JSON + sanity 검증 (정답 범위, 해설/섹션 존재)
```

### 사용법

```bash
# 환경 설정
echo "<GEMINI_API_KEY>" > API.txt
pip install pdfplumber pymupdf

# 단일 PDF 검증 (stdout JSON 출력)
python scripts/parse_lifeinsurance.py --single "<PDF경로>"

# 전체 일괄 처리 (텍스트 + OCR + fallback)
python scripts/parse_lifeinsurance.py --all

# 부분 회차의 누락 문항을 PDF inline + structured output으로 자동 보완
python scripts/parse_lifeinsurance.py --fill-missing
```

### 환경변수

| 변수 | 기본값 | 용도 |
|---|---|---|
| `SKIP_COMPLETE` | `0` | `1`로 두면 이미 완전한 회차(`missingIds` 없음)는 스킵 |
| `OCR_DPI` | `200` | PDF → 이미지 DPI. 높이면 정확도↑/속도↓ |
| `GEMINI_TIMEOUT` | `60` | 페이지당 API timeout (초) |
| `GEMINI_RETRIES` | `2` | 페이지당 재시도 횟수 |
| `GEMINI_MODEL` | `gemini-2.5-flash` | 1차 모델 |
| `GEMINI_FALLBACK_MODEL` | `gemini-2.5-pro` | 페이지 실패 시 자동 폴백 모델 |

### 비용 참고

24회차 PDF 자동 추출 1회 처리 기준 약 $0.05~0.10 (Gemini Flash + Pro 폴백 혼합).

---

## 손해보험·변액보험 회차 단위 전환 가이드

생명보험 패턴을 그대로 적용한다.

### 1단계: 추출 스크립트 작성

[scripts/parse_lifeinsurance.py](scripts/parse_lifeinsurance.py)를 복사하여 변경:

```python
# 입력 디렉토리
INPUT_DIRS = [
    os.path.join(BASE, "문제집", "손해보험", "손보_2025_모의고사"),
    os.path.join(BASE, "문제집", "손해보험", "모의고사_손보_2026", "1월"),
]

# 출력 디렉토리
OUTPUT_DIR = os.path.join(BASE, "data", "exams", "손해보험")

# 시험 섹션 (보험별 실제 출제 형식 참고)
# 손해보험: 50문항 (1~17 손해 / 18~33 공통 / 34~50 제3보험)
SECTIONS = [
    {"name": "손해보험", "range": [1, 17],  "points": 2},
    {"name": "공통",     "range": [18, 33], "points": 2},
    {"name": "제3보험",  "range": [34, 50], "points": 2},
]

# duration 등 메타도 보험별로
# parse_exam에서 "duration": 60, "totalQuestions": 50 같이
```

### 2단계: PDF 추출 실행

```bash
python scripts/parse_손해보험.py --all
python scripts/parse_손해보험.py --fill-missing  # 누락 보완
```

`data/exams/손해보험/` 디렉토리 + `_index.json` + 회차 JSON들 생성.

### 3단계: 프론트엔드 변경

**[js/app.js](js/app.js)** — `EXAM_TYPE_CONFIG`에 `byRound: true` 추가:

```javascript
'손해보험': { total: 50, time: 60, label: '손해보험', byRound: true },
```

**[index.html](index.html)** — `renderExamGrid()`의 `if (config.byRound)` 분기는 이미 보험 종류 무관하게 동작. `loadLifeIndex()`/`renderLifeSelector()`/`onYearChange()`/`onRoundChange()`/`startExam()`을 보험별로 일반화하거나 동일 함수에 `currentExamType` 매개변수 추가 필요.

**[js/exam.js](js/exam.js)** — `loadQuestions()`의 생명보험 분기를 일반화:

```javascript
if (session.examType && session.examKey) {
  examMeta = await loadExamData(session.examType, session.examKey);
  questions = examMeta.questions.slice();
  ...
}
```

**[js/result.js](js/result.js)** — 섹션별 채점은 `sections` 메타로 자동 동작. 손해보험 50문항 분리채점 가드(`results.length === 50`)는 회차 단위로 가면 자동으로 sections 분기로 대체됨.

### 4단계: 통합 풀 폐기

```bash
git rm data/questions.js              # 손해보험
git rm data/변액보험_questions.js     # 변액보험
```

`result.html`·`exam.html`에서 해당 `<script>` 태그 제거. `js/app.js`의 `getQuestionsForType()` 분기 정리.

### 주의사항

- **이미지 PDF가 섞여 있을 가능성**: 보험별 PDF 출판사가 다르면 OCR 필요. Gemini Vision으로 처리됨.
- **시험 형식 변동 점검**: 회차마다 섹션 비중이 다를 수 있음 (예: 보험법규 개정 반영). PDF 마지막 페이지 정답표 형식이 일관된지 1~2개 회차로 사전 검증.
- **옵션 갯수 sanity 점검**: 추출 후 섹션별 옵션 갯수(3지선다/4지선다) 분포가 시험 형식과 일치하는지 검증. 불일치 시 해당 회차만 `--fill-missing`로 재추출.

---

## 프로젝트 구조

```
├── index.html              # 메인 (탭, 카드, 드롭다운, 지난 기록)
├── exam.html               # 시험 진행 화면
├── result.html             # 채점 결과 화면
├── login.html              # 로그인
├── admin.html              # 관리자 대시보드
├── css/style.css           # Toss 디자인 시스템
├── js/
│   ├── app.js              # 공통 유틸 + loadExamData/loadExamIndex
│   ├── auth.js             # Supabase 인증
│   ├── exam.js             # 시험 로직 (타이머, 렌더링, 채점)
│   └── result.js           # 결과 (섹션별 채점, 원본 해설 표시)
├── data/
│   ├── questions.js                  # 손해보험 통합 풀 (옛 시스템)
│   ├── 변액보험_questions.js          # 변액보험 통합 풀 (옛 시스템)
│   └── exams/
│       └── 생명보험/                  # 회차 단위 (현재 시스템)
│           ├── _index.json
│           └── {year}_{month}_{round}.json × 24
├── scripts/                # gitignore (*.py)
│   ├── parse_pdf.py                  # 통합 풀용 (손해/변액)
│   ├── parse_docx.py                 # 옛 docx 변환
│   └── parse_lifeinsurance.py        # 회차 단위 + Gemini 통합
├── supabase/
│   ├── functions/gemini-proxy/       # AI 해설 Edge Function (현재 미사용)
│   └── migrations/                   # auth + exam_results 테이블
├── 문제집/                  # gitignore (원본 PDF)
│   ├── 손해보험/
│   ├── 생명보험/
│   └── 변액보험/
├── sw.js                   # Service Worker (캐싱)
├── manifest.json           # PWA 메타
├── vercel.json             # Vercel 배포 설정
└── API.txt                 # Gemini API 키 (gitignore)
```

---

## 실행 방법

정적 사이트라 아무 정적 서버로 실행 가능:

```bash
npx serve -l 3000 .
# 또는
python -m http.server 3000
```

브라우저에서 `http://localhost:3000` 접속.

---

## 인증 / 배포

- **인증**: Supabase Auth (아이디·비밀번호). [supabase/migrations/](supabase/migrations/) 참조.
- **배포**: Vercel 자동 배포 (`master` 브랜치 push 시).

---

## 기술 스택

- **프론트엔드**: Vanilla HTML/CSS/JS (프레임워크 없음), PWA (sw.js)
- **백엔드**: Supabase (Auth, Edge Functions, Storage)
- **데이터 추출**: pdfplumber + PyMuPDF + Gemini API (Vision OCR + structured output)
- **배포**: Vercel
