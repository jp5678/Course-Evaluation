'use strict';
/*
 * 로컬 미리보기 서버
 * - doGet()으로 실제 템플릿(Index/Admin)을 렌더링
 * - 페이지 안에서 GAS 모의 환경 + Code.gs/Setup.gs를 실행해 google.script.run을 대체
 * - CDN(jsDelivr) 요청은 tests/node_modules의 같은 버전 파일로 응답
 * 실행: node preview-server.js [port]  →  http://127.0.0.1:8787/exec?scenario=student
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const H = require('./helpers');

const MOCK_SRC = fs.readFileSync(path.join(__dirname, 'gas-mock.js'), 'utf8');
const URL_BASE = 'https://script.google.com/macros/s/PREVIEW/exec';
const cache = {};

/** 시나리오별 초기 시트 상태(서버 수명 동안 고정) */
function scenario(name) {
  if (cache[name]) return cache[name];
  const { env, server } = H.makeServer({ pin: '123456', url: URL_BASE });
  const s = H.login(server, '123456');
  const demo = H.demoCourse(server);
  const online = server.getCourses_().find((c) => c.delivery_mode !== '대면');
  const meta = { courseId: demo.course_id, accessCode: demo.access_code, onlineCourseId: online.course_id, onlineCode: online.access_code };
  const now = Date.now();

  if (name === 'future') {
    meta.courseId = H.createCourse(server, s, { course_name: '기본간호학', start_at: H.iso(new Date(now + 86400000 * 3)), end_at: H.iso(new Date(now + 86400000 * 10)) });
  }
  if (name === 'closed') {
    meta.courseId = H.createCourse(server, s, { course_name: '기본간호학', start_at: H.iso(new Date(now - 86400000 * 10)), end_at: H.iso(new Date(now - 86400000)) });
  }
  if (name === 'tokenused' || name === 'token') {
    meta.courseId = H.createCourse(server, s, { course_name: '간호연구', access_mode: 'token', access_code: '' });
    meta.tokens = server.generateTokens(s, meta.courseId, 3).tokens;
    if (name === 'tokenused') server.submitResponse(meta.courseId, meta.tokens[0], H.fullAnswers(server.getItems_(meta.courseId)));
  }
  if (name === 'admin') {
    server.generateSampleResponses();
    // 학기 간·분반 간 비교용 자료
    const prev = server.duplicateCourse(s, demo.course_id, { year: demo.year - 1, semester: demo.semester, section: 'A', start_at: (demo.year - 1) + '-06-01T09:00', end_at: (demo.year - 1) + '-06-20T23:59' }).course_id;
    const secB = server.duplicateCourse(s, demo.course_id, { year: demo.year, semester: demo.semester, section: 'B', start_at: H.iso(new Date(now - 86400000)), end_at: H.iso(new Date(now + 86400000 * 2)) }).course_id;
    const fill = (id, n, base, cred) => {
      const items = server.getItems_(id);
      for (let i = 0; i < n; i++) {
        const a = H.fullAnswers(items, Math.max(1, Math.min(5, base + ((i * 7) % 3) - 1)));
        items.filter((it) => it.type === 'text').forEach((it, k) => { a[it.item_id] = k === 0 && i % 2 ? '실습이 도움이 되었어요 ' + i : ''; });
        server.submitResponse(id, cred, a);
      }
    };
    // 이전 학기는 기간이 지났으므로 응답 기록을 직접 추가
    const prevItems = server.getItems_(prev);
    server.withLock_(() => {
      for (let i = 0; i < 12; i++) {
        const a = H.fullAnswers(prevItems, 3 + (i % 2));
        server.appendResponse_(prev, prevItems, server.sanitizeAnswers_(prevItems, a).values, 'SAMPLE-prev-' + i);
      }
      return { ok: true };
    });
    const bCode = server.getCourses_().find((c) => c.course_id === secB).access_code;
    fill(secB, 9, 4, bCode);
    H.createCourse(server, s, { course_name: '간호관리학', access_mode: 'token', access_code: '', start_at: H.iso(new Date(now - 3600000)), end_at: H.iso(new Date(now + 3600000 * 30)) });
  }
  cache[name] = { state: H.GasMock.serialize(env.__store.read()), meta };
  return cache[name];
}

function render(query) {
  const sc = scenario(query.scenario || 'student');
  const { env, server } = H.makeServer({ setup: false, state: H.GasMock.revive(sc.state), url: URL_BASE });
  const params = Object.assign({}, query);
  if (!params.page && params.c === undefined) params.c = sc.meta.courseId;
  const out = server.doGet({ parameter: params });
  const boot = `
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<script>window.__PREVIEW=${JSON.stringify(sc.meta)};window.__GAS_STATE=${JSON.stringify(sc.state)};</script>
<script>${MOCK_SRC.replace(/<\/script/gi, '<\\/script')}</script>
<script>
(function(){
  var env = GasMock.createEnv({ state: GasMock.revive(window.__GAS_STATE), url: ${JSON.stringify(URL_BASE)}, fastSleep: true });
  var server = GasMock.loadServer(env, ${JSON.stringify(H.SOURCES).replace(/<\/script/gi, '<\\/script')});
  window.__server = server; window.__env = env;
  window.__runOpt = { latency: 60, failNext: {}, calls: [] , onCall: function(n){ window.__runOpt.calls.push(n); } };
  window.google = { script: { run: GasMock.makeRun(server, window.__runOpt) } };
})();
</script>`;
  void env;
  return out.getContent().replace(/<head>/i, '<head>' + boot);
}

const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.html': 'text/html' };

/** jsDelivr URL → 로컬 node_modules 파일 경로 */
function cdnToLocal(url) {
  const m = /^https:\/\/cdn\.jsdelivr\.net\/npm\/((?:@[^/]+\/)?[^@/]+)@[^/]+\/(.+)$/.exec(url);
  if (!m) return null;
  const p = path.join(__dirname, 'node_modules', m[1], m[2].split('?')[0]);
  return fs.existsSync(p) ? p : null;
}

function start(port) {
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/exec') {
      try {
        const html = render(Object.fromEntries(u.searchParams));
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(html);
      } catch (e) {
        res.writeHead(500); res.end(String(e.stack));
      }
      return;
    }
    res.writeHead(404); res.end('not found');
  });
  return new Promise((resolve) => srv.listen(port || 0, '127.0.0.1', () => resolve(srv)));
}

module.exports = { start, cdnToLocal, MIME };

if (require.main === module) {
  start(Number(process.argv[2]) || 8787).then((s) => console.log('preview: http://127.0.0.1:' + s.address().port + '/exec'));
}
