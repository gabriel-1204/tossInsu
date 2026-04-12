// 공통 유틸리티

const LS = {
  get: (key, fallback = null) => {
    try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback; } catch { return fallback; }
  },
  set: (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
  remove: (key) => { try { localStorage.removeItem(key); } catch {} },
};

function showToast(msg, duration = 2200) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), duration);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>');
}

// 시험 유형별 문제 배열 반환
function getQuestionsForType(examType) {
  if (examType === '생명보험' && typeof QUESTIONS_생명보험 !== 'undefined') return QUESTIONS_생명보험;
  if (examType === '변액보험' && typeof QUESTIONS_변액보험 !== 'undefined') return QUESTIONS_변액보험;
  return typeof QUESTIONS !== 'undefined' ? QUESTIONS : [];
}

// 시험 유형별 설정
const EXAM_TYPE_CONFIG = {
  '손해보험': { total: 50, time: 60, label: '손해보험', hasCategory: true },
  '생명보험': { total: 40, time: 50, label: '생명보험', hasCategory: false },
  '변액보험': { total: 40, time: 50, label: '변액보험', hasCategory: false },
};

// 시험 모드 이름
function getExamName(examId, examType) {
  if (examId === 'real') return (examType || '손해보험') + ' 실전 모의고사';
  if (examId === 'retry') return '오답 재시험';
  return '과목별 연습: ' + examId;
}
