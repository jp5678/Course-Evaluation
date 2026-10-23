'use strict';
/*
 * 체험판(GitHub Pages) 빌드
 *   node tools/build-demo.js
 * 산출물
 *   index.html            체험판 첫 화면(Pages 루트)
 *   demo/student.html     학생 화면(Student.html 템플릿을 doGet으로 렌더링)
 *   demo/admin.html       교수 화면(Admin.html 템플릿을 doGet으로 렌더링)
 *   demo/demo-boot.js     GAS 모의 환경 + Code.gs/Setup.gs (브라우저에서 실행, localStorage 저장)
 * 실제 운영은 Google Apps Script 배포가 필요합니다. 이 체험판은 화면과 흐름을 보여 주기 위한 것입니다.
 */
const fs = require('fs');
const path = require('path');
const GasMock = require('../tests/gas-mock');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'demo');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const SOURCES = ['Code.gs', 'Setup.gs'].map(read);
const REPO = 'https://github.com/jp5678/Course-Evaluation';

// 템플릿 렌더링용 서버(기본 설정값으로 푸터 채움)
const quiet = { log() {}, info() {}, warn: console.warn, error: console.error };
const env = GasMock.createEnv({ readFile: read, fastSleep: true, console: quiet });
const server = GasMock.loadServer(env, SOURCES);
server.setup();
const settings = server.getSettingsMap_();

const DEMO_CSS = `<style>
.demo-bar{background:var(--ink);color:var(--bg);font-size:.8125rem;padding:8px 16px;display:flex;gap:10px 16px;flex-wrap:wrap;align-items:center;justify-content:center;text-align:center}
.demo-bar a,.demo-bar button{color:var(--bg);font:inherit;font-weight:700;background:none;border:0;padding:4px 2px;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
.demo-bar .k{background:var(--butter);color:#18181B;border-radius:6px;padding:1px 8px;font-weight:700;letter-spacing:.06em}
</style>`;

function demoPage(templateParams, kind) {
  const html = server.doGet({ parameter: templateParams }).getContent();
  const head = `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>강의평가 Studio · ${kind === 'admin' ? '교수 화면' : '학생 화면'} 체험</title>
<meta name="robots" content="noindex">
${DEMO_CSS}
<script src="demo-boot.js"></script>`;
  const bar = `<div class="demo-bar" role="note">🧪 체험용 데모 · 데이터는 이 브라우저에만 저장됩니다
  <span id="demo-hint"></span><a href="../index.html">체험 처음으로</a><button type="button" onclick="DemoBoot.reset()">초기화</button></div>
<script>DemoBoot.applyBody('${kind}')</script>`;
  return html
    .replace(/<head>/i, '<head>\n' + head)
    .replace(/(<body[^>]*>)/i, '$1\n' + bar);
}

const boot = `/* 강의평가 Studio 체험판 부트 — tools/build-demo.js로 생성(직접 수정하지 마세요) */
${fs.readFileSync(path.join(ROOT, 'tests', 'gas-mock.js'), 'utf8')}
;(function () {
  'use strict';
  var SOURCES = ${JSON.stringify(SOURCES)};
  var KEY = 'ces-demo-state-v1', CKEY = 'ces-demo-cache-v1', PIN = '123456';
  var ls = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 저장 불가 시 이번 방문 동안만 유지 */ } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* 무시 */ } }
  };
  var base = new URL(window.DEMO_BASE || './', location.href).href;
  var saved = ls.get(KEY);
  var store = GasMock.memoryStore(saved ? GasMock.revive(saved) : undefined);
  var write = store.write, timer = null;
  var persist = function () { ls.set(KEY, GasMock.serialize(store.read())); };
  store.write = function (s) { write(s); clearTimeout(timer); timer = setTimeout(persist, 30); };
  var readCache = function () { try { return JSON.parse(ls.get(CKEY)) || {}; } catch (e) { return {}; } };
  var cache = {
    get: function (k) { var o = readCache()[k]; return o && o.exp > Date.now() ? o.v : null; },
    put: function (k, v, ttl) { var o = readCache(); o[k] = { v: String(v), exp: Date.now() + (ttl || 600) * 1000 }; ls.set(CKEY, JSON.stringify(o)); },
    remove: function (k) { var o = readCache(); delete o[k]; ls.set(CKEY, JSON.stringify(o)); }
  };
  var env = GasMock.createEnv({ store: store, cache: cache, url: base + 'student.html', fastSleep: true,
    console: { log: function () {}, info: function () {}, warn: console.warn, error: console.error } });
  var server = GasMock.loadServer(env, SOURCES);
  if (!saved) {
    server.setup();
    server.storePin_(PIN);
    server.generateSampleResponses(); // 예시 교과목마다 30건
    persist();
  }
  window.__server = server;
  window.google = { script: { run: GasMock.makeRun(server, { latency: 120 }) } };

  function openCourses() {
    var now = new Date();
    return server.getCourses_().filter(function (c) { return server.effectiveStatus_(c, now) === '진행'; });
  }

  window.DemoBoot = {
    PIN: PIN,
    courses: function () {
      return openCourses().map(function (c) {
        return { course_id: c.course_id, course_name: c.course_name, grade: c.grade, section: c.section,
          delivery_mode: c.delivery_mode, course_type: c.course_type, access_code: c.access_code,
          items: server.itemsForCourse_(c).length };
      });
    },
    studentUrl: function (id) { return base + 'student.html?c=' + encodeURIComponent(id); },
    adminUrl: function () { return base + 'admin.html'; },
    /** 페이지 본문 시작 직후 실행: 쿼리 파라미터를 템플릿 값(data-*)으로 옮깁니다. */
    applyBody: function (kind) {
      var q = new URLSearchParams(location.search);
      var hint = document.getElementById('demo-hint');
      if (kind === 'admin') {
        if (hint) hint.innerHTML = '관리자 PIN <span class="k">' + PIN + '</span>';
        return;
      }
      if (q.get('page') === 'admin') { location.replace(base + 'admin.html'); return; }
      var c = (q.get('c') || '').replace(/[^A-Za-z0-9_-]/g, '');
      if (!c) { var first = openCourses()[0]; c = first ? first.course_id : ''; }
      document.body.setAttribute('data-course', c);
      document.body.setAttribute('data-token', (q.get('t') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16));
      var course = server.findCourse_(c);
      if (hint && course) {
        hint.innerHTML = course.access_mode === 'token' ? '토큰 방식 교과목'
          : '접속코드 <span class="k">' + (course.access_code || '없음') + '</span>';
      }
    },
    reset: function () {
      if (!window.confirm('체험 데이터를 처음 상태로 되돌릴까요? (이 브라우저에 저장된 응답·설정이 지워집니다)')) return;
      ls.del(KEY); ls.del(CKEY);
      try { Object.keys(sessionStorage).forEach(function (k) { if (k.indexOf('ces:') === 0) sessionStorage.removeItem(k); }); } catch (e) { /* 무시 */ }
      try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf('ces:') === 0) localStorage.removeItem(k); }); } catch (e) { /* 무시 */ }
      location.reload();
    }
  };
})();
`;

const styles = read('Styles.html');
const landing = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<title>강의평가 Studio · 체험판</title>
<meta name="description" content="간호학과 교수자 자율형 강의평가(CQI) 웹 앱 — Google Apps Script 기반. 브라우저에서 바로 체험해 보세요.">
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css">
${styles}
${DEMO_CSS}
<script>window.DEMO_BASE = 'demo/';</script>
<script src="demo/demo-boot.js"></script>
</head>
<body class="page-student">
<div class="deco" aria-hidden="true"><span class="s1"></span><span class="s2"></span><span class="s3"></span><span class="s4"></span></div>
<header class="topbar"><div class="topbar-inner">
  <div class="brand"><span class="brand-mark"><i data-lucide="clipboard-check" aria-hidden="true"></i></span><span>강의평가 Studio<small>체험판</small></span></div>
  <div class="grow"></div>
  <a class="btn ghost sm" href="${REPO}#설치-가이드-교수용--약-15분">설치 가이드</a>
</div></header>
<main id="main" class="wrap medium" tabindex="-1">
  <section class="card pad-lg stack-lg rise" aria-labelledby="t">
    <div class="meta"><span class="badge open">간호학과 교수자용</span><span class="badge">형성평가 · CQI</span><span class="badge">Google Apps Script</span></div>
    <div><h1 id="t">강의평가 Studio 체험하기</h1>
      <p class="muted" style="margin-top:8px">교수가 학기말 강의평가를 직접 운영하는 웹 앱입니다. 아래에서 <strong>학생 응답 화면</strong>과 <strong>교수 결과 대시보드</strong>를 바로 체험해 보세요.</p></div>
    <div class="callout info"><i data-lucide="info" aria-hidden="true"></i><p class="small">이 체험판은 서버 없이 <strong>브라우저 안에서</strong> 동작하며, 응답·설정은 <strong>이 브라우저에만</strong> 저장됩니다. 예시 교과목마다 가상 응답 30건이 미리 들어 있습니다. 실제 수업에서 쓰려면 <a href="${REPO}#설치-가이드-교수용--약-15분">설치 가이드</a>대로 Google 스프레드시트에 설치하세요.</p></div>
  </section>

  <div class="bento" style="margin-top:16px">
    <section class="card span-2 rise" style="--i:1" aria-labelledby="s1">
      <div class="card-title" id="s1"><i data-lucide="smartphone" aria-hidden="true"></i>학생 화면 체험</div>
      <p class="small muted" style="margin:8px 0 12px">휴대폰으로 열면 실제 학생이 보는 화면 그대로입니다. 접속코드를 입력하고 응답해 보세요.</p>
      <div id="course-list" class="stack"></div>
    </section>
    <section class="card soft span-2 rise" style="--i:2" aria-labelledby="s2">
      <div class="card-title" id="s2"><i data-lucide="layout-dashboard" aria-hidden="true"></i>교수 화면 체험</div>
      <p class="small" style="margin:8px 0 12px">대시보드, 결과 한눈에 보기, 워드 클라우드, 문항 편집, 토큰 인쇄 시트를 볼 수 있습니다.</p>
      <p style="margin-bottom:14px">관리자 PIN <span class="kbd num" style="font-size:1rem;padding:2px 10px">123456</span></p>
      <a class="btn primary block" id="admin-link" href="demo/admin.html"><i data-lucide="log-in" aria-hidden="true"></i>교수 화면 열기</a>
    </section>
  </div>
  <p class="center small" style="margin-top:20px"><button type="button" class="btn ghost sm" onclick="DemoBoot.reset()"><i data-lucide="rotate-ccw" aria-hidden="true"></i>체험 데이터 초기화</button></p>
</main>
<footer class="footer">
  <div class="owner">${settings.professor_name} · ${settings.affiliation}</div>
  <div class="credit">Developed by 정종필 교수 · 청암대학교 간호학과</div>
  <p class="disclaimer">강의평가 Studio는 학교 공식 강의평가를 대체하지 않는 교수자 자율형 형성평가·CQI(지속적 질 개선)용 설문 도구입니다.</p>
</footer>
<script src="https://cdn.jsdelivr.net/npm/lucide@0.460.0/dist/umd/lucide.min.js" defer onload="lucide.createIcons()"></script>
<script>
(function () {
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var list = document.getElementById('course-list');
  var cs = DemoBoot.courses();
  list.innerHTML = cs.length ? cs.map(function (c) {
    return '<div class="card" style="box-shadow:none;padding:16px"><div class="row-between"><div style="min-width:0"><strong>' + esc(c.course_name) + '</strong>' +
      '<div class="tiny muted">' + esc(c.grade + '학년 ' + c.section + '반 · ' + c.course_type + ' · ' + c.delivery_mode + ' · ' + c.items + '문항') + '</div>' +
      '<div class="small" style="margin-top:6px">접속코드 <span class="kbd num">' + esc(c.access_code) + '</span></div></div>' +
      '<a class="btn primary sm" href="' + esc(DemoBoot.studentUrl(c.course_id)) + '">응답해 보기</a></div></div>';
  }).join('') : '<p class="small muted">응답 기간인 교과목이 없습니다. 아래 [체험 데이터 초기화]를 눌러 주세요.</p>';
})();
</script>
</body>
</html>
`;

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'demo-boot.js'), boot);
fs.writeFileSync(path.join(OUT, 'student.html'), demoPage({ c: '' }, 'student'));
fs.writeFileSync(path.join(OUT, 'admin.html'), demoPage({ page: 'admin' }, 'admin'));
fs.writeFileSync(path.join(ROOT, 'index.html'), landing);
fs.writeFileSync(path.join(ROOT, '.nojekyll'), '');
console.log('체험판 빌드 완료: index.html, demo/student.html, demo/admin.html, demo/demo-boot.js');
