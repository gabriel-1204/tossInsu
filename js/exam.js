// 시험 진행 로직

// 인증 초기화 (비동기, 시험 진행은 차단하지 않음)
initAuth({ requiredRole: 'agent' });

const session = LS.get('exam_session');
if (!session || !session.questionIds || session.questionIds.length === 0) {
  window.location.href = 'index.html';
}

const qMap = {};
const _examQuestions = getQuestionsForType(session.examType || '손해보험');
_examQuestions.forEach(q => { qMap[q.id] = q; });

const questions = session.questionIds.map(id => qMap[id]).filter(Boolean);

// 답변 상태 (questionId → 선택한 번호 1-4)
let answers = { ...session.answers };

// 타이머 (세션에 저장된 시간 사용, 기본 60분)
const TOTAL_SECONDS = (session.totalTime || 60) * 60;
let elapsed = 0;
if (session.startedAt) {
  elapsed = Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000);
  elapsed = Math.min(elapsed, TOTAL_SECONDS);
}
let remaining = TOTAL_SECONDS - elapsed;
let timerInterval = null;

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
  // 실전 모의고사일 때 과목 구분 라벨 (손해1~17, 공통18~33, 제3보험34~50)
  const isReal = session.examId === 'real';
  let prevSection = '';

  questions.forEach((q, idx) => {
    if (isReal) {
      let section = '';
      if (idx < 17) section = '손해보험';
      else if (idx < 33) section = '공통';
      else section = '제3보험';
      if (section !== prevSection) {
        html += `<div style="margin:24px 0 8px;font-size:13px;font-weight:700;color:var(--blue);padding-left:4px">${section} (${idx + 1}번~)</div>`;
        prevSection = section;
      }
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
  document.getElementById('headerTitle').textContent = getExamName(session.examId);
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

  // 채점
  const results = questions.map((q, idx) => ({
    id: q.id,
    category: q.category,
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
renderQuestions();
startTimer();
