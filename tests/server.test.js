'use strict';
/* 서버 로직 통합 테스트 (node --test) */
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./helpers');

const PIN = '246810';

test('setup: 탭·헤더·기본 문항 은행·이번 학기 교과목 예시 3개·시트 보호(재실행해도 중복 없음)', () => {
  const { env, server } = H.makeServer();
  const st = env.__store.read();
  for (const name of ['Settings', 'Courses', 'Items', 'Tokens', 'Responses']) {
    assert.ok(st.sheets[name], name + ' 탭');
    assert.deepEqual(st.sheets[name].values[0].slice(0, server.HEADERS[name].length), server.HEADERS[name]);
  }
  const tpl = server.getItems_('TEMPLATE');
  assert.equal(tpl.length, 27, '리커트 24(F 영역 5개) + 서술형 3');
  const doms = [...new Set(tpl.map((i) => i.domain))];
  assert.deepEqual(doms, ['A. 강의 설계', 'B. 교수학습방법', 'C. 평가 및 과제', 'E. 학습 환경', 'F. 디지털·AI 활용', 'G. 종합', 'H. 온라인(비대면) 강의', '서술형']);
  assert.ok(tpl.some((i) => /유무선 인터넷/.test(i.text)) && tpl.some((i) => /실습실의 시설/.test(i.text)) && tpl.some((i) => /이론 강의실/.test(i.text)), '학습 환경 문항');
  assert.equal(tpl.filter((i) => i.scope === 'online').length, 4, '온라인 전용 문항 4개');
  assert.match(tpl.find((i) => i.scope === 'theory').text, /^이론 강의실/);
  assert.match(tpl.find((i) => i.scope === 'practice').text, /^실습실의 시설/);
  assert.equal(tpl.find((i) => /유무선 인터넷/.test(i.text)).scope, '', '인터넷 문항은 항상 표시');
  assert.equal(tpl.some((i) => i.type === 'select' || /성별/.test(i.text)), false, '응답자 정보(성별) 문항 없음');
  assert.ok(tpl.every((i) => i.required === true), '모든 문항 필수(서술형·성별 포함)');

  const s = server.getSettingsMap_();
  assert.equal(s.professor_name, '정종필');
  assert.equal(s.affiliation, '청암대학교 간호학과');
  const cs = server.getCourses_();
  assert.deepEqual(cs.map((c) => [c.course_name, c.grade, c.section, c.department, c.delivery_mode]),
    [['디지털리터러시와 AI활용', '1', '', '간호학과', '대면'], ['AI융합 간호정보학', '3', '', '간호학과', '혼합'],
     ['AI융합 간호정보학(전공심화과정)', '4', '', '간호학과', '온라인(비대면)']]);
  assert.ok(cs.every((c) => c.enrollment === 0), '수강인원 미입력');
  assert.ok(cs.every((c) => c.course_type === '이론+실습'), '예시 교과목 유형');
  assert.deepEqual(cs.map((c) => [c.year, c.semester]), [[2026, '1'], [2026, '2'], [2026, '2']], '디지털리터러시와 AI활용=1학기, 나머지=이번 학기(2학기)');
  assert.ok(cs.every((c) => server.itemsForCourse_(c).every((i) => i.required)), '예시 교과목 문항도 모두 필수');
  assert.equal(cs[0].course_name, '디지털리터러시와 AI활용');
  assert.equal(cs[0].delivery_mode, '대면', '디지털리터러시와 AI활용은 대면으로 초기 설정');
  assert.equal(server.itemsForCourse_(cs[0]).length, 28, '대면: 온라인 문항 제외 + CLO 5');
  assert.equal(server.itemsForCourse_(cs[1]).length, 32, '혼합: 온라인 문항 포함 + CLO 5');
  assert.equal(st.sheets.Responses.protections[0].warningOnly, true, 'Responses 경고 보호');
  assert.equal(st.sheets.Tokens.protections[0].warningOnly, true, 'Tokens 경고 보호');

  server.setup();
  assert.equal(server.getItems_('TEMPLATE').length, 27, '재실행 시 문항 중복 없음');
  assert.equal(server.getCourses_().length, 3, '재실행 시 교과목 중복 없음');
});

test('이전 버전 시트: setup이 빠진 열(학과·수업 방식·교과목 유형·표시 조건)을 끝에 추가', () => {
  const { env, server } = H.makeServer({ setup: false });
  const ss = env.SpreadsheetApp.getActiveSpreadsheet();
  const old = server.HEADERS.Courses.slice(0, 13);
  ss.insertSheet('Courses').getRange(1, 1, 1, old.length).setValues([old]);
  server.setup();
  const hdr = env.__store.read().sheets.Courses.values[0];
  assert.deepEqual(hdr.slice(0, server.HEADERS.Courses.length), server.HEADERS.Courses);
});

test('PIN: 해시(SHA-256+salt) 저장, 5회 실패 시 10분 잠금, 잠금 중 올바른 PIN도 거부', () => {
  const { server } = H.makeServer({ pin: PIN });
  const s = server.getSettingsMap_();
  assert.match(String(s.pin_hash), /^[0-9a-f]{64}$/);
  assert.notEqual(String(s.pin_hash), PIN);
  assert.equal(server.adminLogin('000000').code, 'WRONG');
  for (let i = 2; i <= 4; i++) assert.equal(server.adminLogin('000000').left, 5 - i);
  const fifth = server.adminLogin('000000');
  assert.equal(fifth.code, 'LOCKED');
  assert.equal(fifth.remainSec, 600);
  assert.equal(server.adminLogin(PIN).code, 'LOCKED', '잠금 중에는 올바른 PIN도 거부');
  server.storePin_(PIN); // 메뉴 재설정 = 잠금 해제 경로
  assert.equal(server.adminLogin(PIN).ok, true);
});

test('관리자 API: 세션 없거나 위조·PIN 변경 후 이전 세션은 AUTH', () => {
  const { server } = H.makeServer({ pin: PIN });
  assert.equal(server.getAdminBootstrap('').code, 'AUTH');
  assert.equal(server.getAdminBootstrap('a'.repeat(64)).code, 'AUTH');
  const s = H.login(server, PIN);
  assert.equal(server.getAdminBootstrap(s).ok, true);
  assert.equal(server.changePin(s, PIN, '13579135').ok, true);
  assert.equal(server.getAdminBootstrap(s).code, 'AUTH', 'PIN 변경 시 기존 세션 무효화');
});

test('학생: 접속코드 확인 → 제출, 날짜만 저장(시각·식별정보 없음)', () => {
  const { env, server } = H.makeServer({ pin: PIN });
  const c = H.demoCourse(server);
  const info = server.getCourseForStudent(c.course_id);
  assert.equal(info.ok, true);
  assert.equal(info.state, '진행');
  assert.equal(info.course.has_code, true);
  assert.equal(info.course.access_code, undefined, '접속코드는 학생에게 노출하지 않음');
  assert.equal(server.verifyAccess(c.course_id, 'WRONG').code, 'BAD_CODE');
  const v = server.verifyAccess(c.course_id, c.access_code.toLowerCase());
  assert.equal(v.ok, true, '대소문자 무시');
  assert.equal(v.items.length, 28);

  const r = server.submitResponse(c.course_id, c.access_code, H.fullAnswers(v.items), 'nonce-aaaaaaaaaaaaaaaa');
  assert.equal(r.ok, true);
  const rows = H.table(env, 'Responses');
  assert.equal(rows.length, 1);
  assert.match(String(rows[0].submitted_date), /^\d{4}-\d{2}-\d{2}$/, '날짜만(시각 없음)');
  assert.match(rows[0].response_id, /^[0-9a-f-]{36}$/, 'UUID');
  const headers = env.__store.read().sheets.Responses.values[0];
  assert.deepEqual(headers.slice(0, 3), ['response_id', 'course_id', 'submitted_date']);
  assert.ok(headers.slice(3).every((h) => /^i[a-z0-9]{7}$/.test(h)), '나머지 열은 문항 ID뿐(학번·이름·IP·UA 열 없음)');
});

test('입력 검증: 필수 누락·범위 밖 값·서술형 1,000자 제한·수식 주입 방지', () => {
  const { env, server, writeLog } = H.makeServer({ pin: PIN });
  const c = H.demoCourse(server);
  const items = server.getItems_(c.course_id);
  const likert = items.filter((i) => i.type === 'likert5');
  const texts = items.filter((i) => i.type === 'text');

  const a = H.fullAnswers(items);
  delete a[likert[0].item_id];
  let r = server.submitResponse(c.course_id, c.access_code, a);
  assert.equal(r.code, 'MISSING');
  assert.deepEqual(r.missing, [likert[0].item_id]);

  const b = H.fullAnswers(items);
  b[likert[1].item_id] = 7;
  b[likert[2].item_id] = '3; DROP';
  r = server.submitResponse(c.course_id, c.access_code, b);
  assert.equal(r.code, 'MISSING', '1~5 정수가 아니면 무효');

  const ok = H.fullAnswers(items);
  ok[texts[0].item_id] = '가'.repeat(1500);
  ok[texts[1].item_id] = '=HYPERLINK("http://evil","x")';
  ok[texts[2].item_id] = '@SUM(A1)';
  r = server.submitResponse(c.course_id, c.access_code, ok);
  assert.equal(r.ok, true);
  const row = H.table(env, 'Responses')[0];
  assert.equal(String(row[texts[0].item_id]).length, 1000, '1,000자 절단');
  assert.equal(row[texts[1].item_id], '=HYPERLINK("http://evil","x")', '텍스트로 저장(수식 미실행)');
  const formulaCells = JSON.stringify(env.__store.read().sheets).includes('__FORMULA__');
  assert.equal(formulaCells, false, '어떤 셀도 수식으로 해석되지 않음');
  const raw = writeLog.filter((w) => w.sheet === 'Responses' && typeof w.raw === 'string' && /HYPERLINK|SUM/.test(w.raw));
  assert.ok(raw.every((w) => w.raw.startsWith("'")), "기록 시 ' 접두");

  for (const s of ['=1+1', '+1', '-1', '@x', 'plain']) {
    assert.equal(server.guardFormula_(s), s === 'plain' ? s : "'" + s);
  }
});

test('기간 외 접속: 시작 전·종료 후·수동 마감 모두 차단', () => {
  const { server } = H.makeServer({ pin: PIN });
  const s = H.login(server, PIN);
  const now = Date.now();
  const future = H.createCourse(server, s, { start_at: H.iso(new Date(now + 86400000)), end_at: H.iso(new Date(now + 86400000 * 3)) });
  const past = H.createCourse(server, s, { start_at: H.iso(new Date(now - 86400000 * 5)), end_at: H.iso(new Date(now - 86400000)) });
  const open = H.createCourse(server, s);

  assert.equal(server.getCourseForStudent(future).state, '준비');
  assert.equal(server.verifyAccess(future, H.codeOf(server, future)).code, 'NOT_STARTED');
  assert.equal(server.submitResponse(future, H.codeOf(server, future), {}).code, 'NOT_STARTED');

  assert.equal(server.getCourseForStudent(past).state, '마감');
  assert.equal(server.verifyAccess(past, H.codeOf(server, past)).code, 'CLOSED');
  assert.equal(server.submitResponse(past, H.codeOf(server, past), {}).code, 'CLOSED');

  const c = server.getAdminBootstrap(s).courses.find((x) => x.course_id === open);
  assert.equal(c.status, '진행');
  const upd = server.saveCourse(s, Object.assign({}, c, { manual_close: true }));
  assert.equal(upd.ok, true);
  assert.equal(server.getCourseForStudent(open).state, '마감', '수동 마감');
  assert.equal(server.submitResponse(open, H.codeOf(server, open), {}).code, 'CLOSED');

  assert.equal(server.getCourseForStudent('nope').code, 'NOT_FOUND');
  assert.equal(server.getCourseForStudent('"><script>').code, 'NOT_FOUND');
});

test('토큰: 해시만 저장, 1회 사용, 재사용 차단, nonce 재시도 멱등', () => {
  const { env, server } = H.makeServer({ pin: PIN });
  const s = H.login(server, PIN);
  const id = H.createCourse(server, s, { access_mode: 'token', access_code: '' });
  const g = server.generateTokens(s, id, 5);
  assert.equal(g.ok, true);
  assert.equal(g.tokens.length, 5);
  assert.ok(g.tokens.every((t) => /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(t)), '혼동 문자(0,O,1,I,L) 제외 8자');
  assert.equal(new Set(g.tokens).size, 5);
  const sheetDump = JSON.stringify(env.__store.read().sheets.Tokens.values);
  assert.ok(g.tokens.every((t) => !sheetDump.includes(t.replace('-', ''))), '원문 토큰은 시트에 없음');
  assert.ok(H.table(env, 'Tokens').every((r) => /^[0-9a-f]{64}$/.test(r.token_hash) && r.used === false));

  const items = server.getItems_(id);
  const tok = g.tokens[0];
  assert.equal(server.verifyAccess(id, 'ZZZZ-ZZZZ').code, 'TOKEN_INVALID');
  assert.equal(server.verifyAccess(id, tok.toLowerCase().replace('-', ' ')).ok, true, '대소문자·구분자 관대');
  assert.equal(H.table(env, 'Tokens').filter((r) => r.used === true).length, 0, '확인 단계에서는 사용 처리 안 함');

  const nonce = 'n-1234567890abcdef';
  assert.equal(server.submitResponse(id, tok, H.fullAnswers(items), nonce).ok, true);
  const again = server.submitResponse(id, tok, H.fullAnswers(items), nonce);
  assert.equal(again.ok, true);
  assert.equal(again.duplicate, true, '같은 nonce 재시도는 중복 기록 없이 성공 처리');
  assert.equal(H.table(env, 'Responses').length, 1);

  assert.equal(server.verifyAccess(id, tok).code, 'TOKEN_USED');
  assert.equal(server.submitResponse(id, tok, H.fullAnswers(items), 'n-other-nonce-000000').code, 'TOKEN_USED');
  assert.equal(H.table(env, 'Responses').length, 1, '토큰 재사용 응답은 기록되지 않음');

  const other = H.createCourse(server, s, { access_mode: 'token', access_code: '' });
  assert.equal(server.verifyAccess(other, g.tokens[1]).code, 'TOKEN_INVALID', '토큰은 교과목에 묶임');
});

test('잠금 획득 실패 시 BUSY+retry 반환, 토큰은 소모되지 않음', () => {
  const { env, server } = H.makeServer({ pin: PIN });
  const s = H.login(server, PIN);
  const id = H.createCourse(server, s, { access_mode: 'token', access_code: '' });
  const tok = server.generateTokens(s, id, 1).tokens[0];
  env.__lockCtl.held = true; // 다른 실행이 잠금을 쥐고 있는 상황
  const r = server.submitResponse(id, tok, H.fullAnswers(server.getItems_(id)));
  assert.deepEqual(r, { ok: false, code: 'BUSY', retry: true });
  env.__lockCtl.held = false;
  assert.equal(server.verifyAccess(id, tok).ok, true, '토큰 미소모');
  assert.equal(server.submitResponse(id, tok, H.fullAnswers(server.getItems_(id))).ok, true);
});

test('최소 공개 응답 수 미만 잠금(결과·내보내기·대시보드 평균·비교 집단)', () => {
  const { server } = H.makeServer({ pin: PIN });
  const s = H.login(server, PIN);
  const id = H.createCourse(server, s, { course_name: '성인간호학', section: 'A' });
  const items = server.getItems_(id);
  for (let i = 0; i < 4; i++) assert.equal(server.submitResponse(id, H.codeOf(server, id), H.fullAnswers(items, 3 + (i % 3))).ok, true);

  let r = server.getResults(s, id);
  assert.equal(r.locked, true);
  assert.equal(r.reason, 'MIN_RESPONSES');
  assert.equal(r.n, 4);
  assert.equal(r.stats, undefined, '잠금 시 통계 미포함');
  assert.equal(server.exportText(s, id).locked, true, 'exportText 잠금');
  for (const k of ['raw', 'text', 'report']) assert.equal(server.exportPdf(s, id, k).locked, true, k + ' PDF 잠금');
  assert.equal(server.getAdminBootstrap(s).courses.find((c) => c.course_id === id).mean, null);

  assert.equal(server.submitResponse(id, H.codeOf(server, id), H.fullAnswers(items, 5)).ok, true);
  r = server.getResults(s, id);
  assert.equal(r.locked, false);
  assert.equal(r.n, 5);
  const first = r.stats.items.find((x) => x.type === 'likert5');
  assert.equal(first.mean, 4); // 3,4,5,3,5
  assert.equal(first.sd, 1);
  assert.deepEqual(first.dist, [0, 0, 2, 1, 2]);
  assert.ok(r.stats.domains.length >= 5);
  assert.equal(r.texts.length, 3);

  // 분반 비교: B반은 응답 2건 → 비교에서 제외
  const idB = H.createCourse(server, s, { course_name: '성인간호학', section: 'B' });
  const itemsB = server.getItems_(idB);
  for (let i = 0; i < 2; i++) server.submitResponse(idB, H.codeOf(server, idB), H.fullAnswers(itemsB, 2));
  r = server.getResults(s, id);
  assert.equal(r.section_compare.groups.length, 1);
  assert.equal(r.section_compare.excluded, 1, '소규모 분반 제외');

  // 설정 하한
  assert.equal(server.saveSettings(s, { professor_name: '홍길동', affiliation: '간호학과', min_responses: 2 }).code, 'VALIDATION');
});

test('결과공개일 이전 잠금', () => {
  const { server } = H.makeServer({ pin: PIN });
  const s = H.login(server, PIN);
  const tomorrow = H.iso(new Date(Date.now() + 86400000 * 2)).slice(0, 10);
  const id = H.createCourse(server, s, { result_open_date: tomorrow });
  const items = server.getItems_(id);
  for (let i = 0; i < 6; i++) server.submitResponse(id, H.codeOf(server, id), H.fullAnswers(items));
  const r = server.getResults(s, id);
  assert.equal(r.reason, 'BEFORE_OPEN_DATE');
  assert.equal(r.open_date, tomorrow);
});

test('역문항 환산, 서술형 무작위 순서, CSV 내보내기 삭제(원자료 PDF)', () => {
  const { server } = H.makeServer({ pin: PIN });
  const s = H.login(server, PIN);
  const id = H.createCourse(server, s);
  const items = server.getItems_(id);
  items[0].reverse = true;
  assert.equal(server.saveItems(s, id, items).ok, true);
  const saved = server.getItems_(id);
  const texts = saved.filter((i) => i.type === 'text');
  for (let i = 0; i < 8; i++) {
    const a = H.fullAnswers(saved, 5);
    a[saved[0].item_id] = 1; // 역문항 1 → 5점 환산
    a[texts[0].item_id] = '응답' + i;
    server.submitResponse(id, H.codeOf(server, id), a);
  }
  const r = server.getResults(s, id);
  assert.equal(r.stats.items[0].mean, 5, '역문항 환산');
  assert.deepEqual(r.stats.items[0].dist, [8, 0, 0, 0, 0], '분포는 원점수');
  const orders = new Set();
  for (let k = 0; k < 10; k++) orders.add(server.getResults(s, id).texts[0].answers.join('|'));
  assert.ok(orders.size > 1, '서술형 순서가 호출마다 무작위');

  assert.equal(typeof server.exportCsv, 'undefined', 'CSV 내보내기 삭제');
  assert.equal(typeof server.exportCqi, 'undefined', 'CQI CSV 내보내기 삭제');
  const rawPdf = Buffer.from(server.exportPdf(s, id, 'raw').base64, 'base64').toString('utf8');
  assert.ok(!/response_id|[0-9a-f]{8}-[0-9a-f]{4}/.test(rawPdf), '원자료 PDF에 응답 ID 없음');
  const txt = server.exportText(s, id);
  assert.ok(txt.content.includes('응답0') && txt.content.includes('[AI 요약 요청]') && txt.content.includes('CQI 개선 과제 3가지'));
});

test('문항 편집: 응답 수집 후 잠금, 검증, 복제 시 새 ID', () => {
  const { server } = H.makeServer({ pin: PIN });
  const s = H.login(server, PIN);
  const id = H.createCourse(server, s);
  const items = server.getItems_(id);
  assert.equal(server.saveItems(s, id, [{ domain: 'A', text: '', type: 'likert5' }]).code, 'VALIDATION');
  assert.equal(server.saveItems(s, id, [{ domain: 'A', text: 'x', type: 'single', options: ['하나'] }]).code, 'VALIDATION');
  const withChoice = items.concat([{ domain: 'G. 기타', text: '선호 수업 방식', type: 'multi', options: ['강의', '토론', '실습'], required: false }]);
  assert.equal(server.saveItems(s, id, withChoice).ok, true);

  server.submitResponse(id, H.codeOf(server, id), H.fullAnswers(server.getItems_(id)));
  assert.equal(server.getItemsAdmin(s, id).locked, true);
  assert.equal(server.saveItems(s, id, items).code, 'LOCKED_ITEMS');
  assert.equal(server.deleteCourse(s, id).code, 'HAS_RESPONSES');

  const dup = server.duplicateCourse(s, id, { year: 2027, semester: '1', section: 'A', start_at: '2027-03-02T09:00', end_at: '2027-06-20T23:59' });
  assert.equal(dup.ok, true);
  const a = server.getItems_(id), b = server.getItems_(dup.course_id);
  assert.equal(b.length, a.length);
  assert.ok(b.every((x) => !a.some((y) => y.item_id === x.item_id)), '복제 문항은 새 ID');
  assert.equal(server.readResponses_(dup.course_id).length, 0, '응답은 복제 안 함');
  assert.equal(server.getItemsAdmin(s, dup.course_id).locked, false);
  assert.equal(server.deleteCourse(s, dup.course_id).ok, true);
  assert.equal(server.getItems_(dup.course_id).length, 0, '삭제 시 문항도 삭제');
});

test('샘플 응답(교과목별 30건) 생성·삭제: 샘플 응답만 삭제, 교과목·ID·접속코드 유지', () => {
  const { env, server } = H.makeServer({ pin: PIN });
  const r = server.generateSampleResponses();
  assert.equal(r.ok, true);
  assert.equal(r.created, 90);
  assert.equal(H.table(env, 'Responses').filter((x) => String(x.response_id).startsWith('SAMPLE-')).length, 90);
  const s = H.login(server, PIN);
  const [c1, c2] = server.getCourses_();
  assert.equal(server.getResults(s, c1.course_id).n, 30);
  // 예시 교과목 2로 실제 응답 1건이 들어왔다고 가정
  server.submitResponse(c2.course_id, c2.access_code, H.fullAnswers(server.itemsForCourse_(c2)));
  const before = server.getCourses_().map((c) => c.course_id + ':' + c.access_code);
  const d = server.deleteSampleData(true);
  assert.equal(d.removed, 90);
  assert.equal(H.table(env, 'Responses').length, 1, '실제 응답 보존');
  assert.deepEqual(server.getCourses_().map((c) => c.course_id + ':' + c.access_code), before, '교과목·ID·접속코드 유지');
  // 다시 생성해도 같은 교과목에 추가(새 교과목을 만들지 않음 → 이미 안내한 QR이 그대로 동작)
  server.generateSampleResponses();
  assert.deepEqual(server.getCourses_().map((c) => c.course_id + ':' + c.access_code), before);
  assert.equal(server.getItems_(c1.course_id).length > 0, true, '문항 유지');
});

test('수업 방식: 대면은 온라인 문항 숨김, 비대면으로 바꾸면 온라인 문항 추가(응답 전)', () => {
  const { server } = H.makeServer({ pin: PIN });
  const s = H.login(server, PIN);
  const id = H.createCourse(server, s, { delivery_mode: '대면' });
  const c = () => server.findCourse_(id);
  assert.equal(server.itemsForCourse_(c()).filter((i) => i.scope === 'online').length, 0);
  assert.equal(server.verifyAccess(id, H.codeOf(server, id)).items.some((i) => /온라인/.test(i.domain)), false);
  const cur = server.getAdminBootstrap(s).courses.find((x) => x.course_id === id);
  assert.equal(server.saveCourse(s, Object.assign({}, cur, { delivery_mode: '비대면' })).ok, true);
  const items = server.itemsForCourse_(c());
  assert.equal(items.filter((i) => i.scope === 'online').length, 4);
  const firstOnline = items.findIndex((i) => i.scope === 'online');
  assert.ok(firstOnline < items.findIndex((i) => i.type === 'text'), '온라인 문항은 서술형 앞');
  assert.equal(server.saveCourse(s, Object.assign({}, cur, { delivery_mode: '비대면' })).ok, true);
  assert.equal(server.itemsForCourse_(c()).filter((i) => i.scope === 'online').length, 4, '중복 추가 없음');
});

test('교과목 유형: 이론은 실습실 문항, 실습은 이론 강의실 문항 제외(학생·결과 모두)', () => {
  const { server } = H.makeServer({ pin: PIN });
  const s = H.login(server, PIN);
  const visible = (id) => server.itemsForCourse_(server.findCourse_(id)).map((i) => i.text);
  const theory = H.createCourse(server, s, { course_type: '이론' });
  const practice = H.createCourse(server, s, { course_type: '실습' });
  const both = H.createCourse(server, s, { course_type: '이론+실습' });
  const has = (id, re) => visible(id).some((t) => re.test(t));
  assert.equal(has(theory, /^실습실의 시설/), false);
  assert.equal(has(theory, /^이론 강의실/), true);
  assert.equal(has(practice, /^이론 강의실/), false);
  assert.equal(has(practice, /^실습실의 시설/), true);
  assert.equal(has(both, /^이론 강의실/) && has(both, /^실습실의 시설/), true);
  assert.equal(visible(theory).length, visible(both).length - 1, '이론 교과목은 1문항 적음');
  assert.equal(server.verifyAccess(theory, H.codeOf(server, theory)).items.some((i) => /^실습실/.test(i.text)), false, '학생 화면에서도 제외');
  assert.equal(server.getAdminBootstrap(s).courses.find((c) => c.course_id === theory).item_count, visible(theory).length);
  // 숨긴 문항은 제출 검증·결과에도 나타나지 않음
  const items = server.itemsForCourse_(server.findCourse_(theory));
  for (let i = 0; i < 5; i++) server.submitResponse(theory, H.codeOf(server, theory), H.fullAnswers(items));
  const r = server.getResults(s, theory);
  assert.equal(r.stats.items.some((x) => /^실습실/.test(x.text)), false);
  assert.equal(server.saveCourse(s, Object.assign({}, base(server, s, practice), { course_type: '보건' })).field, 'course_type');
});

function base(server, s, id) {
  return server.getAdminBootstrap(s).courses.find((c) => c.course_id === id);
}

test('응답 수집 후에는 교과목 유형·수업 방식 변경 불가(문항 구성 고정), 응답 전에는 변경 가능', () => {
  const { server } = H.makeServer({ pin: PIN });
  const s = H.login(server, PIN);
  const id = H.createCourse(server, s, { course_type: '이론+실습' });
  assert.equal(server.saveCourse(s, Object.assign({}, base(server, s, id), { course_type: '이론' })).ok, true, '응답 전 변경 허용');
  server.submitResponse(id, H.codeOf(server, id), H.fullAnswers(server.itemsForCourse_(server.findCourse_(id))));
  let r = server.saveCourse(s, Object.assign({}, base(server, s, id), { course_type: '실습' }));
  assert.equal(r.code, 'VALIDATION');
  assert.equal(r.field, 'course_type');
  r = server.saveCourse(s, Object.assign({}, base(server, s, id), { delivery_mode: '비대면' }));
  assert.equal(r.field, 'delivery_mode');
  assert.equal(server.saveCourse(s, Object.assign({}, base(server, s, id), { enrollment: 35 })).ok, true, '다른 항목 수정은 허용');
  assert.equal(server.findCourse_(id).course_type, '이론');
});

test('이전 버전 템플릿: setup이 기본 문구 그대로인 환경 문항에만 표시 조건을 채움', () => {
  const { env, server } = H.makeServer();
  const t = server.readTable_('Items');
  const col = t.headers.indexOf('scope') + 1;
  const sh = env.SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Items');
  const theoryRow = t.rows.find((r) => r.course_id === 'TEMPLATE' && /^이론 강의실/.test(r.text));
  const practiceRow = t.rows.find((r) => r.course_id === 'TEMPLATE' && /^실습실의 시설/.test(r.text));
  sh.getRange(theoryRow._row, col).setValue('');           // v1.1 상태로 되돌림
  sh.getRange(practiceRow._row, col).setValue('');
  sh.getRange(practiceRow._row, t.headers.indexOf('text') + 1).setValue('실습실이 좋았다(교수가 수정한 문구)');
  server.setup();
  const tpl = server.getItems_('TEMPLATE');
  assert.equal(tpl.find((i) => /^이론 강의실/.test(i.text)).scope, 'theory', '기본 문구는 업그레이드');
  assert.equal(tpl.find((i) => /교수가 수정한/.test(i.text)).scope, '', '교수가 고친 문항은 그대로');
});

test('드롭다운 검증: 학년 1~4, 반 A~F, 학과 필수, 수업 방식', () => {
  const { server } = H.makeServer({ pin: PIN });
  const s = H.login(server, PIN);
  const base = { course_name: 'X', year: 2026, semester: '2', grade: 2, section: 'B', department: '간호학과', delivery_mode: '대면', enrollment: 30, start_at: '2026-12-01T09:00', end_at: '2026-12-10T23:59' };
  assert.equal(server.saveCourse(s, base).ok, true);
  assert.equal(server.saveCourse(s, Object.assign({}, base, { grade: 5 })).field, 'grade');
  assert.equal(server.saveCourse(s, Object.assign({}, base, { section: 'G' })).field, 'section');
  assert.equal(server.saveCourse(s, Object.assign({}, base, { section: 'f' })).ok, true, '소문자 허용');
  assert.equal(server.saveCourse(s, Object.assign({}, base, { department: '' })).field, 'department');
  assert.equal(server.saveCourse(s, Object.assign({}, base, { delivery_mode: '원격' })).field, 'delivery_mode');
  assert.equal(server.saveSettings(s, { professor_name: '정종필', affiliation: '청암대학교 간호학과', min_responses: 5, departments: '간호학과\n보건행정학과\n간호학과' }).ok, true);
  assert.deepEqual(server.getAdminBootstrap(s).settings.departments, ['간호학과', '보건행정학과'], '중복 제거');
});

/** 교수가 문항 편집기에서 드롭다운 문항(성별)을 직접 추가한 경우 */
function addGender(server, s, id, required) {
  const items = server.getItems_(id).concat([{ domain: '응답자 정보', text: '성별', type: 'select', options: ['남', '여'], required: required !== false }]);
  assert.equal(server.saveItems(s, id, items).ok, true);
}

test('드롭다운(교수가 추가한 성별 문항): 소규모 집단이면 비교·인원·CSV 열 모두 숨김, 충분하면 집단별 평균', () => {
  const { server } = H.makeServer({ pin: PIN });
  const s = H.login(server, PIN);
  const id = H.createCourse(server, s);
  addGender(server, s, id);
  const items = server.itemsForCourse_(server.findCourse_(id));
  const g = items.find((i) => i.type === 'select');
  const submit = (sex, v) => { const a = H.fullAnswers(items, v); a[g.item_id] = sex; return server.submitResponse(id, H.codeOf(server, id), a); };
  for (let i = 0; i < 8; i++) submit('여', 4);
  submit('남', 2); // 남 1명 → 특정 위험
  let r = server.getResults(s, id);
  assert.equal(r.groups[0].suppressed, true);
  assert.equal(r.groups[0].groups, undefined, '수치 없음');
  const st = r.stats.items.find((x) => x.type === 'select');
  assert.equal(st.options, undefined, '인원 분포도 숨김');
  const rawPdf = server.exportPdf(s, id, 'raw');
  assert.equal(rawPdf.omitted, 1);
  assert.ok(!Buffer.from(rawPdf.base64, 'base64').toString('utf8').includes('성별'), '원자료에서 성별 열 제외');

  for (let i = 0; i < 4; i++) submit('남', 3);
  r = server.getResults(s, id);
  assert.equal(r.groups[0].suppressed, false);
  const byLabel = Object.fromEntries(r.groups[0].groups.map((x) => [x.label, x]));
  assert.equal(byLabel['여'].n, 8);
  assert.equal(byLabel['남'].n, 5);
  assert.equal(byLabel['여'].overall, 4);
  assert.equal(byLabel['남'].overall, 2.8); // (2 + 3*4) / 5
  assert.equal(server.exportPdf(s, id, 'raw').omitted, 0);
  // 성별은 필수: 비워 두면 제출 거부
  const a = H.fullAnswers(items, 1); a[g.item_id] = '';
  assert.deepEqual(server.submitResponse(id, H.codeOf(server, id), a).missing, [g.item_id]);

  // 교수가 성별을 선택 응답으로 바꾼 교과목: 미응답 집단이 소규모여도 숨김(전체 평균과의 차로 역산 가능)
  const id2 = H.createCourse(server, s);
  addGender(server, s, id2, false);
  const its2 = server.itemsForCourse_(server.findCourse_(id2));
  const g2 = its2.find((i) => i.type === 'select');
  const sub2 = (sex) => { const x = H.fullAnswers(its2); x[g2.item_id] = sex; return server.submitResponse(id2, H.codeOf(server, id2), x); };
  for (let i = 0; i < 5; i++) { sub2('여'); sub2('남'); }
  assert.equal(server.getResults(s, id2).groups[0].suppressed, false);
  assert.equal(sub2('').ok, true);
  assert.equal(server.getResults(s, id2).groups[0].suppressed, true);
});

test('학기는 1·2학기만(여름·겨울 삭제)', () => {
  const { server } = H.makeServer({ pin: PIN });
  const s = H.login(server, PIN);
  for (const sem of ['여름', '겨울', '3']) {
    assert.equal(server.saveCourse(s, { course_name: 'X', year: 2026, semester: sem, grade: 1, section: 'A', department: '간호학과', enrollment: 30, start_at: '2026-12-01T09:00', end_at: '2026-12-10T23:59' }).field, 'semester', sem);
  }
  assert.deepEqual(server.APP.SEMESTERS, ['1', '2']);
});

test('이전 버전 시트 업그레이드: 기본 문항 필수화·예시 교과목 1학기(응답 있는 교과목은 그대로)', () => {
  const { env, server } = H.makeServer({ pin: PIN });
  const sh = (n) => env.SpreadsheetApp.getActiveSpreadsheet().getSheetByName(n);
  const items = server.readTable_('Items');
  const reqCol = items.headers.indexOf('required') + 1;
  // v1.2.1 상태 재현: 서술형·성별이 선택, 디지털리터러시 교과목이 2학기
  items.rows.filter((r) => r.type === 'text' || r.type === 'select').forEach((r) => sh('Items').getRange(r._row, reqCol).setValue(false));
  const courses = server.readTable_('Courses');
  const semCol = courses.headers.indexOf('semester') + 1;
  const dl = courses.rows.find((r) => r.course_name === '디지털리터러시와 AI활용');
  const ai = courses.rows.find((r) => r.course_name === 'AI융합 간호정보학');
  sh('Courses').getRange(dl._row, semCol).setValue("'2");
  // AI융합 간호정보학에는 실제 응답 1건(서술형을 비운 응답)이 이미 있음
  const aiItems = server.itemsForCourse_(server.findCourse_(ai.course_id));
  const ans = H.fullAnswers(aiItems); aiItems.filter((i) => i.type === 'text').forEach((i) => { ans[i.item_id] = ''; });
  assert.equal(server.submitResponse(ai.course_id, ai.access_code, ans).ok, true);

  server.setup(); // 새 설치 파일로 setup 재실행
  assert.ok(server.getItems_('TEMPLATE').every((i) => i.required), '기본 문항 은행 필수화');
  assert.ok(server.getItems_(dl.course_id).every((i) => i.required), '응답 없는 교과목 필수화');
  assert.equal(server.findCourse_(dl.course_id).semester, '1');
  assert.ok(server.getItems_(ai.course_id).filter((i) => i.type === 'text').every((i) => !i.required), '응답 있는 교과목은 그대로');
});

test('결과 한눈에 보기: 긍정 비율, 핵심 지표(만족도·추천), 워드 클라우드', () => {
  const { server } = H.makeServer({ pin: PIN });
  const s = H.login(server, PIN);
  const id = H.createCourse(server, s);
  const items = server.itemsForCourse_(server.findCourse_(id));
  const texts = items.filter((i) => i.type === 'text');
  const vals = [5, 5, 4, 3, 2];
  vals.forEach((v, i) => {
    const a = H.fullAnswers(items, v);
    a[texts[0].item_id] = ['실습이 유익했습니다', '실습 자료가 좋았어요', 'Wi-Fi가 자주 끊겨요', '피드백이 빨랐습니다', '실습실 와이파이 개선'][i];
    server.submitResponse(id, H.codeOf(server, id), a);
  });
  const r = server.getResults(s, id);
  assert.equal(r.stats.overall_pos_pct, 60);
  assert.equal(r.stats.kpis.satisfaction.pos_pct, 60);
  assert.match(r.stats.kpis.satisfaction.text, /만족/);
  assert.match(r.stats.kpis.recommend.text, /추천/);
  const d = r.stats.domains[0];
  assert.deepEqual([d.neg_pct, d.neu_pct, d.pos_pct], [20, 20, 60]);
  assert.equal(d.dist.reduce((x, y) => x + y, 0), 10, '영역 분포 = 문항 2개 × 5명');
  const words = Object.fromEntries(r.wordcloud.all.map((w) => [w.w, w.n]));
  assert.equal(words['실습'], 2);
  assert.equal(words['와이파이'], 2, 'Wi-Fi 표기 통일');
  assert.ok(!('유익했습니다' in words) && !('좋았어요' in words), '서술어 제외');
  assert.ok(r.wordcloud.items[texts[0].item_id].length > 0);
  const boot = server.getAdminBootstrap(s).courses.find((c) => c.course_id === id);
  assert.equal(boot.pos_pct, 60);
  assert.ok(boot.domains.length >= 6);
});

test('google.script.run 반환값에 Date가 없음(모든 공개 API)', () => {
  const { server } = H.makeServer({ pin: PIN });
  server.generateSampleResponses();
  const s = H.login(server, PIN);
  const demo = H.demoCourse(server);
  const calls = [
    server.getCourseForStudent(demo.course_id), server.verifyAccess(demo.course_id, demo.access_code),
    server.getAdminBootstrap(s), server.getItemsAdmin(s, demo.course_id), server.getItemsAdmin(s, 'TEMPLATE'),
    server.getResults(s, demo.course_id), server.exportPdf(s, demo.course_id, 'report'),
    server.exportText(s, demo.course_id), server.generateTokens(s, demo.course_id, 2)
  ];
  calls.forEach((r) => { assert.equal(r.ok, true, JSON.stringify(r).slice(0, 200)); H.GasMock.assertSerializable(r); });
});

test('doGet: 템플릿 렌더링, 파라미터 이스케이프, 관리자 라우팅', () => {
  const { server } = H.makeServer({ pin: PIN });
  const html = server.doGet({ parameter: { c: '"><script>alert(1)</script>', t: '<b>ab-cd</b>' } }).getContent();
  assert.ok(!html.includes('<script>alert(1)'), 'c 파라미터 XSS 차단');
  assert.ok(!html.includes('ab-cd') && !html.includes('BABCDB'), '파라미터 값은 페이지에 넣지 않음');
  assert.ok(html.includes('data-legacy="1"'), '이전 방식 링크 안내');
  assert.ok(html.includes('Developed by 정종필 교수 · 청암대학교 간호학과'));
  assert.ok(html.includes('학교 공식 강의평가를 대체하지 않는'));
  const admin = server.doGet({ parameter: { page: 'admin' } });
  assert.ok(admin.getContent().includes('교수자 로그인') || admin.getContent().includes('renderLogin'));
  assert.ok(admin._meta.some(([n]) => n === 'viewport'));
});

test('학생 링크 주소: 테스트용 /dev로 접속하면 링크를 만들지 않고, 저장된 /exec 주소를 사용', () => {
  const DEV = 'https://script.google.com/macros/s/AKfyc123/dev';
  const EXEC = 'https://script.google.com/macros/s/AKfyc123/exec';
  const { server } = H.makeServer({ pin: PIN, url: DEV });
  const s = H.login(server, PIN);
  let b = server.getAdminBootstrap(s);
  assert.equal(b.devMode, true);
  assert.equal(b.webAppUrl, '', '/dev는 학생 링크로 쓰지 않음');
  assert.ok(b.courses.every((c) => c.base_url === ''));

  const base = { professor_name: '정종필', affiliation: '청암대학교 간호학과', min_responses: 5, departments: '간호학과' };
  let r = server.saveSettings(s, Object.assign({}, base, { webapp_url: DEV }));
  assert.equal(r.field, 'webapp_url', '/dev 주소는 저장 거부');
  assert.equal(server.saveSettings(s, Object.assign({}, base, { webapp_url: 'https://evil.example.com/exec' })).field, 'webapp_url');
  assert.equal(server.saveSettings(s, Object.assign({}, base, { webapp_url: EXEC + '?page=admin' })).ok, true, '쿼리는 떼고 저장');
  b = server.getAdminBootstrap(s);
  assert.equal(b.webAppUrl, EXEC);
  assert.ok(b.courses.every((c) => c.base_url === EXEC && !('link' in c)), 'QR용 링크 없음, 공통 주소만');
  assert.equal(server.generateTokens(s, b.courses[0].course_id, 1).course.base_url, EXEC, '토큰 시트 주소도 /exec');
  // Workspace 도메인 형식도 허용
  assert.equal(server.saveSettings(s, Object.assign({}, base, { webapp_url: 'https://script.google.com/a/macros/cheongam.ac.kr/s/AKfyc123/exec' })).ok, true);
});

test('학생 링크 주소: 비어 있을 때만 /exec 주소를 자동 기억, 저장된 주소는 덮어쓰지 않음', () => {
  const EXEC = 'https://script.google.com/macros/s/NEWDEPLOY9/exec';
  const { env, server } = H.makeServer({ url: EXEC });
  assert.equal(server.getSettingsMap_().webapp_url, EXEC, 'setup 시 기억');
  // getUrl()이 다른 배포 주소를 돌려주더라도 저장된 주소는 그대로
  const quiet = { log() {}, error() {} };
  const env2 = H.GasMock.createEnv({ state: env.__store.read(), url: 'https://script.google.com/macros/s/OTHER77/exec', fastSleep: true, readFile: H.readFile, console: quiet });
  const s2 = H.GasMock.loadServer(env2, H.SOURCES);
  s2.doGet({ parameter: { page: 'admin' } });
  assert.equal(s2.getSettingsMap_().webapp_url, EXEC, '덮어쓰지 않음');
  s2.storePin_('123456');
  const b = s2.getAdminBootstrap(s2.adminLogin('123456').session);
  assert.equal(b.webAppUrl, EXEC);
  assert.equal(b.currentUrl, 'https://script.google.com/macros/s/OTHER77/exec', '현재 실행 주소는 따로 알려 줌');
  // /dev로 접속해도 기억된 /exec 주소 사용
  const env3 = H.GasMock.createEnv({ state: env2.__store.read(), url: 'https://script.google.com/macros/s/OTHER77/dev', fastSleep: true, readFile: H.readFile, console: quiet });
  const s3 = H.GasMock.loadServer(env3, H.SOURCES);
  s3.doGet({ parameter: {} });
  assert.equal(s3.studentBaseUrl_(s3.getSettingsMap_()), EXEC);
});

test('교과목 편집에서 반·수강인원 없이 저장, 응답률 대신 응답 수(수강인원 입력 시에만 응답률)', () => {
  const { server } = H.makeServer({ pin: PIN });
  const s = H.login(server, PIN);
  const r = server.saveCourse(s, { course_name: '기본간호학', year: 2026, semester: '2', grade: 1, department: '간호학과', delivery_mode: '대면',
    start_at: H.iso(new Date(Date.now() - 3600000)), end_at: H.iso(new Date(Date.now() + 86400000)), access_mode: 'code', access_code: 'AB12', result_open_date: '2020-01-01' });
  assert.equal(r.ok, true, '반·수강인원 없이 저장');
  const c = server.getAdminBootstrap(s).courses.find((x) => x.course_id === r.course_id);
  assert.equal(c.section, '');
  assert.equal(c.enrollment, 0);
  assert.equal(c.response_rate, null, '수강인원이 없으면 응답률 없음');
  const items = server.itemsForCourse_(server.findCourse_(r.course_id));
  for (let i = 0; i < 5; i++) server.submitResponse(r.course_id, 'AB12', H.fullAnswers(items));
  const res = server.getResults(s, r.course_id);
  assert.equal(res.n, 5);
  assert.equal(res.course.response_rate, null);
  assert.ok(Buffer.from(server.exportPdf(s, r.course_id, 'report').base64, 'base64').toString('utf8').includes('5명'), '보고서 응답 수');
  assert.equal(server.saveCourse(s, Object.assign({}, c, { section: 'G' })).field, 'section', '값이 오면 A~F만');
});

test('학기 간 비교: 반이 없는 새 교과목과 반이 있는 이전 교과목도 교과목명으로 비교', () => {
  const { server } = H.makeServer({ pin: PIN });
  const s = H.login(server, PIN);
  const prev = H.createCourse(server, s, { course_name: '성인간호학', year: 2025, section: 'A' });
  const cur = H.createCourse(server, s, { course_name: '성인간호학', section: '' });
  [prev, cur].forEach((id) => {
    const its = server.itemsForCourse_(server.findCourse_(id));
    for (let i = 0; i < 5; i++) server.submitResponse(id, H.codeOf(server, id), H.fullAnswers(its));
  });
  assert.equal(server.getResults(s, cur).semester_compare.groups.length, 2);
  // 같은 학기의 다른 반은 학기 간 비교에 섞이지 않음
  const same = H.createCourse(server, s, { course_name: '성인간호학', section: 'B' });
  const its = server.itemsForCourse_(server.findCourse_(same));
  for (let i = 0; i < 5; i++) server.submitResponse(same, H.codeOf(server, same), H.fullAnswers(its));
  const r = server.getResults(s, cur);
  assert.equal(r.semester_compare.groups.length, 2);
  assert.equal(r.section_compare.groups.length, 2, '같은 학기 다른 반은 분반 간 비교로');
});

test('이전 버전 시트 업그레이드(v1.2.3): 성별 문항 삭제(응답 있는 교과목 제외), 예시 교과목 임시값(A반·40명) 정리', () => {
  const { env, server } = H.makeServer({ pin: PIN });
  const s = H.login(server, PIN);
  const sh = (n) => env.SpreadsheetApp.getActiveSpreadsheet().getSheetByName(n);
  const [dl, ai] = server.getCourses_();
  // v1.2.2 상태 재현: 기본 문항 은행·두 교과목에 성별 문항, 예시 교과목에 A반·40명
  const g = { domain: '응답자 정보', text: '성별', type: 'select', options: ['남', '여'], required: true };
  assert.equal(server.saveItems(s, 'TEMPLATE', server.getItems_('TEMPLATE').concat([g])).ok, true);
  [dl, ai].forEach((c) => assert.equal(server.saveItems(s, c.course_id, server.getItems_(c.course_id).concat([g])).ok, true));
  const ct = server.readTable_('Courses');
  ct.rows.forEach((r) => {
    sh('Courses').getRange(r._row, ct.headers.indexOf('section') + 1).setValue("'A");
    sh('Courses').getRange(r._row, ct.headers.indexOf('enrollment') + 1).setValue(40);
  });
  // AI융합 간호정보학은 이미 응답 1건(성별 포함)
  const aiItems = server.itemsForCourse_(server.findCourse_(ai.course_id));
  assert.equal(server.submitResponse(ai.course_id, ai.access_code, H.fullAnswers(aiItems)).ok, true);

  server.setup();
  const hasGender = (id) => server.getItems_(id).some((i) => i.text === '성별');
  assert.equal(hasGender('TEMPLATE'), false, '기본 문항 은행에서 삭제');
  assert.equal(hasGender(dl.course_id), false, '응답 없는 교과목에서 삭제');
  assert.equal(hasGender(ai.course_id), true, '응답 있는 교과목은 그대로');
  server.getCourses_().forEach((c) => { assert.equal(c.section, ''); assert.equal(c.enrollment, 0); });
});

test('간단 접속: 공통 주소에서 코드만으로 교과목 찾기(토큰 포함), 코드 중복 금지', () => {
  const { server } = H.makeServer({ pin: PIN, url: 'https://script.google.com/macros/s/ABC/exec' });
  const s = H.login(server, PIN);
  const demo = H.demoCourse(server);
  const boot = server.getAdminBootstrap(s);
  const sum = boot.courses.find((c) => c.course_id === demo.course_id);
  assert.equal(sum.base_url, 'https://script.google.com/macros/s/ABC/exec');
  assert.ok(!('link' in sum), 'QR용 링크 필드 없음');

  // 공통 주소: 코드만으로 찾기(대소문자·공백·하이픈 무시)
  const f = server.findCourseByCode(' ' + demo.access_code.toLowerCase() + ' ');
  assert.deepEqual([f.ok, f.course_id, f.token], [true, demo.course_id, false]);
  assert.equal(server.findCourseByCode('ZZZZZZ').code, 'BAD_CODE');
  assert.equal(server.findCourseByCode('').code, 'BAD_CODE');

  // 토큰 방식: 토큰으로 교과목 찾기
  const tid = H.createCourse(server, s, { access_mode: 'token', access_code: '' });
  const tok = server.generateTokens(s, tid, 2).tokens[0];
  const ft = server.findCourseByCode(tok);
  assert.deepEqual([ft.ok, ft.course_id, ft.token], [true, tid, true]);

  // 코드 중복 금지(자기 자신 재저장은 허용)
  const dup = server.saveCourse(s, Object.assign({}, { course_name: '중복', year: 2026, semester: '2', grade: 3, department: '간호학과', delivery_mode: '대면',
    start_at: H.iso(new Date()), end_at: H.iso(new Date(Date.now() + 86400000)), access_mode: 'code', access_code: demo.access_code.toLowerCase() }));
  assert.equal(dup.code, 'VALIDATION');
  assert.equal(dup.field, 'access_code');
  const id2 = H.createCourse(server, s, { access_code: 'UNIQ01' });
  const again = server.saveCourse(s, { course_id: id2, course_name: '테스트 교과목', year: 2026, semester: '2', grade: 3, department: '간호학과', delivery_mode: '대면',
    start_at: H.iso(new Date(Date.now() - 3600000)), end_at: H.iso(new Date(Date.now() + 86400000)), access_mode: 'code', access_code: 'UNIQ01' });
  assert.equal(again.ok, true);

  // doGet: k 파라미터는 페이지에 넣지 않음(이전 방식 링크 안내만)
  const html = server.doGet({ parameter: { c: demo.course_id, k: '<x>"ab12' } }).getContent();
  assert.doesNotMatch(html, /XAB12|<x>/);
});

test('이전 버전 시트 업그레이드(v1.3.0): 교수학습방법 문항 문구 변경(응답 있는 교과목 제외)', () => {
  const { env, server } = H.makeServer({ pin: PIN });
  const OLD = '토의·사례·시뮬레이션 등 다양한 교수학습방법이 활용되었다.';
  const NEW = '토의·사례·시뮬레이션·플립러닝·스마트교수법·AI활용 등 다양한 교수학습방법이 활용되었다.';
  const sh = env.SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Items');
  const it = server.readTable_('Items');
  const col = it.headers.indexOf('text') + 1;
  // 이전 문구로 되돌려 이전 버전 시트 재현
  it.rows.filter((r) => r.text === NEW).forEach((r) => sh.getRange(r._row, col).setValue(OLD));
  const [dl, ai] = server.getCourses_();
  const aiItems = server.itemsForCourse_(server.findCourse_(ai.course_id));
  assert.equal(server.submitResponse(ai.course_id, ai.access_code, H.fullAnswers(aiItems)).ok, true);

  server.setup();
  const text = (id) => server.getItems_(id).filter((i) => /교수학습방법이 활용/.test(i.text)).map((i) => i.text);
  assert.deepEqual(text('TEMPLATE'), [NEW], '기본 문항 은행');
  assert.deepEqual(text(dl.course_id), [NEW], '응답 없는 교과목');
  assert.deepEqual(text(ai.course_id), [OLD], '응답 있는 교과목은 그대로');
});

test('이전 버전 시트 업그레이드(v1.3.0): F 영역 5개·예시 교과목 CLO 5개로 확대(응답 있는 교과목·교수가 지운 영역 제외)', () => {
  const { server } = H.makeServer({ pin: PIN });
  const s = H.login(server, PIN);
  const isNewF = (i) => /사용 방법을 충분히|비판적으로 검토하는 능력|윤리·저작권/.test(i.text);
  const NEW_CLO = /오피스|문서·스프레드시트|건강정보의 신뢰성|협업 도구|표준간호용어|간호 데이터를|의료정보 보안/;
  // v1.2 상태 재현: 새 F 3개·새 CLO 3개 삭제
  const strip = (id) => assert.equal(server.saveItems(s, id, server.getItems_(id).filter((i) => !isNewF(i) && !NEW_CLO.test(i.text))).ok, true);
  const [dl, ai] = server.getCourses_();
  const own = H.createCourse(server, s, { course_name: '기본간호학' });
  ['TEMPLATE', dl.course_id, ai.course_id, own].forEach(strip);
  // 교수가 F 영역을 통째로 지운 교과목
  const noF = H.createCourse(server, s, { course_name: '성인간호학' });
  server.saveItems(s, noF, server.getItems_(noF).filter((i) => !/^F\./.test(i.domain)));
  // AI융합 간호정보학은 이미 응답 1건
  assert.equal(server.submitResponse(ai.course_id, ai.access_code, H.fullAnswers(server.itemsForCourse_(server.findCourse_(ai.course_id)))).ok, true);
  const count = (id, re) => server.getItems_(id).filter((i) => re.test(i.domain)).length;
  assert.equal(count(dl.course_id, /^F\./), 2);

  server.setup();
  assert.equal(count('TEMPLATE', /^F\./), 5, '기본 문항 은행 F 5개');
  assert.equal(count(dl.course_id, /^F\./), 5, '응답 없는 예시 교과목 F 5개');
  assert.equal(count(dl.course_id, /^D\./), 5, '응답 없는 예시 교과목 CLO 5개');
  assert.equal(count(own, /^F\./), 5, '교수가 만든 교과목(응답 없음)도 F 5개');
  assert.equal(count(ai.course_id, /^F\./), 2, '응답 있는 교과목은 그대로');
  assert.equal(count(ai.course_id, /^D\./), 2, '응답 있는 교과목 CLO 그대로');
  assert.equal(count(noF, /^F\./), 0, '교수가 지운 영역은 되살리지 않음');
  // 새 문항은 F 영역 끝(G 종합 앞)에 들어감
  const doms = server.getItems_(dl.course_id).map((i) => i.domain.charAt(0)).join('');
  assert.match(doms, /D{5}.*F{5}G/);
  assert.ok(server.getItems_('TEMPLATE').every((i) => /^t\d+$/.test(i.item_id)), '기본 문항 ID 형식 유지');
  server.setup();
  assert.equal(count('TEMPLATE', /^F\./), 5, '재실행해도 중복 없음');
});

test('샘플 응답: 필수 문항은 모두 채움(교과목마다 30건), 교과목 복제 시 접속코드 중복 없음, 예상 시간 제공', () => {
  const { server } = H.makeServer({ pin: PIN });
  const s = H.login(server, PIN);
  assert.equal(server.generateSampleResponses().created, 90);
  server.getCourses_().forEach((c) => {
    const items = server.itemsForCourse_(c);
    const rows = server.readResponses_(c.course_id);
    assert.equal(rows.length, 30, c.course_name);
    rows.forEach((r) => items.filter((it) => it.required).forEach((it) => {
      assert.notEqual(String(r[it.item_id] == null ? '' : r[it.item_id]).trim(), '', c.course_name + ': ' + it.text);
    }));
  });
  // 복제 20회: 접속코드가 기존 교과목과 겹치지 않음
  const src = server.getCourses_()[0];
  for (let i = 0; i < 20; i++) {
    assert.equal(server.duplicateCourse(s, src.course_id, { year: 2027, semester: '1', start_at: '2027-03-02T09:00', end_at: '2027-03-20T23:59' }).ok, true);
  }
  const codes = server.getCourses_().map((c) => String(c.access_code).toUpperCase());
  assert.equal(new Set(codes).size, codes.length, '접속코드 중복 없음');
  // 관리자 목록에 예상 응답 시간(수업 화면 안내에 사용)
  const sum = server.getAdminBootstrap(s).courses.find((c) => c.course_id === src.course_id);
  assert.equal(sum.est_minutes, 5);
  assert.equal(typeof server.checkStudentLink, 'undefined', '외부 접속(UrlFetch) 기능 제거');
});

test('시트 보호(경고): Responses·Tokens·Courses·Items, 응답 시트 빈 열 정리, 수동 마감 → 2027 복제로 재시작', () => {
  const { env, server } = H.makeServer({ pin: PIN });
  const s = H.login(server, PIN);
  const ss = env.SpreadsheetApp.getActiveSpreadsheet();
  ['Responses', 'Tokens', 'Courses', 'Items'].forEach((n) => {
    const p = ss.getSheetByName(n).getProtections(env.SpreadsheetApp.ProtectionType.SHEET);
    assert.equal(p.length, 1, n + ' 보호');
    assert.equal(p[0].isWarningOnly(), true, n + ' 경고만(편집 가능)');
  });
  server.setup();
  assert.equal(ss.getSheetByName('Items').getProtections(env.SpreadsheetApp.ProtectionType.SHEET).length, 1, '재실행해도 보호 중복 없음');

  // 샘플 응답 → 삭제 후, 응답 없는 열이 남은 상태(교수님 시트와 같은 상황) 재현
  const [dl, ai] = server.getCourses_();
  server.generateSampleResponses();
  server.withLock_(() => { server.filterTable_('Responses', () => false); return { ok: true }; });
  const before = server.readTable_('Responses').headers.filter(String).length;
  assert.ok(before > 3, '빈 문항 열이 남아 있음');
  const r = server.cleanResponseSheet();
  assert.equal(r.ok, true);
  assert.equal(r.removed, before - 3);
  assert.deepEqual(server.readTable_('Responses').headers.filter(String), ['response_id', 'course_id', 'submitted_date']);
  assert.equal(server.cleanResponseSheet().removed, 0, '두 번째 실행은 정리할 열 없음');
  // 정리 후에도 제출 정상(필요한 열 자동 생성), 데이터 있는 열은 정리하지 않음
  assert.equal(server.submitResponse(ai.course_id, ai.access_code, H.fullAnswers(server.itemsForCourse_(server.findCourse_(ai.course_id)))).ok, true);
  const cols = server.readTable_('Responses').headers.filter(String).length;
  assert.equal(server.cleanResponseSheet().removed, 0);
  assert.equal(server.readTable_('Responses').headers.filter(String).length, cols);

  // 디지털리터러시와 AI활용: 수동 마감 → 학생 차단, 2027-1학기 복제로 다시 시작
  const c = server.findCourse_(dl.course_id);
  const form = { course_id: c.course_id, course_name: c.course_name, year: c.year, semester: c.semester, grade: c.grade, department: c.department,
    delivery_mode: c.delivery_mode, course_type: c.course_type, start_at: server.fmtDT_(c.start_at), end_at: server.fmtDT_(c.end_at),
    access_mode: c.access_mode, access_code: c.access_code, result_open_date: '', manual_close: true };
  assert.equal(server.saveCourse(s, form).ok, true);
  assert.equal(server.getCourseForStudent(dl.course_id).state, '마감');
  assert.equal(server.verifyAccess(dl.course_id, dl.access_code).code, 'CLOSED');
  const sum = server.getAdminBootstrap(s).courses.find((x) => x.course_id === dl.course_id);
  assert.equal(sum.manual_close, true, '관리자 화면에 수동 마감 표시');
  const dup = server.duplicateCourse(s, dl.course_id, { year: 2027, semester: '1', start_at: '2027-03-02T09:00', end_at: '2027-03-20T23:59' });
  assert.equal(dup.ok, true);
  const next = server.findCourse_(dup.course_id);
  assert.equal(next.course_name, '디지털리터러시와 AI활용');
  assert.equal(server.getItems_(next.course_id).length, server.getItems_(dl.course_id).length, '문항 그대로 복사');
  assert.notEqual(next.access_code, dl.access_code, '새 접속코드');
});

test('PDF 내보내기: 원자료·CQI 요약표·서술형(잠금 규칙 동일, 관리자만, 종류 검증, HTML 이스케이프)', () => {
  const { server } = H.makeServer({ pin: PIN });
  const s = H.login(server, PIN);
  const [dl] = server.getCourses_();
  assert.equal(server.exportPdf(s, dl.course_id, 'raw').locked, true, '응답 부족이면 잠김');
  server.generateSampleResponses();
  // 서술형에 HTML이 들어와도 그대로 출력되지 않음
  const items = server.itemsForCourse_(server.findCourse_(dl.course_id));
  const a = H.fullAnswers(items);
  items.filter((i) => i.type === 'text').forEach((i) => { a[i.item_id] = '<script>x</script> 좋았어요'; });
  assert.equal(server.submitResponse(dl.course_id, dl.access_code, a).ok, true);
  const decode = (r) => Buffer.from(r.base64, 'base64').toString('utf8');
  const raw = server.exportPdf(s, dl.course_id, 'raw');
  assert.equal(raw.ok, true);
  assert.equal(raw.mime, 'application/pdf');
  assert.match(raw.filename, /원자료\.pdf$/);
  const rawHtml = decode(raw);
  assert.match(rawHtml, /^%PDF-MOCK application\/pdf/);
  assert.match(rawHtml, /강의평가 원자료/);
  assert.match(rawHtml, /디지털리터러시와 AI활용/);
  assert.match(rawHtml, /Q28/, '28문항 번호표');
  assert.equal((rawHtml.match(/<tr><td class="n">31<\/td>/g) || []).length >= 1, true, '응답 31행');
  assert.ok(!rawHtml.includes('<script>x</script>'), 'HTML 이스케이프');
  assert.ok(rawHtml.includes('&lt;script&gt;'));
  assert.equal(server.exportPdf(s, dl.course_id, 'cqi').code, 'VALIDATION', 'CQI 요약표 PDF는 결과 보고서로 통합');
  const rep = decode(server.exportPdf(s, dl.course_id, 'report'));
  assert.match(rep, /영역별 결과/);
  assert.match(rep, /강점/);
  assert.match(rep, /SD /, '강점·개선점 표준편차');
  assert.match(rep, /개선 계획/);
  assert.match(rep, /해석 기준/);
  const text = decode(server.exportPdf(s, dl.course_id, 'text'));
  assert.match(text, /서술형 응답 \(보고·인쇄용\)/);
  assert.match(text, /AI 요약 요청 문구/);
  assert.match(text, /AI 요약 결과/);
  assert.match(text, /학교 공식 강의평가가 아닌/);
  assert.equal(server.exportPdf(s, dl.course_id, 'xls').code, 'VALIDATION');
  assert.equal(server.exportPdf('', dl.course_id, 'raw').code, 'AUTH');
});

test('샘플 응답: 모든 예시 교과목 생성, 교과목별 열 범위 안내, 응답 시트 머리글 교과목별 색·메모, A~C열 고정', () => {
  const { env, server } = H.makeServer({ pin: PIN });
  const r = server.generateSampleResponses();
  assert.equal(r.created, 90);
  // 안내 메시지용 열 범위: 두 교과목이 서로 겹치지 않는 연속 범위
  assert.equal(r.where.length, 3);
  const [dl, ai] = r.where;
  assert.equal(dl.course, '디지털리터러시와 AI활용');
  assert.equal(dl.from, 'D');
  const colNum = (s) => s.split('').reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0);
  assert.equal(colNum(dl.to) - colNum(dl.from) + 1, 28, '대면 28문항');
  assert.equal(colNum(ai.from), colNum(dl.to) + 1, 'AI융합 열은 바로 오른쪽부터');
  assert.equal(colNum(ai.to) - colNum(ai.from) + 1, 32, '혼합 32문항');
  // 실제 값: 각 교과목 행은 자기 범위에서 모두 채워짐
  const t = server.readTable_('Responses');
  server.getCourses_().forEach((c, k) => {
    const w = r.where[k];
    const cols = t.headers.slice(colNum(w.from) - 1, colNum(w.to));
    const rows = t.rows.filter((x) => x.course_id === c.course_id);
    assert.equal(rows.length, 30);
    assert.ok(rows.every((x) => cols.every((h) => x[h] !== '' && x[h] != null)), c.course_name + ' 값 채움');
  });
  // 머리글: 교과목별 색이 다르고 메모에 교과목명
  const sh = env.__store.read().sheets.Responses;
  assert.equal(sh.frozenCols, 3, 'A~C열 고정');
  assert.match(sh.notes['1,4'], /^\[디지털리터러시와 AI활용\] \[A\. 강의 설계\]/);
  assert.match(sh.notes['1,' + colNum(ai.from)], /^\[AI융합 간호정보학\]/);
  assert.notEqual(sh.bgs['1,4'], sh.bgs['1,' + colNum(ai.from)], '교과목별 머리글 색');
  assert.equal(server.colLetter_(28), 'AB');
  assert.equal(server.colLetter_(63), 'BK');
});

test('서술형 AI 분석: 범위(문항별) TXT·PDF, 잘못된 문항 거부, AI 요약 붙여넣기 PDF(이스케이프·5,000자), 간호교육 CQI 요청 문구', () => {
  const { server } = H.makeServer({ pin: PIN });
  const s = H.login(server, PIN);
  server.generateSampleResponses();
  const [dl] = server.getCourses_();
  const textItems = server.itemsForCourse_(server.findCourse_(dl.course_id)).filter((i) => i.type === 'text');
  const all = server.exportText(s, dl.course_id);
  assert.equal((all.content.match(/^■ /gm) || []).length, 3, '전체: 서술형 3문항');
  const one = server.exportText(s, dl.course_id, textItems[1].item_id);
  assert.equal((one.content.match(/^■ /gm) || []).length, 1, '범위: 1문항');
  assert.ok(one.content.includes(textItems[1].text));
  assert.match(one.filename, /서술형2\.txt$/);
  assert.equal(server.exportText(s, dl.course_id, 'nope1234').code, 'VALIDATION');
  ['간호학과 교과목의 CQI', '다음 학기 CQI 개선 과제 3가지', '학습성과(CLO)', '추측하지 말 것'].forEach((k) => assert.ok(all.content.includes(k), k));
  // 결과 화면에서 복사용으로 같은 문구 제공
  const prompt = server.getResults(s, dl.course_id).ai_prompt;
  assert.ok(prompt.includes('간호학과 교과목의 CQI') && all.content.includes(prompt), 'TXT와 같은 요청 문구');
  const decode = (r) => Buffer.from(r.base64, 'base64').toString('utf8');
  const blank = decode(server.exportPdf(s, dl.course_id, 'text'));
  assert.match(blank, /class="plan"/, '요약이 없으면 작성란');
  const sum = '1) 주요 주제: <b>실습</b>\n2) 개선: 피드백 ' + 'x'.repeat(6000);
  const pdf = server.exportPdf(s, dl.course_id, 'text', { itemId: textItems[0].item_id, aiSummary: sum });
  const html = decode(pdf);
  assert.ok(html.includes('1) 주요 주제: &lt;b&gt;실습&lt;/b&gt;<br>2) 개선'), '이스케이프·줄바꿈');
  assert.ok(!html.includes('x'.repeat(5001)), '5,000자 제한');
  assert.equal((html.match(/<h2>/g) || []).length, 2, '범위 1문항 + AI 요약 결과');
  assert.equal(server.exportPdf(s, dl.course_id, 'text', { itemId: 'bad' }).code, 'VALIDATION');
});

test('대시보드: 교과목별 오늘(한국 시간) 새 응답 수', () => {
  const { server } = H.makeServer({ pin: PIN });
  const s = H.login(server, PIN);
  const [dl, ai] = server.getCourses_();
  const items = server.itemsForCourse_(server.findCourse_(dl.course_id));
  for (let i = 0; i < 3; i++) assert.equal(server.submitResponse(dl.course_id, dl.access_code, H.fullAnswers(items)).ok, true);
  const cs = server.getAdminBootstrap(s).courses;
  assert.equal(cs.find((c) => c.course_id === dl.course_id).today_count, 3);
  assert.equal(cs.find((c) => c.course_id === ai.course_id).today_count, 0);
});

test('스프레드시트 사본에서 setup: 원본 배포의 학생용 주소를 비우고, 사본의 새 /exec 주소를 자동 저장(데이터·PIN 유지)', () => {
  const OLD = 'https://script.google.com/macros/s/AKfycbwOLDDEPLOY/exec';
  const NEW = 'https://script.google.com/macros/s/AKfycbwNEWCOPY/exec';
  const { env, server } = H.makeServer({ pin: PIN, url: OLD });
  server.doGet({ parameter: { page: 'admin' } });
  assert.equal(server.getSettingsMap_().webapp_url, OLD);
  server.setup();
  assert.equal(server.getSettingsMap_().sheet_id, 'SHEET-ORIGINAL');
  assert.equal(server.getSettingsMap_().webapp_url, OLD, '원본에서 setup 재실행은 주소 유지');
  const courses = server.getCourses_().map((c) => c.course_id + ':' + c.access_code);
  // 사본 만들기 재현: 같은 데이터, 다른 스프레드시트 ID, 사본 프로젝트는 아직 정식 배포 전(/dev만)
  const st = H.GasMock.revive(H.GasMock.serialize(env.__store.read())); st.sheetId = 'SHEET-COPY';
  const { env: cenv, server: cs } = H.makeServer({ setup: false, state: st, url: 'https://script.google.com/macros/s/AKfycbwNEWCOPY/dev' });
  cs.setup();
  assert.equal(cs.getSettingsMap_().webapp_url, '', '사본: 원본 배포 주소 비움');
  assert.equal(cs.getSettingsMap_().sheet_id, 'SHEET-COPY');
  assert.deepEqual(cs.getCourses_().map((c) => c.course_id + ':' + c.access_code), courses, '교과목·접속코드 유지');
  assert.equal(cs.adminLogin(PIN).ok, true, 'PIN 유지');
  // 사본에서 새 배포 주소로 첫 접속 → 자동 저장 → 학생 접속 주소가 새 주소
  const { server: copy } = H.makeServer({ setup: false, state: H.GasMock.revive(H.GasMock.serialize(cenv.__store.read())), url: NEW });
  copy.doGet({ parameter: { page: 'admin' } });
  assert.equal(copy.getSettingsMap_().webapp_url, NEW);
  const s2 = H.login(copy, PIN);
  assert.ok(copy.getAdminBootstrap(s2).courses.every((c) => c.base_url === NEW), '학생 접속 주소가 새 주소');
});

test('setup: v1.5 독립형 시험 설치의 흔적(script_id·webapp_script_id 행, 독립형 학생 주소) 정리', () => {
  const BOUND = 'https://script.google.com/macros/s/AKfycbwBOUND/exec';
  const { server } = H.makeServer({ pin: '246810', url: BOUND });
  server.setSetting_('webapp_url', 'https://script.google.com/macros/s/AKfycbwSTANDALONE/exec');
  server.setSetting_('script_id', 'SCRIPT-STANDALONE');
  server.setSetting_('webapp_script_id', 'SCRIPT-STANDALONE');
  server.setup();
  const set = server.getSettingsMap_();
  assert.ok(!('script_id' in set) && !('webapp_script_id' in set), '쓰지 않는 설정 행 삭제');
  assert.equal(set.webapp_url, BOUND, '독립형 주소를 지우고 이 프로젝트의 /exec 주소로 다시 저장');
  server.setup();
  assert.equal(server.getSettingsMap_().webapp_url, BOUND, '흔적이 없으면 setup 재실행해도 주소 유지');
});

test('QR 삭제 후 접속: 접속코드 방식은 코드가 꼭 있어야 함 — 저장·setup 시 빈 코드 자동 생성', () => {
  const { server } = H.makeServer({ pin: '246810' });
  const s = H.login(server, '246810');
  const id = H.createCourse(server, s, { access_mode: 'code', access_code: '' });
  const c = server.getCourses_().find((x) => x.course_id === id);
  assert.match(String(c.access_code), /^[A-Z0-9]{6}$/, '저장 시 자동 생성');
  assert.equal(server.findCourseByCode(c.access_code).course_id, id, '공통 주소에서 찾기');
  // 이전 버전에서 코드 없이 만든 교과목 → setup이 채움
  const col = server.HEADERS.Courses.indexOf('access_code') + 1;
  const t = server.readTable_('Courses');
  const row = t.rows.find((r) => r.course_id === id);
  t.sheet.getRange(row._row, col).setValue('');
  server.setup();
  const after = server.getCourses_().find((x) => x.course_id === id);
  assert.match(String(after.access_code), /^[A-Z0-9]{6}$/, 'setup 시 자동 생성');
  const codes = server.getCourses_().filter((x) => x.access_mode !== 'token').map((x) => String(x.access_code).toUpperCase());
  assert.equal(new Set(codes).size, codes.length, '코드 중복 없음');
});

test('setup: 기존 설정 행의 설명을 최신 문구로(값은 유지)', () => {
  const { server } = H.makeServer({ pin: '246810' });
  const t = server.readTable_('Settings');
  const row = t.rows.find((r) => r.key === 'webapp_url');
  t.sheet.getRange(row._row, 2, 1, 2).setValues([['https://script.google.com/macros/s/KEEP/exec', '학생 응답 링크·QR에 쓰는 웹 앱 주소']]);
  server.setup();
  const r2 = server.readTable_('Settings').rows.find((r) => r.key === 'webapp_url');
  assert.doesNotMatch(String(r2.description), /QR/);
  assert.equal(r2.value, 'https://script.google.com/macros/s/KEEP/exec');
});

test('이전 버전 링크(?c=·?k=·?t=): 교과목·코드를 화면에 넘기지 않고 안내 표시만', () => {
  const { server } = H.makeServer({ pin: '246810' });
  const demo = H.demoCourse(server);
  const legacy = server.doGet({ parameter: { c: demo.course_id, k: demo.access_code } }).getContent();
  assert.match(legacy, /data-legacy="1"/);
  assert.doesNotMatch(legacy, new RegExp(demo.access_code), '접속코드가 페이지에 들어가지 않음');
  assert.doesNotMatch(legacy, new RegExp('data-course="' + demo.course_id), '교과목 ID 미전달');
  assert.match(server.doGet({ parameter: { t: 'ABCDEF23' } }).getContent(), /data-legacy="1"/);
  assert.match(server.doGet({ parameter: {} }).getContent(), /data-legacy=""/, '공통 주소는 안내 없음');
});

test('수업 방식 이름 「비대면」→「온라인(비대면)」, 기존 시트에 「AI융합 간호정보학(전공심화과정)」 1회 추가', () => {
  const { server } = H.makeServer({ pin: '246810' });
  const s = H.login(server, '246810');
  // 이전 버전 시트: 전공심화과정 교과목 없음, 수업 방식 '비대면'
  const deep = server.getCourses_().find((c) => c.course_name === 'AI융합 간호정보학(전공심화과정)');
  assert.equal(deep.delivery_mode, '온라인(비대면)');
  assert.equal(deep.grade, '4');
  assert.ok(server.itemsForCourse_(deep).some((i) => i.scope === 'online'), '온라인 문항(H) 표시');
  assert.ok(server.findCourseByCode(deep.access_code).ok, '접속코드로 찾기');
  server.deleteCourse(s, deep.course_id);
  const t = server.readTable_('Courses');
  const col = server.HEADERS.Courses.indexOf('delivery_mode') + 1;
  t.sheet.getRange(t.rows[0]._row, col).setValue('비대면');
  assert.equal(server.getCourses_()[0].delivery_mode, '온라인(비대면)', '읽을 때 이전 이름도 현재 이름으로');
  server.setup();
  assert.equal(server.readTable_('Courses').rows[0].delivery_mode, '온라인(비대면)', 'setup이 시트 값 변경');
  assert.equal(server.getCourses_().filter((c) => c.course_name === 'AI융합 간호정보학(전공심화과정)').length, 0, '교수가 삭제한 교과목은 다시 만들지 않음');
  // 이전 버전 시트(추가 기록 없음)에는 1회 추가
  const st = server.readTable_('Settings');
  st.sheet.getRange(st.rows.find((r) => r.key === 'added_courses')._row, 2).setValue('');
  server.setup();
  assert.equal(server.getCourses_().filter((c) => c.course_name === 'AI융합 간호정보학(전공심화과정)').length, 1, '없으면 추가');
  server.setup();
  assert.equal(server.getCourses_().filter((c) => c.course_name === 'AI융합 간호정보학(전공심화과정)').length, 1, '중복 추가 없음');
  // 저장 시 이전 이름 입력도 받아 현재 이름으로 저장
  const id = H.createCourse(server, s, { delivery_mode: '비대면' });
  assert.equal(server.getCourses_().find((c) => c.course_id === id).delivery_mode, '온라인(비대면)');
  const codes = server.getCourses_().map((c) => String(c.access_code).toUpperCase()).filter(Boolean);
  assert.equal(new Set(codes).size, codes.length, '예시 교과목 접속코드 중복 없음');
});

test('새 학기 준비: 학기 교과목 일괄 복제(새 접속코드·문항 복사), 이전 학기 마감, 다시 실행해도 중복 없음', () => {
  const { server } = H.makeServer({ pin: '246810' });
  const s = H.login(server, '246810');
  const before = server.getCourses_();
  const src = before.filter((c) => c.year === 2026 && c.semester === '2');
  assert.ok(src.length >= 2, '2026-2학기 예시 교과목');
  const data = { from_year: 2026, from_semester: '2', year: 2027, semester: '1', start_at: '2027-04-01T09:00', end_at: '2027-04-15T23:59', close_old: true };
  const r = server.prepareNewTerm(s, data);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.made.length, src.length);
  assert.equal(r.closed, src.length);
  const after = server.getCourses_();
  const made = after.filter((c) => c.year === 2027 && c.semester === '1');
  assert.deepEqual(made.map((c) => c.course_name).sort(), src.map((c) => c.course_name).sort());
  made.forEach((c) => {
    const o = src.find((x) => x.course_name === c.course_name);
    assert.equal(c.delivery_mode, o.delivery_mode);
    assert.equal(server.getItems_(c.course_id).length, server.getItems_(o.course_id).length, '문항 복사');
    assert.notEqual(c.access_code, o.access_code, '새 접속코드');
  });
  const codes = after.map((c) => String(c.access_code).toUpperCase()).filter(Boolean);
  assert.equal(new Set(codes).size, codes.length, '접속코드 중복 없음');
  // 이전 학기 마감 → 이전 코드로 찾아도 마감 안내
  assert.ok(src.every((o) => server.getCourses_().find((c) => c.course_id === o.course_id).status === '마감'));
  // 다시 실행: 건너뜀
  const again = server.prepareNewTerm(s, data);
  assert.deepEqual([again.made.length, again.skipped.length], [0, src.length]);
  // 같은 학기로는 불가, 빈 학기 불가, 로그인 필요
  assert.equal(server.prepareNewTerm(s, Object.assign({}, data, { year: 2026, semester: '2' })).code, 'VALIDATION');
  assert.equal(server.prepareNewTerm(s, Object.assign({}, data, { from_year: 2019 })).code, 'VALIDATION');
  assert.equal(server.prepareNewTerm('nope', data).code, 'AUTH');
});

test('전공심화과정: 2026-2학기, 실무 적용 문항 2개(I 영역, 서술형 앞), 기존 교과목엔 응답 없을 때 1회만', () => {
  const { server } = H.makeServer({ pin: '246810' });
  const deep = server.getCourses_().find((c) => c.course_name === 'AI융합 간호정보학(전공심화과정)');
  assert.deepEqual([deep.year, deep.semester, deep.grade, deep.course_type, deep.delivery_mode], [2026, '2', '4', '이론+실습', '온라인(비대면)']);
  const items = server.itemsForCourse_(deep);
  assert.equal(items.length, 34, '32 + 실무 적용 2');
  const doms = items.map((i) => i.domain);
  const iIdx = doms.map((d, k) => (d === 'I. 실무 적용' ? k : -1)).filter((k) => k >= 0);
  assert.equal(iIdx.length, 2, 'I. 실무 적용 2문항');
  assert.match(items[iIdx[0]].text, /임상 현장에 적용/);
  assert.match(items[iIdx[1]].text, /효율성/);
  assert.equal(doms[iIdx[0] - 1], 'H. 온라인(비대면) 강의', 'H 영역 바로 뒤');
  assert.equal(doms[iIdx[1] + 1], '서술형', '서술형 바로 앞');
  assert.ok(!items.some((i) => i.domain === 'F. 디지털·AI 활용' && /임상 현장에 적용|효율성을 높이/.test(i.text)), 'F 영역에는 없음');
  // 결과 화면에서도 영역으로 분리
  const s0 = H.login(server, '246810');
  server.generateSampleResponses();
  const res = server.getResults(s0, deep.course_id);
  assert.ok(res.ok && res.stats.domains.some((d) => d.domain === 'I. 실무 적용' && d.item_count === 2), '결과 영역 I');
  server.deleteSampleData(true);
  // 이전 버전(v1.4.5)처럼 F 영역에 들어간 경우 → setup이 I 영역으로 옮김
  const t = server.readTable_('Items');
  const dcol = t.headers.indexOf('domain') + 1;
  t.rows.filter((r) => r.course_id === deep.course_id && /임상 현장에 적용|효율성을 높이/.test(r.text)).forEach((r) => t.sheet.getRange(r._row, dcol).setValue('F. 디지털·AI 활용'));
  server.setup();
  const moved = server.itemsForCourse_(deep);
  assert.equal(moved.filter((i) => i.domain === 'I. 실무 적용').length, 2, 'F → I 이동');
  assert.equal(moved.length, 34);
  assert.equal(moved[moved.length - 4].domain, 'I. 실무 적용', '서술형 앞 위치');
  // CLO는 AI융합 간호정보학과 동일
  const base = server.getCourses_().find((c) => c.course_name === 'AI융합 간호정보학');
  const clo = (c) => server.getItems_(c.course_id).filter((i) => i.domain === 'D. 학습성과(CLO)').map((i) => i.text);
  assert.deepEqual(clo(deep), clo(base));
  // 문항을 지우고 setup → 다시 넣지 않음
  const s = H.login(server, '246810');
  const kept = server.getItems_(deep.course_id).filter((i) => !/임상 현장에 적용|효율성을 높이/.test(i.text));
  assert.equal(server.saveItems(s, deep.course_id, kept).ok, true);
  server.setup();
  assert.equal(server.itemsForCourse_(deep).length, 32, '교수가 지운 문항은 다시 넣지 않음');
});

test('단축 주소 기능 삭제: setup이 short_url·short_url_target 행을 지우고 학생 주소는 유지', () => {
  const EXEC = 'https://script.google.com/macros/s/AKfycbwKEEP/exec';
  const { server } = H.makeServer({ pin: '246810', url: EXEC });
  server.setSetting_('short_url', 'https://tinyurl.com/abc123');
  server.setSetting_('short_url_target', EXEC);
  server.setup();
  const set = server.getSettingsMap_();
  assert.ok(!('short_url' in set) && !('short_url_target' in set), '단축 주소 설정 행 삭제');
  assert.equal(set.webapp_url, EXEC, '학생 주소 유지');
  assert.equal(typeof server.createShortUrl, 'undefined', '단축 주소 API 없음');
  const s = H.login(server, '246810');
  assert.ok(!('short_url' in server.getAdminBootstrap(s).settings));
});

test('결과 보고서 PDF(매뉴얼형): 장 구성·강점/개선점 상자·안전한 차트 그림만 포함', () => {
  const { server } = H.makeServer({ pin: '246810' });
  const s = H.login(server, '246810');
  server.generateSampleResponses();
  const demo = H.demoCourse(server);
  const png = 'data:image/png;base64,' + Buffer.from('fakepng').toString('base64');
  const r = server.exportPdf(s, demo.course_id, 'report', {
    images: { radar: png, wordcloud: png, semester: 'javascript:alert(1)', section: 'data:image/svg+xml;base64,PHN2Zz4=', evil: png },
    aiSummary: '<b>주요 주제</b>: 실습 확대'
  });
  assert.equal(r.ok, true);
  assert.match(r.filename, /_결과보고서\.pdf$/);
  const html = Buffer.from(r.base64, 'base64').toString('utf8');
  for (const t of ['강의평가 결과 보고서', '담당 교수', '한눈에 보기', '영역별 결과', '문항별 결과', '서술형 응답', 'CQI 요약', 'class="good"', 'class="improve"', '다음 학기 개선 계획']) assert.ok(html.includes(t), t);
  assert.equal((html.match(/<img src="data:image\/png;base64,/g) || []).length, 2, '형식이 맞는 그림 2개만');
  assert.ok(!html.includes('javascript:') && !html.includes('svg+xml'), '위험한 그림 제외');
  assert.ok(html.includes('&lt;b&gt;주요 주제&lt;/b&gt;'), 'AI 요약 이스케이프');
  // 그림 없이도 생성(차트가 없는 교과목)
  assert.equal(server.exportPdf(s, demo.course_id, 'report').ok, true);
  // 너무 큰 그림은 제외
  const big = 'data:image/png;base64,' + 'A'.repeat(3 * 1024 * 1024 + 10);
  const r2 = server.exportPdf(s, demo.course_id, 'report', { images: { radar: big } });
  assert.ok(!Buffer.from(r2.base64, 'base64').toString('utf8').includes('<img'), '3MB 초과 제외');
});

test('결과공개일(선택): 비워 두면 응답 중에도 바로 공개, 정하면 그날 전까지 잠금, 최소 응답 수 잠금은 유지', () => {
  const { server } = H.makeServer({ pin: '246810' });
  const s = H.login(server, '246810');
  const id = H.createCourse(server, s, { result_open_date: '' }); // 응답 기간 진행 중
  const ans = () => server.submitResponse(id, H.codeOf(server, id), H.fullAnswers(server.itemsForCourse_(server.findCourse_(id))));
  for (let i = 0; i < 4; i++) ans();
  assert.equal(server.getResults(s, id).reason, 'MIN_RESPONSES', '5명 미만은 익명성 보호로 잠금');
  ans();
  const r = server.getResults(s, id);
  assert.equal(r.locked, false, '응답 중에도 5명 이상이면 공개');
  assert.equal(server.getAdminBootstrap(s).courses.find((c) => c.course_id === id).locked_reason, null);
  const c = server.findCourse_(id);
  const base = { course_id: id, course_name: c.course_name, year: c.year, semester: c.semester, grade: c.grade, department: c.department,
    delivery_mode: c.delivery_mode, course_type: c.course_type, start_at: H.iso(c.start_at), end_at: H.iso(c.end_at), access_mode: 'code', access_code: c.access_code };
  assert.equal(server.saveCourse(s, Object.assign({}, base, { result_open_date: '2099-01-01' })).ok, true);
  assert.equal(server.getResults(s, id).reason, 'BEFORE_OPEN_DATE', '날짜를 정하면 그날 전까지 잠금');
  assert.equal(server.saveCourse(s, Object.assign({}, base, { result_open_date: '' })).ok, true);
  assert.equal(server.getResults(s, id).locked, false, '다시 비우면 바로 공개');
  // setup은 결과공개일을 채우지 않음(예시 교과목도 비어 있음 = 바로 공개)
  assert.ok(server.getCourses_().filter((x) => /^demo/.test(x.course_id)).every((x) => !x.result_open_date));
  assert.ok(!('open_date_default_applied' in server.getSettingsMap_()));
});

test('응답 추이: 진행 중 교과목의 날짜별 응답 수(시작일~오늘), 내용·시각 없음, 오래전 마감 교과목은 제외', () => {
  const { server } = H.makeServer({ pin: '246810' });
  const s = H.login(server, '246810');
  const now = Date.now();
  const id = H.createCourse(server, s, { start_at: H.iso(new Date(now - 2 * 86400000)), end_at: H.iso(new Date(now + 5 * 86400000)) });
  for (let i = 0; i < 3; i++) server.submitResponse(id, H.codeOf(server, id), H.fullAnswers(server.itemsForCourse_(server.findCourse_(id))));
  const c = server.getAdminBootstrap(s).courses.find((x) => x.course_id === id);
  assert.equal(c.timeline.length, 3, '시작일부터 오늘까지 3일');
  assert.deepEqual(c.timeline.map((x) => x.n), [0, 0, 3], '오늘 3명');
  assert.ok(c.timeline.every((x) => Object.keys(x).join() === 'd,n' && /^\d{4}-\d{2}-\d{2}$/.test(x.d)), '날짜·개수만');
  const old = H.createCourse(server, s, { start_at: '2025-03-01T09:00', end_at: '2025-03-10T23:59' });
  assert.deepEqual(server.getAdminBootstrap(s).courses.find((x) => x.course_id === old).timeline, [], '오래전 마감은 제외');
  H.GasMock.assertSerializable(server.getAdminBootstrap(s));
});
