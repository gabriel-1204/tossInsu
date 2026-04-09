# 손해보험 모의고사

손해보험 자격시험 대비 모의고사 웹앱. 실제 시험과 동일한 구조(50문항/60분, 과목별 채점)로 연습할 수 있다.

## 실행 방법

정적 HTML 앱이므로 아무 웹 서버로 띄우면 된다.

```bash
# 방법 1: npx serve
npx serve -l 3000 .

# 방법 2: Python
python -m http.server 3000

# 방법 3: VS Code Live Server 등 아무 정적 서버
```

브라우저에서 `http://localhost:3000` 접속.

## 문제 데이터 재생성

원본 docx를 수정했거나 새 문제를 추가한 경우:

```bash
pip install python-docx   # 최초 1회
python scripts/parse_docx.py
```

`손해보험/문제/` 폴더의 docx 파일을 파싱해서 `data/questions.js`와 `data/keywords.js`를 자동 생성한다.

## 시험 구조

### 실전 모의고사 (50문항 / 60분)

실제 손해보험 자격시험과 동일한 구조:

| 번호 | 과목 | 문항 수 |
|------|------|---------|
| 1~17 | 손해보험 | 17 |
| 18~33 | 공통 | 16 |
| 34~50 | 제3보험 | 17 |

각 과목의 문제 풀에서 랜덤 샘플링. 매번 다른 조합으로 출제된다.

### 과목별 연습 (20문항 / 25분)

손해보험 / 공통 / 제3보험 중 선택해서 해당 과목만 연습.

### 오답 재시험

직전 시험에서 틀린 문항만 다시 풀기.

## 채점 방식

### 실전 모의고사 — 과목별 채점

공통 과목(18~33번)이 양쪽에 모두 포함된다:

- **손해보험 점수** = (손해 1~17번 + 공통 18~33번) 정답 수 / 33 x 100
- **제3보험 점수** = (공통 18~33번 + 제3보험 34~50번) 정답 수 / 33 x 100
- **합격**: 각 과목 60점 이상

### 과목별 연습 — 단순 정답률

정답 수 / 전체 문항 수 x 100

## 문제 데이터

- 총 241문항 (손해보험 92 / 공통 86 / 제3보험 63)
- 출처: 25년 모의고사 #1~#3 (150문항) + 26년 예상문제 전체범위 (100문항)
- 중복 9문항 제거, 과목별 분류 완료

### 과목 분류 방식

- **전체범위 100문항**: docx 섹션 헤더(손해보험편/공통편/제3보험편)에서 자동 분류
- **모의고사 #1~#3 141문항**: 키워드 매칭 + 수동 검증으로 분류
- `data/category_map.json`에 문제별 과목 매핑 저장

## Gemini 해설

오답에 대해 AI 해설을 제공한다.

- [Google AI Studio](https://aistudio.google.com/apikey)에서 API 키 발급
- 메인 화면 입력란에 키 입력 (브라우저 localStorage에만 저장)
- 문제와 관련된 참고자료만 추출해서 보내는 키워드 기반 RAG로 동작

## 프로젝트 구조

```
├── index.html              # 메인 화면 (시험 선택, 설명서, 기록)
├── exam.html               # 시험 진행 화면
├── result.html             # 채점 결과 화면
├── css/style.css           # 스타일 (Toss 디자인 시스템)
├── js/
│   ├── app.js              # 공통 유틸 (localStorage, 시간 포맷 등)
│   ├── exam.js             # 시험 로직 (타이머, 문제 렌더링, 채점)
│   └── result.js           # 결과 화면 (과목별 점수, Gemini 해설, RAG)
├── data/
│   ├── questions.js        # 문제 데이터 (자동 생성)
│   ├── keywords.js         # 참고자료 텍스트 (자동 생성)
│   └── category_map.json   # 문제별 과목 매핑
├── scripts/
│   └── parse_docx.py       # docx → questions.js 변환 스크립트
├── 손해보험/
│   ├── 문제/               # 원본 docx 파일 (4개)
│   └── 설명/               # 키워드/정리 docx 파일 (3개)
└── reports/
    └── verification_report.md  # 분류/정답 검증 리포트
```

## 데이터 흐름

```
[docx 파일] → parse_docx.py → [questions.js + keywords.js]
                                        ↓
index.html → 시험 선택 → exam_session (localStorage)
                                        ↓
exam.html → 문제 풀기 → 제출 → last_result (localStorage)
                                        ↓
result.html → 과목별 채점 → exam_history (localStorage)
                ↓
        Gemini 해설 (RAG로 관련 참고자료만 추출 → API 호출)
```

## 기술 스택

- Vanilla HTML/CSS/JS (프레임워크 없음)
- localStorage (서버/DB 없음)
- python-docx (docx 파싱)
- Gemini API (해설, 선택사항)
