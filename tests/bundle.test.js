'use strict';
/* 정식 설치 파일(단일 .gs) 검증: 파일 접근 없이 동작하고, 원본 다중 파일과 같은 화면을 렌더링 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const GasMock = require('./gas-mock');
const H = require('./helpers');

const ROOT = path.join(__dirname, '..');
execFileSync(process.execPath, [path.join(ROOT, 'tools', 'build-installer.js')]);
const BUNDLE = fs.readFileSync(path.join(ROOT, 'dist', 'CourseEvaluationStudio.gs'), 'utf8');
const quiet = { log() {}, info() {}, warn: console.warn, error: console.error };

function bundleServer() {
  const env = GasMock.createEnv({
    fastSleep: true, console: quiet,
    readFile: (n) => { throw new Error('설치 파일은 다른 파일을 읽으면 안 됩니다: ' + n); }
  });
  const server = GasMock.loadServer(env, [BUNDLE]);
  server.setup();
  return { env, server };
}

test('설치 파일: 단일 파일로 setup 완료(파일 접근 없음), 메뉴 함수·버전 포함', () => {
  const { server } = bundleServer();
  assert.equal(server.getCourses_().length, 2);
  assert.equal(server.getItems_('TEMPLATE').length, 27);
  for (const fn of ['doGet', 'onOpen', 'setup', 'setAdminPinFromMenu', 'showWebAppUrl', 'generateSampleResponses', 'deleteSampleData']) {
    assert.equal(typeof server[fn], 'function', fn);
  }
  // 독립형 설치 설정(CES_SHEET_ID·CES_NEW_PIN)은 긴 HTML 데이터보다 앞, 파일 맨 위에 한 번만
  const cfg = BUNDLE.indexOf("var CES_SHEET_ID = '';"), files = BUNDLE.indexOf('var __FILES__');
  assert.ok(cfg > 0 && cfg < files, '설정 블록이 맨 위');
  assert.equal(BUNDLE.split('var CES_SHEET_ID').length, 2, '설정은 한 번만');
  assert.ok(BUNDLE.indexOf("var CES_NEW_PIN = '';") < files);
  assert.match(BUNDLE, new RegExp('강의평가 Studio v' + server.APP.VERSION.replace(/\./g, '\\.')));
  assert.equal(server.tz_(), 'Asia/Seoul', '프로젝트 시간대와 무관하게 한국 시간');
});

test('설치 파일: 학생·교수 화면 HTML이 원본 다중 파일과 한 글자도 다르지 않음', () => {
  const a = H.makeServer().server;         // 원본(Code.gs + Setup.gs + *.html)
  const b = bundleServer().server;         // 설치 파일
  for (const params of [{ c: 'cabc1234' }, { c: '', t: 'ABCD-EFGH' }, { page: 'admin' }]) {
    assert.equal(b.doGet({ parameter: params }).getContent(), a.doGet({ parameter: params }).getContent(), JSON.stringify(params));
  }
});

test('내려받기용 dist/Code.gs는 설치 파일과 같은 내용', () => {
  assert.equal(fs.readFileSync(path.join(ROOT, 'dist', 'Code.gs'), 'utf8'), BUNDLE);
});

test('설치 파일: 응답 제출 → 결과 분석 흐름', () => {
  const { server } = bundleServer();
  server.storePin_('123456');
  const s = server.adminLogin('123456').session;
  const c = server.getCourses_()[0];
  const items = server.itemsForCourse_(c);
  for (let i = 0; i < 5; i++) assert.equal(server.submitResponse(c.course_id, c.access_code, H.fullAnswers(items)).ok, true);
  const r = server.getResults(s, c.course_id);
  assert.equal(r.locked, false);
  assert.equal(r.n, 5);
  assert.equal(r.stats.overall, 4);
});
