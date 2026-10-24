'use strict';
process.env.TZ = 'Asia/Seoul';
const fs = require('fs');
const path = require('path');
const GasMock = require('./gas-mock');

const ROOT = path.join(__dirname, '..');
// CES_BUNDLE=1 이면 정식 설치 파일(dist/CourseEvaluationStudio.gs) 하나로 같은 테스트를 실행
const SOURCES = process.env.CES_BUNDLE
  ? [fs.readFileSync(path.join(ROOT, 'dist', 'CourseEvaluationStudio.gs'), 'utf8')]
  : ['Code.gs', 'Setup.gs'].map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8'));
const readFile = (name) => fs.readFileSync(path.join(ROOT, name), 'utf8');

/** 새 모의 환경 + 서버 로드 (+ 선택: setup·PIN) */
function makeServer(opts = {}) {
  const writeLog = [];
  const quiet = { log() {}, info() {}, warn: console.warn, error: console.error };
  const env = GasMock.createEnv(Object.assign({ readFile, writeLog, fastSleep: true, console: quiet }, opts));
  const server = GasMock.loadServer(env, SOURCES);
  if (opts.setup !== false) server.setup();
  if (opts.pin) server.storePin_(opts.pin);
  return { env, server, writeLog };
}

function login(server, pin = '123456') {
  const r = server.adminLogin(pin);
  if (!r.ok) throw new Error('login failed: ' + JSON.stringify(r));
  return r.session;
}

function table(env, name) {
  const sh = env.__store.read().sheets[name];
  const rows = sh.values.filter((r) => r && r.some((v) => v !== '' && v != null));
  const headers = rows[0];
  return rows.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] === undefined ? '' : r[i]])));
}

function demoCourse(server) {
  return server.getCourses_().find((c) => c.course_id.startsWith('demo'));
}

/** 모든 필수 문항을 채운 정상 응답 */
function fullAnswers(items, likert = 4) {
  const a = {};
  items.forEach((it) => {
    if (it.type === 'likert5') a[it.item_id] = likert;
    else if (it.type === 'text') a[it.item_id] = '좋았습니다';
    else if (it.type === 'single' || it.type === 'select') a[it.item_id] = it.options[0];
    else if (it.type === 'multi') a[it.item_id] = [it.options[0]];
  });
  return a;
}

function iso(d) {
  return GasMock.formatDate(d, 'Asia/Seoul', "yyyy-MM-dd'T'HH:mm");
}

/** 과거/미래 기간의 교과목 생성 */
let codeSeq = 0;
function createCourse(server, session, overrides = {}) {
  const now = Date.now();
  codeSeq += 1; // 접속코드는 교과목마다 달라야 함
  const data = Object.assign({
    course_name: '테스트 교과목', year: 2026, semester: '2', grade: 3, section: 'A', enrollment: 40,
    department: '간호학과', delivery_mode: '대면',
    start_at: iso(new Date(now - 86400000)), end_at: iso(new Date(now + 86400000 * 7)),
    access_mode: 'code', access_code: 'ABC' + String(100 + codeSeq), result_open_date: ''
  }, overrides);
  const r = server.saveCourse(session, data);
  if (!r.ok) throw new Error('saveCourse failed: ' + JSON.stringify(r));
  return r.course_id;
}

/** 교과목의 접속코드(교과목마다 다름) */
function codeOf(server, courseId) {
  return server.findCourse_(courseId).access_code;
}

module.exports = { codeOf, GasMock, ROOT, SOURCES, readFile, makeServer, login, table, demoCourse, fullAnswers, iso, createCourse };
