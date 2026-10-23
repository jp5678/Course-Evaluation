'use strict';
/* 서버 로직 통합 테스트 (node --test) */
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./helpers');

const PIN = '246810';

test('setup: 탭·헤더·기본 문항·샘플 교과목·시트 보호 생성(재실행해도 중복 없음)', () => {
  const { env, server } = H.makeServer();
  const st = env.__store.read();
  for (const name of ['Settings', 'Courses', 'Items', 'Tokens', 'Responses']) {
    assert.ok(st.sheets[name], name + ' 탭');
    assert.deepEqual(st.sheets[name].values[0].slice(0, server.HEADERS[name].length), server.HEADERS[name]);
  }
  const tpl = server.getItems_('TEMPLATE');
  assert.equal(tpl.length, 15, '기본 문항 15개(리커트 12 + 서술형 3)');
  assert.equal(tpl.filter((i) => i.type === 'likert5').length, 12);
  const demo = H.demoCourse(server);
  assert.ok(demo, '샘플 교과목');
  const demoItems = server.getItems_(demo.course_id);
  assert.equal(demoItems.length, 17, '기본 15 + CLO 2');
  assert.equal(demoItems.filter((i) => i.domain.startsWith('D.')).length, 2);
  assert.ok(demoItems.findIndex((i) => i.domain.startsWith('D.')) > demoItems.findIndex((i) => i.domain.startsWith('C.')), 'CLO는 C 영역 뒤');
  assert.equal(st.sheets.Responses.protections[0].warningOnly, true, 'Responses 경고 보호');
  assert.equal(st.sheets.Tokens.protections[0].warningOnly, true, 'Tokens 경고 보호');

  server.setup();
  assert.equal(server.getItems_('TEMPLATE').length, 15, '재실행 시 문항 중복 없음');
  assert.equal(server.getCourses_().length, 1, '재실행 시 교과목 중복 없음');
  assert.equal(server.getSettingsMap_().min_responses, 5, '최소 공개 응답 수 기본 5');
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
  assert.equal(v.items.length, 17);

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

test('샘플 응답 30건 생성·삭제', () => {
  const { env, server } = H.makeServer({ pin: PIN });
  const r = server.generateSampleResponses();
  assert.equal(r.ok, true);
  assert.equal(H.table(env, 'Responses').filter((x) => String(x.response_id).startsWith('SAMPLE-')).length, 30);
  const s = H.login(server, PIN);
  const demo = H.demoCourse(server);
  const res = server.getResults(s, demo.course_id);
  assert.equal(res.locked, false);
  assert.equal(res.n, 30);
  const d = server.deleteSampleData(true);
  assert.equal(d.removed, 30);
  assert.equal(H.table(env, 'Responses').length, 0);
  assert.equal(H.demoCourse(server), undefined);
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
