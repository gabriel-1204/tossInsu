// 시험 진행 로직

// 인증 초기화 (비동기, 시험 진행은 차단하지 않음)
initAuth({ requiredRole: 'agent' });

const session = LS.get('exam_session');
if (!session) {
  window.location.href = 'index.html';
}

let questions = [];
let examMeta = null;  // 생명보험 회차 단위 시험의 경우 sections 등 메타정보

// 답변 상태 (questionId → 선택한 번호 1-4)
let answers = { ...(session && session.answers) };

// 타이머
const TOTAL_SECONDS = ((session && session.totalTime) || 60) * 60;
let elapsed = 0;
if (session && session.startedAt) {
  elapsed = Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000);
  elapsed = Math.min(elapsed, TOTAL_SECONDS);
}
let remaining = TOTAL_SECONDS - elapsed;
let timerInterval = null;

async function loadQuestions() {
  if (session.examType === '생명보험' && session.examKey) {
    examMeta = await loadExamData('생명보험', session.examKey);
    questions = examMeta.questions.slice();
    // 오답 재시험: retryIds로 필터
    if (session.examId === 'retry' && Array.isArray(session.retryIds)) {
      const retrySet = new Set(session.retryIds);
      questions = questions.filter(q => retrySet.has(q.id));
    }
  } else {
    if (!session.questionIds || !session.questionIds.length) {
      window.location.href = 'index.html';
      return;
    }
    const qMap = {};
    const pool = getQuestionsForType(session.examType || '손해보험');
    pool.forEach(q => { qMap[q.id] = q; });
    questions = session.questionIds.map(id => qMap[id]).filter(Boolean);
  }
}

function startTimer() {
  updateTimerUI();
  timerInterval = setInterval(() => {
    remaining--;
    updateTimerUI();
    if (remaining <= 0) {
      clearInterval(timerInterval);
      autoSubmit();
    }
    // 세션에 저장 (10초마다)
    if (remaining % 10 === 0) saveSession();
  }, 1000);
}

function updateTimerUI() {
  const bar = document.getElementById('timerBar');
  bar.textContent = formatTime(Math.max(0, remaining));
  bar.className = 'timer-bar';
  if (remaining <= 300) bar.classList.add('danger');
  else if (remaining <= 600) bar.classList.add('warning');
}

function autoSubmit() {
  showToast('시간이 종료되었습니다. 자동 제출합니다.');
  setTimeout(finishExam, 1800);
}

// 문제 렌더링
function renderQuestions() {
  const container = document.getElementById('questionsContainer');
  let html = '';
  const isRealSonhae = session.examId === 'real' && (!session.examType || session.examType === '손해보험');
  const isLifeRound = session.examType === '생명보험' && session.examKey && examMeta && examMeta.sections;
  let prevSection = '';

  questions.forEach((q, idx) => {
    if (isRealSonhae) {
      let section = '';
      if (idx < 17) section = '손해보험';
      else if (idx < 33) section = '공통';
      else section = '제3보험';
      if (section !== prevSection) {
        html += `<div style="margin:24px 0 8px;font-size:13px;font-weight:700;color:var(--blue);padding-left:4px">${section} (${idx + 1}번~)</div>`;
        prevSection = section;
      }
    } else if (isLifeRound && q.section && q.section !== prevSection) {
      html += `<div style="margin:24px 0 8px;font-size:13px;font-weight:700;color:var(--blue);padding-left:4px">${escapeHtml(q.section)} (${idx + 1}번~)</div>`;
      prevSection = q.section;
    }
    html += `
      <div class="card question-card" id="qcard-${q.id}">
        <div class="question-num">${idx + 1}번</div>
        <div class="question-text">${escapeHtml(q.question)}</div>
        <div class="options">
          ${q.options.map((opt, oi) => `
            <div class="option ${answers[q.id] === oi + 1 ? 'selected' : ''}"
                 onclick="selectAnswer(${q.id}, ${oi + 1})">
              <span class="option-num">${oi + 1}</span>
              <span>${escapeHtml(opt)}</span>
            </div>
          `).join('')}
        </div>
      </div>`;
  });
  container.innerHTML = html;
  updateProgress();
}

function selectAnswer(qId, optNum) {
  answers[qId] = optNum;
  // 해당 문제 카드 옵션 UI 갱신
  const card = document.getElementById('qcard-' + qId);
  card.querySelectorAll('.option').forEach((el, i) => {
    el.classList.toggle('selected', i + 1 === optNum);
  });
  updateProgress();
  saveSession();
}

function updateProgress() {
  const answered = questions.filter(q => answers[q.id] !== undefined).length;
  const total = questions.length;
  const pct = total ? Math.round((answered / total) * 100) : 0;
  document.getElementById('progressText').textContent = `${answered} / ${total} 답변`;
  document.getElementById('progressPct').textContent = `${pct}%`;
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('answeredCount').textContent = `${answered}/${total}`;
  const title = examMeta ? examMeta.title : null;
  document.getElementById('headerTitle').textContent = getExamName(session.examId, session.examType, title);
}

function saveSession() {
  LS.set('exam_session', { ...session, answers });
}

function submitExam() {
  const unanswered = questions.filter(q => answers[q.id] === undefined).length;
  if (unanswered > 0) {
    const ok = confirm(`아직 ${unanswered}문항에 답하지 않았습니다.\n그래도 제출하시겠습니까?`);
    if (!ok) return;
  }
  finishExam();
}

function finishExam() {
  clearInterval(timerInterval);
  const elapsed = TOTAL_SECONDS - remaining;

  // 채점 — 회차 단위 시험은 explanation/section/points까지 결과에 보존
  const results = questions.map((q, idx) => ({
    id: q.id,
    category: q.category,
    section: q.section,
    points: q.points,
    explanation: q.explanation,
    idx,
    question: q.question,
    options: q.options,
    answer: q.answer,
    userAnswer: answers[q.id] || 0,
    correct: (answers[q.id] || 0) === q.answer,
  }));

  const wrongIds = results.filter(r => !r.correct).map(r => r.id);
  const wrongKey = 'wrong_answers' + ((session.examType && session.examType !== '손해보험') ? '_' + session.examType : '');
  LS.set(wrongKey, wrongIds);
  LS.set('last_result', {
    examId: session.examId,
    examType: session.examType || '손해보험',
    examKey: session.examKey || null,
    examTitle: examMeta ? examMeta.title : null,
    sections: examMeta ? examMeta.sections : null,
    results,
    elapsed,
    finishedAt: new Date().toISOString(),
  });
  LS.remove('exam_session');

  // 서버 저장 (fire-and-forget)
  const lastResult = LS.get('last_result');
  if (lastResult) saveExamResultToServer(lastResult);

  window.location.href = 'result.html';
}

function confirmLeave() {
  return confirm('시험을 중단하고 나가시겠습니까?\n현재까지의 답변은 저장됩니다.');
}

// 초기화
(async () => {
  await loadQuestions();
  if (!questions.length) {
    window.location.href = 'index.html';
    return;
  }
  renderQuestions();
  startTimer();
})();
