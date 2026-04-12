// 채점 결과 + Gemini 해설

// 인증 초기화
initAuth({ requiredRole: 'agent' });

const lastResult = LS.get('last_result');
if (!lastResult) {
  window.location.href = 'index.html';
}

const { results, elapsed, examId, examType } = lastResult;

// 히스토리에 저장 (중복 방지: finishedAt 기준)
(function saveHistory() {
  const history = LS.get('exam_history', []);
  const already = history.some(h => h.finishedAt === lastResult.finishedAt);
  if (!already) {
    history.unshift({
      finishedAt: lastResult.finishedAt,
      examId: lastResult.examId,
      examType: lastResult.examType || '손해보험',
      total: lastResult.results.length,
      correct: lastResult.results.filter(r => r.correct).length,
      elapsed: lastResult.elapsed,
      results: lastResult.results,
    });
    // 최대 30개 보관
    if (history.length > 30) history.pop();
    LS.set('exam_history', history);
  }
})();
const wrong = results.filter(r => !r.correct);
const correct = results.filter(r => r.correct);
const score = Math.round((correct.length / results.length) * 100);

// 점수 표시
document.getElementById('scoreDisplay').textContent = score;
document.getElementById('correctCount').textContent = correct.length;
document.getElementById('totalCount').textContent = results.length;

const mins = Math.floor(elapsed / 60);
const secs = elapsed % 60;
document.getElementById('scoreMeta').textContent =
  `소요시간 ${mins}분 ${secs}초 · ${getExamName(examId, examType)}`;

if (wrong.length === 0) {
  document.getElementById('retryWrongBtn').disabled = true;
  document.getElementById('retryWrongBtn').textContent = '오답 없음!';
}

// 실전 모의고사: 과목별 채점
if (examId === 'real' && results.length === 50 && (!examType || examType === '손해보험')) {
  const 손해 = results.slice(0, 17);   // 1~17번: 손해보험
  const 공통 = results.slice(17, 33);  // 18~33번: 공통
  const 제3 = results.slice(33, 50);   // 34~50번: 제3보험

  const 손해정답 = 손해.filter(r => r.correct).length;
  const 공통정답 = 공통.filter(r => r.correct).length;
  const 제3정답 = 제3.filter(r => r.correct).length;

  // 손해보험 점수 = (손해 + 공통) / 33 × 100
  const 손해점수 = Math.round(((손해정답 + 공통정답) / 33) * 100);
  // 제3보험 점수 = (공통 + 제3보험) / 33 × 100
  const 제3점수 = Math.round(((공통정답 + 제3정답) / 33) * 100);

  const 손해합격 = 손해점수 >= 60;
  const 제3합격 = 제3점수 >= 60;
  const 최종합격 = 손해합격 && 제3합격;

  const scoreList = document.getElementById('subjectScoreList');
  scoreList.innerHTML = `
    <div style="display:flex;gap:8px;margin-bottom:8px">
      <div style="flex:1;padding:12px;border-radius:8px;background:var(--gray-100);text-align:center">
        <div style="font-size:12px;color:var(--gray-500)">손해보험</div>
        <div style="font-size:12px;color:var(--gray-500)">(손해${손해정답}/17 + 공통${공통정답}/16)</div>
        <div style="font-size:24px;font-weight:800;color:${손해합격 ? 'var(--blue)' : 'var(--red)'}">${손해점수}<span style="font-size:12px">점</span></div>
        <div style="font-size:11px;color:${손해합격 ? 'var(--green)' : 'var(--red)'};font-weight:600">${손해합격 ? 'PASS' : 'FAIL'}</div>
      </div>
      <div style="flex:1;padding:12px;border-radius:8px;background:var(--gray-100);text-align:center">
        <div style="font-size:12px;color:var(--gray-500)">제3보험</div>
        <div style="font-size:12px;color:var(--gray-500)">(공통${공통정답}/16 + 제3${제3정답}/17)</div>
        <div style="font-size:24px;font-weight:800;color:${제3합격 ? 'var(--blue)' : 'var(--red)'}">${제3점수}<span style="font-size:12px">점</span></div>
        <div style="font-size:11px;color:${제3합격 ? 'var(--green)' : 'var(--red)'};font-weight:600">${제3합격 ? 'PASS' : 'FAIL'}</div>
      </div>
    </div>
  `;

  const passEl = document.getElementById('passResult');
  if (최종합격) {
    passEl.style.background = '#e8f5e9';
    passEl.style.color = 'var(--green)';
    passEl.textContent = '합격 (각 과목 60점 이상)';
  } else {
    passEl.style.background = '#ffeaea';
    passEl.style.color = 'var(--red)';
    passEl.textContent = '불합격 (각 과목 60점 이상 필요)';
  }

  document.getElementById('subjectScores').style.display = 'block';
}

// 문제 카드 HTML 생성
function renderResultCard(r, showBadge) {
  const badge = r.correct
    ? `<span class="result-badge badge-correct">✅ 정답</span>`
    : `<span class="result-badge badge-wrong">❌ 오답</span>`;

  const optionsHtml = r.options.map((opt, i) => {
    const num = i + 1;
    let cls = '';
    if (num === r.answer) cls = 'correct';
    else if (num === r.userAnswer && !r.correct) cls = 'wrong';
    return `<div class="option ${cls}">
      <span class="option-num">${num}</span>
      <span>${escapeHtml(opt)}</span>
    </div>`;
  }).join('');

  const geminiBtn = !r.correct ? `
    <button class="btn btn-secondary" style="font-size:13px;padding:8px 14px;margin-top:10px"
            onclick="explainWithGemini(${r.id}, this)">
      🤖 Gemini 해설 보기
    </button>
    <div id="exp-${r.id}" class="explanation" style="display:none"></div>
  ` : '';

  return `
    <div class="card result-item" id="rcard-${r.id}">
      ${badge}
      <div class="question-num">${results.indexOf(r) + 1}번</div>
      <div class="question-text">${escapeHtml(r.question)}</div>
      <div class="options">${optionsHtml}</div>
      ${!r.correct ? `<div style="font-size:13px;color:var(--gray-500);margin-top:8px">
        내 답: ${r.userAnswer || '미응답'} · 정답: ${r.answer}
      </div>` : ''}
      ${geminiBtn}
    </div>`;
}

// 오답 목록 렌더링
document.getElementById('wrongList').innerHTML =
  wrong.length > 0
    ? wrong.map(r => renderResultCard(r, true)).join('')
    : '<div class="card card-sm" style="text-align:center;color:var(--gray-500)">오답이 없습니다 🎉</div>';

// 정답 목록 렌더링 (숨김)
document.getElementById('correctList').innerHTML =
  correct.map(r => renderResultCard(r, true)).join('');

function toggleCorrect() {
  const el = document.getElementById('correctList');
  const btn = document.getElementById('toggleCorrectBtn');
  if (el.style.display === 'none') {
    el.style.display = 'block';
    btn.textContent = '✅ 정답 목록 접기';
  } else {
    el.style.display = 'none';
    btn.textContent = '✅ 정답 목록 보기';
  }
}

// 간단한 RAG: 문제와 관련된 참고자료만 추출 (최대 2000자)
function extractRelevantContext(r) {
  if (typeof KEYWORDS_TEXT === 'undefined' || !KEYWORDS_TEXT) return '';

  // 문제+보기에서 핵심 키워드 추출 (2글자 이상 명사/용어)
  const fullText = r.question + ' ' + r.options.join(' ');
  const keywords = fullText
    .replace(/[().,·\-/\s]+/g, ' ')
    .split(' ')
    .filter(w => w.length >= 2)
    .filter(w => !/^\d+$/.test(w) && !/^(다음|대한|대해|것은|중에서|설명|관한|해당|아닌|옳은|틀린|맞는|않는|경우|이상|이하|이내|위해)$/.test(w));

  // 문장 단위로 분리
  const sentences = KEYWORDS_TEXT.split(/[.\n]/).filter(s => s.trim().length > 10);

  // 각 문장에 매칭되는 키워드 수 계산
  const scored = sentences.map(s => {
    const hits = keywords.filter(kw => s.includes(kw)).length;
    return { text: s.trim(), score: hits };
  });

  // 상위 매칭 문장 추출 (최소 2개 키워드 매칭, 최대 2000자)
  const relevant = scored
    .filter(s => s.score >= 2)
    .sort((a, b) => b.score - a.score);

  let result = '';
  for (const s of relevant) {
    if (result.length + s.text.length > 2000) break;
    result += s.text + '\n';
  }
  return result.trim();
}

// Gemini 해설 (Edge Function 프록시 경유)
async function explainWithGemini(questionId, btn) {
  const r = results.find(x => x.id === questionId);
  if (!r) return;

  const expEl = document.getElementById('exp-' + questionId);
  btn.disabled = true;
  btn.textContent = '⏳ 해설 불러오는 중...';
  expEl.style.display = 'block';
  expEl.className = 'explanation explanation-loading';
  expEl.textContent = 'Gemini가 해설을 작성하고 있습니다...';

  const relevantCtx = extractRelevantContext(r);
  const optionLines = r.options.map((o, i) => `${i + 1}. ${o}`).join('\n');
  const userAns = r.userAnswer || '미응답';
  const prompt = `보험 시험 문제의 오답 해설을 해줘.

문제: ${r.question}
${optionLines}
정답: ${r.answer}번 / 내가 고른 답: ${userAns}번

규칙:
1. 정답(${r.answer}번)이 왜 정답인지 2~3문장으로 핵심만 설명
2. 내가 고른 답(${userAns}번)은 사실은 맞는/틀린 설명이라서 이 문제의 정답이 될 수 없는 이유를 1문장으로 설명. 보기의 사실관계를 임의로 뒤집지 마.
3. 마크다운 서식 금지. 5줄 이내.`;

  try {
    const text = await callGeminiProxy(prompt, relevantCtx);
    expEl.className = 'explanation';
    expEl.textContent = text || '해설을 받지 못했습니다.';
    btn.style.display = 'none';
  } catch (e) {
    expEl.className = 'explanation';
    expEl.textContent = `오류: ${e.message}`;
    btn.disabled = false;
    btn.textContent = '🤖 다시 시도';
  }
}

// 재시험 버튼
function retryWrong() {
  const wrongIds = LS.get('wrong_answers', []);
  if (wrongIds.length === 0) return;
  const session = {
    examId: 'retry',
    questionIds: wrongIds,
    answers: {},
    startedAt: new Date().toISOString(),
    totalTime: Math.max(30, Math.ceil(wrongIds.length * 1.2)),
  };
  LS.set('exam_session', session);
  window.location.href = 'exam.html';
}

function retryAll() {
  const originalIds = results.map(r => r.id);
  const totalTime = examId === 'real' ? 60 : 25;
  const session = {
    examId: examId,
    questionIds: originalIds,
    answers: {},
    startedAt: new Date().toISOString(),
    totalTime,
  };
  LS.set('exam_session', session);
  window.location.href = 'exam.html';
}
