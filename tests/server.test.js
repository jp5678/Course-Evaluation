'use strict';
/* 서버 로직 통합 테스트 (node --test) */
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./helpers');

const PIN = '246810';

test('setup: 탭·헤더·기본 문항 은행·이번 학기 교과목 예시 2개·시트 보호(재실행해도 중복 없음)', () => {
  const { env, server } = H.makeServer();
  const st = env.__store.read();
  for (const name of ['Settings', 'Courses', 'Items', 'Tokens', 'Responses']) {
    assert.ok(st.sheets[name], name + ' 탭');
    assert.deepEqual(st.sheets[name].values[0].slice(0, server.HEADERS[name].length), server.HEADERS[name]);
  }
  const tpl = server.getItems_('TEMPLATE');
  assert.equal(tpl.length, 25, '리커트 21 + 서술형 3 + 드롭다운 1');
  const doms = [...new Set(tpl.map((i) => i.domain))];
  assert.deepEqual(doms, ['A. 강의 설계', 'B. 교수학습방법', 'C. 평가 및 과제', 'E. 학습 환경', 'F. 디지털·AI 활용', 'G. 종합', 'H. 온라인(비대면) 강의', '서술형', '응답자 정보']);
  assert.ok(tpl.some((i) => /유무선 인터넷/.test(i.text)) && tpl.some((i) => /실습실의 시설/.test(i.text)) && tpl.some((i) => /이론 강의실/.test(i.text)), '학습 환경 문항');
  assert.equal(tpl.filter((i) => i.scope === 'online').length, 4, '온라인 전용 문항 4개');
  assert.match(tpl.find((i) => i.scope === 'theory').text, /^이론 강의실/);
  assert.match(tpl.find((i) => i.scope === 'practice').text, /^실습실의 시설/);
  assert.equal(tpl.find((i) => /유무선 인터넷/.test(i.text)).scope, '', '인터넷 문항은 항상 표시');
  const gender = tpl.find((i) => i.type === 'select');
  assert.deepEqual(gender.options, ['남', '여']);
  assert.ok(tpl.every((i) => i.required === true), '모든 문항 필수(서술형·성별 포함)');

  const s = server.getSettingsMap_();
  assert.equal(s.professor_name, '정종필');
  assert.equal(s.affiliation, '청암대학교 간호학과');
  const cs = server.getCourses_();
  assert.deepEqual(cs.map((c) => [c.course_name, c.grade, c.section, c.department, c.delivery_mode]),
    [['디지털리터러시와 AI활용', '1', 'A', '간호학과', '대면'], ['AI융합 간호정보학', '3', 'A', '간호학과', '혼합']]);
  assert.ok(cs.every((c) => c.course_type === '이론+실습'), '예시 교과목 유형');
  assert.deepEqual(cs.map((c) => [c.year, c.semester]), [[2026, '1'], [2026, '2']], '디지털리터러시와 AI활용=1학기, AI융합 간호정보학=2학기');
  assert.ok(cs.every((c) => server.itemsForCourse_(c).every((i) => i.required)), '예시 교과목 문항도 모두 필수');
  assert.equal(server.itemsForCourse_(cs[0]).length, 23, '대면: 온라인 문항 제외 + CLO 2');
  assert.equal(server.itemsForCourse_(cs[1]).length, 27, '혼합: 온라인 문항 포함');
  assert.equal(st.sheets.Responses.protections[0].warningOnly, true, 'Responses 경고 보호');
  assert.equal(st.sheets.Tokens.protections[0].warningOnly, true, 'Tokens 경고 보호');

  server.setup();
  assert.equal(server.getItems_('TEMPLATE').length, 25, '재실행 시 문항 중복 없음');
  assert.equal(server.getCourses_().length, 2, '재실행 시 교과목 중복 없음');
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
  assert.equal(v.items.length, 23);

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
  assert.equal(server.verifyAccess(future, 'ABC123').code, 'NOT_STARTED');
  assert.equal(server.submitResponse(future, 'ABC123', {}).code, 'NOT_STARTED');

  assert.equal(server.getCourseForStudent(past).state, '마감');
  assert.equal(server.verifyAccess(past, 'ABC123').code, 'CLOSED');
  assert.equal(server.submitResponse(past, 'ABC123', {}).code, 'CLOSED');

  const c = server.getAdminBootstrap(s).courses.find((x) => x.course_id === open);
  assert.equal(c.status, '진행');
  const upd = server.saveCourse(s, Object.assign({}, c, { manual_close: true }));
  assert.equal(upd.ok, true);
  assert.equal(server.getCourseForStudent(open).state, '마감', '수동 마감');
  assert.equal(server.submitResponse(open, 'ABC123', {}).code, 'CLOSED');

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
  for (let i = 0; i < 4; i++) assert.equal(server.submitResponse(id, 'ABC123', H.fullAnswers(items, 3 + (i % 3))).ok, true);

  let r = server.getResults(s, id);
  assert.equal(r.locked, true);
  assert.equal(r.reason, 'MIN_RESPONSES');
  assert.equal(r.n, 4);
  assert.equal(r.stats, undefined, '잠금 시 통계 미포함');
  for (const fn of ['exportCsv', 'exportCqi', 'exportText']) assert.equal(server[fn](s, id).locked, true, fn + ' 잠금');
  assert.equal(server.getAdminBootstrap(s).courses.find((c) => c.course_id === id).mean, null);

  assert.equal(server.submitResponse(id, 'ABC123', H.fullAnswers(items, 5)).ok, true);
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
  for (let i = 0; i < 2; i++) server.submitResponse(idB, 'ABC123', H.fullAnswers(itemsB, 2));
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
  for (let i = 0; i < 6; i++) server.submitResponse(id, 'ABC123', H.fullAnswers(items));
  const r = server.getResults(s, id);
  assert.equal(r.reason, 'BEFORE_OPEN_DATE');
  assert.equal(r.open_date, tomorrow);
});

test('역문항 환산, 서술형 무작위 순서, CQI·CSV 내보내기', () => {
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
    server.submitResponse(id, 'ABC123', a);
  }
  const r = server.getResults(s, id);
  assert.equal(r.stats.items[0].mean, 5, '역문항 환산');
  assert.deepEqual(r.stats.items[0].dist, [8, 0, 0, 0, 0], '분포는 원점수');
  const orders = new Set();
  for (let k = 0; k < 10; k++) orders.add(server.getResults(s, id).texts[0].answers.join('|'));
  assert.ok(orders.size > 1, '서술형 순서가 호출마다 무작위');

  const csv = server.exportCsv(s, id);
  assert.equal(csv.ok, true);
  assert.equal(csv.content.split('\r\n').length, 9);
  assert.ok(!/response_id|[0-9a-f]{8}-[0-9a-f]{4}/.test(csv.content), 'CSV에 응답 ID 없음');
  const cqi = server.exportCqi(s, id);
  assert.ok(cqi.content.includes('강점') && cqi.content.includes('개선점'));
  const txt = server.exportText(s, id);
  assert.ok(txt.content.includes('응답0') && txt.content.includes('AI 요약 요청 예시'));
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

  server.submitResponse(id, 'ABC123', H.fullAnswers(server.getItems_(id)));
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

test('샘플 응답(교과목별 30건) 생성·삭제, 실제 응답이 있는 예시 교과목은 보존', () => {
  const { env, server } = H.makeServer({ pin: PIN });
  const r = server.generateSampleResponses();
  assert.equal(r.ok, true);
  assert.equal(r.created, 60);
  assert.equal(H.table(env, 'Responses').filter((x) => String(x.response_id).startsWith('SAMPLE-')).length, 60);
  const s = H.login(server, PIN);
  const [c1, c2] = server.getCourses_();
  assert.equal(server.getResults(s, c1.course_id).n, 30);
  // 예시 교과목 2로 실제 응답 1건이 들어왔다고 가정
  server.submitResponse(c2.course_id, c2.access_code, H.fullAnswers(server.itemsForCourse_(c2)));
  const d = server.deleteSampleData(true);
  assert.equal(d.removed, 60);
  assert.equal(d.keptCourses, 1);
  assert.equal(H.table(env, 'Responses').length, 1, '실제 응답 보존');
  assert.deepEqual(server.getCourses_().map((c) => c.course_name), ['AI융합 간호정보학']);
});

test('수업 방식: 대면은 온라인 문항 숨김, 비대면으로 바꾸면 온라인 문항 추가(응답 전)', () => {
  const { server } = H.makeServer({ pin: PIN });
  const s = H.login(server, PIN);
  const id = H.createCourse(server, s, { delivery_mode: '대면' });
  const c = () => server.findCourse_(id);
  assert.equal(server.itemsForCourse_(c()).filter((i) => i.scope === 'online').length, 0);
  assert.equal(server.verifyAccess(id, 'ABC123').items.some((i) => /온라인/.test(i.domain)), false);
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
  assert.equal(server.verifyAccess(theory, 'ABC123').items.some((i) => /^실습실/.test(i.text)), false, '학생 화면에서도 제외');
  assert.equal(server.getAdminBootstrap(s).courses.find((c) => c.course_id === theory).item_count, visible(theory).length);
  // 숨긴 문항은 제출 검증·결과에도 나타나지 않음
  const items = server.itemsForCourse_(server.findCourse_(theory));
  for (let i = 0; i < 5; i++) server.submitResponse(theory, 'ABC123', H.fullAnswers(items));
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
  server.submitResponse(id, 'ABC123', H.fullAnswers(server.itemsForCourse_(server.findCourse_(id))));
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

test('성별(드롭다운): 소규모 집단이면 비교·인원·CSV 열 모두 숨김, 충분하면 집단별 평균', () => {
  const { server } = H.makeServer({ pin: PIN });
  const s = H.login(server, PIN);
  const id = H.createCourse(server, s);
  const items = server.itemsForCourse_(server.findCourse_(id));
  const g = items.find((i) => i.type === 'select');
  const submit = (sex, v) => { const a = H.fullAnswers(items, v); a[g.item_id] = sex; return server.submitResponse(id, 'ABC123', a); };
  for (let i = 0; i < 8; i++) submit('여', 4);
  submit('남', 2); // 남 1명 → 특정 위험
  let r = server.getResults(s, id);
  assert.equal(r.groups[0].suppressed, true);
  assert.equal(r.groups[0].groups, undefined, '수치 없음');
  const st = r.stats.items.find((x) => x.type === 'select');
  assert.equal(st.options, undefined, '인원 분포도 숨김');
  const csv = server.exportCsv(s, id);
  assert.equal(csv.omitted, 1);
  assert.ok(!csv.content.includes('성별'), 'CSV에서 성별 열 제외');

  for (let i = 0; i < 4; i++) submit('남', 3);
  r = server.getResults(s, id);
  assert.equal(r.groups[0].suppressed, false);
  const byLabel = Object.fromEntries(r.groups[0].groups.map((x) => [x.label, x]));
  assert.equal(byLabel['여'].n, 8);
  assert.equal(byLabel['남'].n, 5);
  assert.equal(byLabel['여'].overall, 4);
  assert.equal(byLabel['남'].overall, 2.8); // (2 + 3*4) / 5
  assert.equal(server.exportCsv(s, id).omitted, 0);
  // 성별은 필수: 비워 두면 제출 거부
  const a = H.fullAnswers(items, 1); a[g.item_id] = '';
  assert.deepEqual(server.submitResponse(id, 'ABC123', a).missing, [g.item_id]);

  // 교수가 성별을 선택 응답으로 바꾼 교과목: 미응답 집단이 소규모여도 숨김(전체 평균과의 차로 역산 가능)
  const id2 = H.createCourse(server, s);
  const items2 = server.getItems_(id2).map((x) => (x.type === 'select' ? Object.assign({}, x, { required: false }) : x));
  assert.equal(server.saveItems(s, id2, items2).ok, true);
  const its2 = server.itemsForCourse_(server.findCourse_(id2));
  const g2 = its2.find((i) => i.type === 'select');
  const sub2 = (sex) => { const x = H.fullAnswers(its2); x[g2.item_id] = sex; return server.submitResponse(id2, 'ABC123', x); };
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
    server.submitResponse(id, 'ABC123', a);
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
    server.getResults(s, demo.course_id), server.exportCsv(s, demo.course_id), server.exportCqi(s, demo.course_id),
    server.exportText(s, demo.course_id), server.generateTokens(s, demo.course_id, 2)
  ];
  calls.forEach((r) => { assert.equal(r.ok, true, JSON.stringify(r).slice(0, 200)); H.GasMock.assertSerializable(r); });
});

test('doGet: 템플릿 렌더링, 파라미터 이스케이프, 관리자 라우팅', () => {
  const { server } = H.makeServer({ pin: PIN });
  const html = server.doGet({ parameter: { c: '"><script>alert(1)</script>', t: '<b>ab-cd</b>' } }).getContent();
  assert.ok(!html.includes('<script>alert(1)'), 'c 파라미터 XSS 차단');
  assert.ok(html.includes('data-course="scriptalert1script"'));
  assert.ok(html.includes('data-token="BABCDB"'));
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
  assert.ok(b.courses.every((c) => c.link === ''));

  const base = { professor_name: '정종필', affiliation: '청암대학교 간호학과', min_responses: 5, departments: '간호학과' };
  let r = server.saveSettings(s, Object.assign({}, base, { webapp_url: DEV }));
  assert.equal(r.field, 'webapp_url', '/dev 주소는 저장 거부');
  assert.equal(server.saveSettings(s, Object.assign({}, base, { webapp_url: 'https://evil.example.com/exec' })).field, 'webapp_url');
  assert.equal(server.saveSettings(s, Object.assign({}, base, { webapp_url: EXEC + '?page=admin' })).ok, true, '쿼리는 떼고 저장');
  b = server.getAdminBootstrap(s);
  assert.equal(b.webAppUrl, EXEC);
  assert.ok(b.courses.every((c) => c.link.startsWith(EXEC + '?c=')));
  assert.equal(server.generateTokens(s, b.courses[0].course_id, 1).course.link.startsWith(EXEC), true, '토큰 시트 링크도 /exec');
  // Workspace 도메인 형식도 허용
  assert.equal(server.saveSettings(s, Object.assign({}, base, { webapp_url: 'https://script.google.com/a/macros/cheongam.ac.kr/s/AKfyc123/exec' })).ok, true);
});

test('학생 링크 주소: /exec로 실행되면 setup·doGet이 주소를 자동 기억', () => {
  const EXEC = 'https://script.google.com/macros/s/NEWDEPLOY9/exec';
  const { env, server } = H.makeServer({ url: EXEC });
  assert.equal(server.getSettingsMap_().webapp_url, EXEC, 'setup 시 기억');
  // 배포를 새로 만들어 주소가 바뀌면 다음 접속 때 갱신
  const env2 = H.GasMock.createEnv({ state: env.__store.read(), url: 'https://script.google.com/macros/s/OTHER77/exec', fastSleep: true, readFile: H.readFile, console: { log() {}, error() {} } });
  const s2 = H.GasMock.loadServer(env2, H.SOURCES);
  s2.doGet({ parameter: { page: 'admin' } });
  assert.equal(s2.getSettingsMap_().webapp_url, 'https://script.google.com/macros/s/OTHER77/exec');
  // /dev로 접속해도 기억된 /exec 주소는 지워지지 않음
  const env3 = H.GasMock.createEnv({ state: env2.__store.read(), url: 'https://script.google.com/macros/s/OTHER77/dev', fastSleep: true, readFile: H.readFile, console: { log() {}, error() {} } });
  const s3 = H.GasMock.loadServer(env3, H.SOURCES);
  s3.doGet({ parameter: {} });
  assert.equal(s3.studentBaseUrl_(s3.getSettingsMap_()), 'https://script.google.com/macros/s/OTHER77/exec');
});
