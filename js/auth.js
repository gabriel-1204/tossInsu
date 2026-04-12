// Supabase 인증 모듈
// TODO: Supabase 프로젝트 생성 후 아래 값을 교체하세요
const SUPABASE_URL = 'https://cwdanmoetglghgimcbtf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3ZGFubW9ldGdsZ2hnaW1jYnRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5ODcwNzgsImV4cCI6MjA5MTU2MzA3OH0.pIY7Z8vWbP0oNSsxln-yZVc-a8dyUjr8qzQx0-phZZY';

const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let _currentProfile = null;

async function initAuth({ requireAuth = true, requiredRole = null } = {}) {
  const { data: { session } } = await _supabase.auth.getSession();

  if (!session) {
    if (requireAuth) {
      window.location.href = 'login.html';
      return null;
    }
    return null;
  }

  // 프로필 조회
  const { data: profile, error } = await _supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (error || !profile) {
    showToast('프로필을 불러올 수 없습니다. 관리자에게 문의하세요.');
    await _supabase.auth.signOut();
    window.location.href = 'login.html';
    return null;
  }

  // 비활성화 계정 체크
  if (!profile.is_active) {
    await _supabase.auth.signOut();
    alert('합격을 축하합니다! 계정이 비활성화되었습니다.\n관리자에게 문의하세요.');
    window.location.href = 'login.html';
    return null;
  }

  // 역할 체크
  if (requiredRole && profile.role !== requiredRole) {
    window.location.href = profile.role === 'admin' ? 'admin.html' : 'index.html';
    return null;
  }

  _currentProfile = profile;

  // last_seen 업데이트 (fire-and-forget)
  _supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', profile.id).then(() => {});

  // 세션 만료 감시
  _supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      window.location.href = 'login.html';
    }
  });

  // 기존 gemini_api_key 정리 (Edge Function 프록시로 대체)
  LS.remove('gemini_api_key');

  return profile;
}

function getCurrentUser() {
  return _currentProfile;
}

function isAdmin() {
  return _currentProfile && _currentProfile.role === 'admin';
}

async function signOut() {
  await _supabase.auth.signOut();
  window.location.href = 'login.html';
}

// 미동기화 시험 결과를 서버에 전송
async function syncPendingResults() {
  const pending = LS.get('pending_sync', []);
  if (pending.length === 0) return;

  const synced = [];
  for (const result of pending) {
    const { error } = await _supabase.from('exam_results').insert(result);
    if (!error) synced.push(result);
  }

  if (synced.length > 0) {
    const remaining = pending.filter(p => !synced.includes(p));
    if (remaining.length === 0) {
      LS.remove('pending_sync');
    } else {
      LS.set('pending_sync', remaining);
    }
  }
}

// 시험 결과를 서버에 저장 (fire-and-forget)
function saveExamResultToServer(examResult) {
  if (!_currentProfile) return;

  const row = {
    user_id: _currentProfile.id,
    exam_type: examResult.examId,
    score: Math.round((examResult.results.filter(r => r.correct).length / examResult.results.length) * 100),
    total: examResult.results.length,
    correct: examResult.results.filter(r => r.correct).length,
    wrong_question_ids: examResult.results.filter(r => !r.correct).map(r => r.id),
    elapsed_seconds: examResult.elapsed,
    results: examResult.results.map(r => ({ questionId: r.id, userAnswer: r.userAnswer, correct: r.correct })),
  };

  _supabase.from('exam_results').insert(row).then(({ error }) => {
    if (error) {
      // 실패 시 pending_sync에 추가
      const pending = LS.get('pending_sync', []);
      pending.push(row);
      LS.set('pending_sync', pending);
      showToast('저장 실패, 다음 접속 시 재시도');
    }
  });
}

// Gemini 해설 요청 (Edge Function 프록시)
async function callGeminiProxy(prompt, context) {
  const { data: { session } } = await _supabase.auth.getSession();
  if (!session) throw new Error('인증이 필요합니다');

  const res = await fetch(`${SUPABASE_URL}/functions/v1/gemini-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ prompt, context }),
  });

  if (res.status === 401) throw new Error('인증이 만료되었습니다. 다시 로그인해주세요.');
  if (res.status === 403) throw new Error('API 키가 설정되지 않았습니다. 관리자에게 문의하세요.');
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `서버 오류 (${res.status})`);
  }

  const data = await res.json();
  return data.text;
}
