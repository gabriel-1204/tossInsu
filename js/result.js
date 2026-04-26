// 채점 결과 + 원본 해설 표시 (AI 호출 없음)

initAuth({ requiredRole: 'agent' });

const lastResult = LS.get('last_result');
if (!lastResult) {
  window.location.href = 'index.html';
}

const { results, elapsed, examId, examType, examKey, examTitle, sections } = lastResult;

// 히스토리 저장 (중복 방지: finishedAt 기준)
(function saveHistory() {
  const history = LS.get('exam_history', []);
  const already = history.some(h => h.finishedAt === lastResult.finishedAt);
  if (!already) {
    history.unshift({
      finishedAt: lastResult.finishedAt,
      examId: lastResult.examId,
      examType: lastResult.examType || '손해보험',
      examKey: lastResult.examKey || null,
      examTitle: lastResult.examTitle || null,
      sections: lastResult.sections || null,
      total: lastResult.results.length,
      correct: lastResult.results.filter(r => r.correct).length,
      elapsed: lastResult.elapsed,
      results: lastResult.results,
    });
    if (history.length > 30) history.pop();
    LS.set('exam_history', history);
  }
})();

const wrong = results.filter(r => !r.correct);
const correct = results.filter(r => r.correct);
const score = Math.round((correct.length / results.length) * 100);

document.getElementById('scoreDisplay').textContent = score;
document.getElementById('correctCount').textContent = correct.length;
document.getElementById('totalCount').textContent = results.length;

const mins = Math.floor(elapsed / 60);
const secs = elapsed % 60;
document.getElementById('scoreMeta').textContent =
  `소요시간 ${mins}분 ${secs}초 · ${getExamName(examId, examType, examTitle)}`;

if (wrong.length === 0) {
  document.getElementById('retryWrongBtn').disabled = true;
  document.getElementById('retryWrongBtn').textContent = '오답 없음!';
}

// 손해보험 실전 모의고사: 손해/공통/제3 분리 채점
if (examId === 'real' && results.length === 50 && (!examType || examType === '손해보험')) {
  const 손해 = results.slice(0, 17);
  const 공통 = results.slice(17, 33);
  const 제3 = results.slice(33, 50);

  const 손해정답 = 손해.filter(r => r.correct).length;
  const 공통정답 = 공통.filter(r => r.correct).length;
  const 제3정답 = 제3.filter(r => r.correct).length;

  const 손해점수 = Math.round(((손해정답 + 공통정답) / 33) * 100);
  const 제3점수 = Math.round(((공통정답 + 제3정답) / 33) * 100);
  const 손해합격 = 손해점수 >= 60;
  const 제3합격 = 제3점수 >= 60;
  const 최종합격 = 손해합격 && 제3합격;

  document.getElementById('subjectScoreList').innerHTML = `
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
    </div>`;

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

// 생명보험 회차 단위: 섹션별 점수 표시
if (examType === '생명보험' && examKey && Array.isArray(sections) && sections.length) {
  const rows = sections.map(s => {
    const inSec = results.filter(r => r.section === s.name);
    const correct = inSec.filter(r => r.correct).length;
    const total = inSec.length;
    const points = correct * (s.points || 0);
    const maxPoints = total * (s.points || 0);
    return `
      <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--gray-200)">
        <div style="flex:1;font-size:13px;color:var(--gray-700)">${escapeHtml(s.name)}</div>
        <div style="font-size:13px;color:var(--gray-500)">${correct}/${total}</div>
        <div style="font-size:14px;font-weight:700;color:var(--blue);min-width:60px;text-align:right">${points}/${maxPoints}점</div>
      </div>`;
  }).join('');
  const totalPoints = sections.reduce((sum, s) => {
    const c = results.filter(r => r.section === s.name && r.correct).length;
    return sum + c * (s.points || 0);
  }, 0);
  const maxTotal = sections.reduce((sum, s) => {
    const t = results.filter(r => r.section === s.name).length;
    return sum + t * (s.points || 0);
  }, 0);
  const pass = totalPoints >= maxTotal * 0.6;

  document.getElementById('subjectScoreList').innerHTML = rows + `
    <div style="display:flex;align-items:center;gap:8px;padding:10px 0 4px;font-weight:700">
      <div style="flex:1">총점</div>
      <div style="font-size:16px;color:${pass ? 'var(--blue)' : 'var(--red)'}">${totalPoints}/${maxTotal}점</div>
    </div>`;
  const passEl = document.getElementById('passResult');
  if (pass) {
    passEl.style.background = '#e8f5e9';
    passEl.style.color = 'var(--green)';
    passEl.textContent = '합격 (60% 이상)';
  } else {
    passEl.style.background = '#ffeaea';
    passEl.style.color = 'var(--red)';
    passEl.textContent = '불합격 (60% 이상 필요)';
  }
  document.getElementById('subjectScores').style.display = 'block';
}

// 문제 카드
function renderResultCard(r) {
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

  const expBtn = !r.correct ? `
    <button class="btn btn-secondary" style="font-size:13px;padding:8px 14px;margin-top:10px"
            onclick="showExplanation(${r.id}, this)">
      📖 해설 보기
    </button>
    <div id="exp-${r.id}" class="explanation" style="display:none"></div>
  ` : '';

  return `
    <div class="card result-item" id="rcard-${r.id}">
      ${badge}
      <div class="question-num">${results.indexOf(r) + 1}번${r.section ? ` · ${escapeHtml(r.section)}` : ''}</div>
      <div class="question-text">${escapeHtml(r.question)}</div>
      <div class="options">${optionsHtml}</div>
      ${!r.correct ? `<div style="font-size:13px;color:var(--gray-500);margin-top:8px">
        내 답: ${r.userAnswer || '미응답'} · 정답: ${r.answer}
      </div>` : ''}
      ${expBtn}
    </div>`;
}

document.getElementById('wrongList').innerHTML =
  wrong.length > 0
    ? wrong.map(r => renderResultCard(r)).join('')
    : '<div class="card card-sm" style="text-align:center;color:var(--gray-500)">오답이 없습니다 🎉</div>';

document.getElementById('correctList').innerHTML =
  correct.map(r => renderResultCard(r)).join('');

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

// 원본 해설 표시 (AI 호출 없음)
function showExplanation(questionId, btn) {
  const r = results.find(x => x.id === questionId);
  if (!r) return;
  const expEl = document.getElementById('exp-' + questionId);
  expEl.style.display = 'block';
  expEl.className = 'explanation';
  const text = r.explanation && r.explanation.trim()
    ? escapeHtml(r.explanation)
    : '<span style="color:var(--gray-500)">이 문제는 원본 해설이 제공되지 않았습니다.</span>';
  expEl.innerHTML = `<div style="font-weight:700;margin-bottom:6px">정답: ${r.answer}번</div>
                     <div style="line-height:1.6">${text}</div>`;
  btn.style.display = 'none';
}

// 재시험 — 생명보험 회차는 같은 회차 다시
function retryWrong() {
  const wrongKey = 'wrong_answers' + ((examType && examType !== '손해보험') ? '_' + examType : '');
  const wrongIds = LS.get(wrongKey, []);
  if (wrongIds.length === 0) return;

  if (examType === '생명보험' && examKey) {
    // 생명보험 회차에서 오답만 — 회차 전체 데이터를 그대로 쓰되 questionIds 필터로 처리
    LS.set('exam_session', {
      examType: '생명보험',
      examId: 'retry',
      examKey,
      retryIds: wrongIds,
      answers: {},
      startedAt: new Date().toISOString(),
      totalTime: Math.max(20, Math.ceil(wrongIds.length * 1.2)),
    });
    window.location.href = 'exam.html';
    return;
  }

  LS.set('exam_session', {
    examType: examType,
    examId: 'retry',
    questionIds: wrongIds,
    answers: {},
    startedAt: new Date().toISOString(),
    totalTime: Math.max(30, Math.ceil(wrongIds.length * 1.2)),
  });
  window.location.href = 'exam.html';
}

function retryAll() {
  if (examType === '생명보험' && examKey) {
    LS.set('exam_session', {
      examType: '생명보험',
      examId: 'real',
      examKey,
      answers: {},
      startedAt: new Date().toISOString(),
      totalTime: 50,
    });
    window.location.href = 'exam.html';
    return;
  }
  const originalIds = results.map(r => r.id);
  const totalTime = examId === 'real' ? 60 : 25;
  LS.set('exam_session', {
    examType: examType,
    examId: examId,
    questionIds: originalIds,
    answers: {},
    startedAt: new Date().toISOString(),
    totalTime,
  });
  window.location.href = 'exam.html';
}
