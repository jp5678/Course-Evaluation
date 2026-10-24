'use strict';
/* 브라우저 UI 테스트(Playwright + Chromium) — 360px 모바일 우선, 데스크톱·다크 모드·모션 최소화 포함 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const P = require('./preview-server');

let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

const OUT = path.join(__dirname, 'output');
fs.mkdirSync(OUT, { recursive: true });
let srv, base, browser;
const consoleErrors = [];

test.before(async () => {
  srv = await P.start(0);
  base = `http://127.0.0.1:${srv.address().port}/exec`;
  browser = await chromium.launch();
});
test.after(async () => { await browser.close(); srv.close(); });

async function newPage(opts = {}) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, locale: 'ko-KR', timezoneId: 'Asia/Seoul' }, opts));
  await ctx.route('https://cdn.jsdelivr.net/**', (route) => {
    const file = P.cdnToLocal(route.request().url());
    if (!file) return route.fulfill({ status: 404, body: '' });
    route.fulfill({ status: 200, contentType: P.MIME[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
  });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
  return page;
}

async function noHorizontalScroll(page, label) {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }));
  assert.ok(r.sw <= r.w, `${label}: 가로 스크롤 발생 (scrollWidth ${r.sw} > ${r.w})`);
}

// 등장 애니메이션(최대 ~0.9초)이 끝난 상태를 캡처
const shot = async (page, name) => { await page.waitForTimeout(900); await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: true }); };

/** 설문 끝까지 응답(리커트는 칩 클릭, 서술형은 입력 후 다음) */
async function answerAll(page, opts = {}) {
  for (let guard = 0; guard < 40; guard++) {
    if (await page.locator('#rv').count()) return;
    await page.waitForSelector('#questions .q-card');
    const cards = page.locator('#questions .q-card');
    const n = await cards.count();
    const stepText = await page.locator('.survey-head .num').innerText();
    for (let i = 0; i < n; i++) {
      const card = cards.nth(i);
      if (await card.locator('.likert').count()) {
        if (await card.locator('[aria-checked="true"]').count()) continue;
        if (opts.keyboardFirst && guard === 0 && i === 0) await page.keyboard.press('5');
        else await card.locator('.chip').nth(3).click();
      } else if (await card.locator('select[data-select]').count()) {
        await card.locator('select[data-select]').selectOption({ index: 1 });
      } else if (await card.locator('textarea').count()) {
        await card.locator('textarea').fill('실습 위주라 좋았습니다');
      }
    }
    // 모바일 리커트는 자동 이동, 그 외에는 [다음]
    await page.waitForTimeout(450);
    if (await page.locator('#rv').count()) return;
    const after = await page.locator('.survey-head .num').innerText().catch(() => '');
    if (after === stepText) await page.getByRole('button', { name: /다음|검토하기/ }).click();
  }
  throw new Error('설문을 끝내지 못함');
}

test('학생 360px: 진입→접속코드→익명 안내→설문(키보드 1~5 포함)→검토→제출→감사', async () => {
  const page = await newPage();
  await page.goto(base + '?scenario=student');
  await page.getByRole('button', { name: '시작하기' }).waitFor();
  await noHorizontalScroll(page, '교과목 카드');
  await shot(page, 'm01-intro');

  await page.getByRole('button', { name: '시작하기' }).click();
  await page.locator('#cred').fill('WRONG1');
  await page.getByRole('button', { name: '확인' }).click();
  await page.getByText('접속코드가 올바르지 않습니다').waitFor();
  const code = await page.evaluate(() => window.__PREVIEW.accessCode);
  await page.locator('#cred').fill(code.toLowerCase());
  await page.getByRole('button', { name: '확인' }).click();
  await page.getByRole('heading', { name: '익명으로 응답합니다' }).waitFor();
  await noHorizontalScroll(page, '익명성 안내');
  await shot(page, 'm02-consent');

  await page.getByRole('button', { name: '동의하고 시작' }).click();
  await page.waitForSelector('.likert');
  // 필수 문항 미응답 상태에서 [다음] → 오류 안내
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByText('이 문항은 필수입니다').waitFor();
  // 칩 터치 영역 ≥ 48px
  const sizes = await page.$$eval('.chip', (els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.width, r.height]; }));
  assert.ok(sizes.every(([w, h]) => w >= 48 && h >= 48), '칩 최소 48px: ' + JSON.stringify(sizes));
  // 진행 바 접근성 속성
  const pb = await page.getAttribute('.progress', 'aria-valuetext');
  assert.match(pb, /28개 문항 중 1번째/);
  assert.equal(await page.locator('.chip .emo').count(), 5, '이모지 칩');
  await noHorizontalScroll(page, '설문');
  await shot(page, 'm03-question');

  // 키보드 5 → 선택 및 자동 이동
  await page.keyboard.press('5');
  await page.waitForFunction(() => /2/.test(document.querySelector('.survey-head strong').textContent));
  // 이전으로 돌아가 선택 유지 확인
  await page.getByRole('button', { name: '이전' }).click();
  assert.equal(await page.getAttribute('.chip[data-val="5"]', 'aria-checked'), 'true', '키보드 선택 유지');
  await page.getByRole('button', { name: '다음' }).click();

  await answerAll(page);
  await page.getByRole('heading', { name: '응답을 확인해 주세요' }).waitFor();
  await noHorizontalScroll(page, '검토');
  await shot(page, 'm04-review');

  await page.getByRole('button', { name: '제출하기' }).click();
  await page.getByRole('heading', { name: '응답이 제출되었습니다' }).waitFor();
  await page.waitForSelector('.confetti-canvas', { state: 'attached', timeout: 1500 }); // confetti 표시
  await shot(page, 'm05-thanks');
  const n = await page.evaluate(() => window.__server.readResponses_(window.__PREVIEW.courseId).length);
  assert.equal(n, 1, '서버에 1건 기록');
  const draft = await page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.startsWith('ces:draft')).length);
  assert.equal(draft, 0, '제출 후 임시 저장 삭제');
});

test('간단 접속: 공통 주소에서 코드만 입력 → 바로 시작, QR(코드 포함 링크)은 코드 입력 생략', async () => {
  // ① 공통 주소(교과목 ID 없음): 접속코드 입력 화면 → 틀린 코드 안내 → 올바른 코드(소문자) → 교과목 카드
  const page = await newPage();
  await page.goto(base + '?scenario=student&c=');
  await page.getByRole('heading', { name: '접속코드 입력' }).waitFor();
  await noHorizontalScroll(page, '공통 주소 코드 입력');
  await shot(page, 'm00-code-entry');
  await page.locator('#code').fill('NOPE99');
  await page.getByRole('button', { name: '시작하기' }).click();
  await page.getByText('일치하는 설문이 없습니다').waitFor();
  const code = await page.evaluate(() => window.__PREVIEW.accessCode);
  await page.locator('#code').fill(code.toLowerCase());
  await page.getByRole('button', { name: '시작하기' }).click();
  await page.locator('#ct').waitFor();
  // 시작하기 → 코드를 다시 묻지 않고 익명 안내로
  await page.getByRole('button', { name: '시작하기' }).click();
  await page.getByRole('heading', { name: '익명으로 응답합니다' }).waitFor();
  assert.equal(await page.locator('#cred').count(), 0, '코드 재입력 없음');

  // ② QR 링크(?c=…&k=코드): 시작하기 → 바로 익명 안내
  const p2 = await newPage();
  const cid = await page.evaluate(() => window.__PREVIEW.courseId);
  await p2.goto(base + '?scenario=student&c=' + cid + '&k=' + code);
  await p2.getByRole('button', { name: '시작하기' }).click();
  await p2.getByRole('heading', { name: '익명으로 응답합니다' }).waitFor();

  // ③ 링크의 코드가 틀리면(코드 변경 등) 입력 화면으로 안내
  const p3 = await newPage();
  await p3.goto(base + '?scenario=student&c=' + cid + '&k=WRONG1');
  await p3.getByRole('button', { name: '시작하기' }).click();
  await p3.getByText('접속코드가 올바르지 않습니다').waitFor();
});

test('혼합 수업 교과목: 온라인 문항(H) 포함 32문항, 성별 문항 없음, 모든 문항 필수', async () => {
  const page = await newPage();
  await page.goto(base + '?scenario=student');
  const { onlineCourseId, onlineCode } = await page.evaluate(() => window.__PREVIEW);
  await page.goto(base + '?scenario=student&c=' + onlineCourseId);
  await page.getByText('혼합 수업').waitFor();
  await page.getByRole('button', { name: '시작하기' }).click();
  await page.locator('#cred').fill(onlineCode);
  await page.getByRole('button', { name: '확인' }).click();
  await page.getByRole('button', { name: '동의하고 시작' }).click();
  await page.waitForSelector('.likert');
  assert.match(await page.getAttribute('.progress', 'aria-valuetext'), /32개 문항 중 1번째/);
  let sawOnline = false, sawCheer = false, sawSelect = false;
  for (let guard = 0; guard < 40; guard++) {
    if (await page.locator('#rv').count()) break;
    if (await page.getByText('온라인(비대면) 강의').count()) sawOnline = true;
    if (await page.locator('.cheer').count()) sawCheer = true;
    if (await page.locator('select[data-select]').count()) sawSelect = true;
    const before = await page.locator('.survey-head strong').innerText();
    if (await page.locator('.likert').count()) await page.locator('.chip[data-val="4"]').click();
    else if (await page.locator('textarea').count()) { await page.locator('textarea').fill('실습실 와이파이가 좋아졌으면'); await page.getByRole('button', { name: /다음|검토하기/ }).click(); }
    await page.waitForFunction((b) => !document.querySelector('.survey-head strong') || document.querySelector('.survey-head strong').textContent !== b || document.getElementById('rv'), before);
  }
  assert.ok(sawOnline, '온라인 영역 문항 표시');
  assert.ok(sawCheer, '진행 응원 메시지');
  assert.equal(sawSelect, false, '응답자 정보(성별) 문항 없음');
  await page.getByRole('button', { name: '제출하기' }).click();
  await page.getByRole('heading', { name: '응답이 제출되었습니다' }).waitFor();
  const n = await page.evaluate((id) => window.__server.readResponses_(id).length, onlineCourseId);
  assert.equal(n, 1, '응답 저장');
});

test('임시 저장: 설문 중 새로고침해도 응답·위치 복원(sessionStorage)', async () => {
  const page = await newPage();
  await page.goto(base + '?scenario=student');
  await page.getByRole('button', { name: '시작하기' }).click();
  await page.locator('#cred').fill(await page.evaluate(() => window.__PREVIEW.accessCode));
  await page.getByRole('button', { name: '확인' }).click();
  await page.getByRole('button', { name: '동의하고 시작' }).click();
  for (let i = 0; i < 3; i++) {
    await page.locator('.chip[data-val="4"]').click();
    await page.waitForFunction((k) => document.querySelector('.survey-head strong').textContent === String(k + 2), i);
  }
  await page.reload();
  await page.waitForFunction(() => document.querySelector('.survey-head strong') && document.querySelector('.survey-head strong').textContent === '4');
  await page.getByRole('button', { name: '이전' }).click();
  assert.equal(await page.getAttribute('.chip[data-val="4"]', 'aria-checked'), 'true');
});

test('제출 중 네트워크 실패 1회 → 지수 백오프 재시도로 성공(nonce로 중복 없음)', async () => {
  const page = await newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(base + '?scenario=student');
  await page.getByRole('button', { name: '시작하기' }).click();
  await page.locator('#cred').fill(await page.evaluate(() => window.__PREVIEW.accessCode));
  await page.getByRole('button', { name: '확인' }).click();
  await page.getByRole('button', { name: '동의하고 시작' }).click();
  await page.waitForSelector('.q-card');
  const perStep = await page.locator('#questions .q-card').count();
  assert.ok(perStep >= 2, '데스크톱은 영역 단위(한 화면 여러 문항)');
  await shot(page, 'd01-survey-desktop');
  await answerAll(page, { keyboardFirst: true });
  await page.evaluate(() => { window.__runOpt.failNext.submitResponse = 1; });
  await page.getByRole('button', { name: '제출하기' }).click();
  await page.getByRole('heading', { name: '응답이 제출되었습니다' }).waitFor({ timeout: 10000 });
  const calls = await page.evaluate(() => window.__runOpt.calls.filter((c) => c === 'submitResponse').length);
  assert.equal(calls, 1, '첫 시도는 실패(모의), 재시도 1회 성공');
  assert.equal(await page.evaluate(() => window.__server.readResponses_(window.__PREVIEW.courseId).length), 1);
});

test('기간 외 접속·마감·토큰 재사용 안내 화면', async () => {
  const page = await newPage();
  await page.goto(base + '?scenario=future');
  await page.getByRole('heading', { name: '아직 응답 기간이 아닙니다' }).waitFor();
  await noHorizontalScroll(page, '시작 전');
  await shot(page, 'm06-not-started');

  await page.goto(base + '?scenario=closed');
  await page.getByRole('heading', { name: '응답이 마감되었습니다' }).waitFor();

  const p2 = await newPage();
  await p2.goto(base + '?scenario=tokenused');
  const tok = await p2.evaluate(() => window.__PREVIEW.tokens[0]);
  await p2.goto(base + '?scenario=tokenused&t=' + tok.replace('-', ''));
  // QR 링크의 토큰은 입력 없이 자동 확인 → 이미 사용된 토큰 안내
  await p2.getByRole('button', { name: '시작하기' }).click();
  await p2.getByRole('heading', { name: '이미 사용된 토큰입니다' }).waitFor();
  await shot(p2, 'm07-token-used');

  // 교과목 ID 없는 주소는 공통 주소: 접속코드 입력 화면
  await p2.goto(base + '?c=');
  await p2.getByRole('heading', { name: '접속코드 입력' }).waitFor();
});

test('다크 모드·모션 최소화: 대비 토큰 적용, confetti 생략', async () => {
  const page = await newPage({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto(base + '?scenario=student');
  await page.getByRole('button', { name: '시작하기' }).click();
  await page.locator('#cred').fill(await page.evaluate(() => window.__PREVIEW.accessCode));
  await page.getByRole('button', { name: '확인' }).click();
  await page.getByRole('button', { name: '동의하고 시작' }).click();
  await page.waitForSelector('.likert');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert.equal(bg, 'rgb(18, 18, 20)', '다크 배경 #121214');
  await page.locator('.chip[data-val="3"]').click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: '이전' }).click();
  await shot(page, 'm08-dark-question');
  await answerAll(page);
  await page.getByRole('button', { name: '제출하기' }).click();
  await page.getByRole('heading', { name: '응답이 제출되었습니다' }).waitFor();
  await page.waitForTimeout(500);
  assert.equal(await page.locator('.confetti-canvas').count(), 0, 'reduced-motion에서는 confetti 없음');
});

test('교수 360px: PIN 오류 안내→로그인→대시보드→결과(차트)→문항', async () => {
  const page = await newPage();
  await page.goto(base + '?scenario=admin&page=admin');
  await page.locator('#pin').fill('111111');
  await page.getByRole('button', { name: '로그인' }).click();
  await page.getByText('남은 시도 4회').waitFor();
  await page.locator('#pin').fill('123456');
  await page.getByRole('button', { name: '로그인' }).click();
  await page.getByText('진행 중 교과목', { exact: true }).waitFor();
  // 수강인원이 일부 교과목에만 있으면 왜곡된 응답률(예: 0/40명) 대신 응답 수 합계
  assert.equal(await page.locator('#d2').innerText(), '응답 수');
  assert.equal(await page.locator('section[aria-labelledby="d2"] .ring').count(), 0);
  await noHorizontalScroll(page, '대시보드');
  await shot(page, 'm10-admin-dashboard');

  await page.getByRole('tab', { name: '결과' }).click();
  await page.waitForSelector('#radar');
  await page.waitForTimeout(700);
  await noHorizontalScroll(page, '결과');
  await shot(page, 'm11-admin-results');

  await page.getByRole('tab', { name: '문항' }).click();
  await page.waitForSelector('.item-row');
  await noHorizontalScroll(page, '문항 편집');
  await page.getByRole('tab', { name: '교과목' }).click();
  await page.waitForSelector('article.card');
  await noHorizontalScroll(page, '교과목');
  await shot(page, 'm12-admin-courses');
});

test('교수 데스크톱: 결과 잠금/해제·비교 차트·QR·토큰 인쇄 시트·CLO 일괄 입력·내보내기', async () => {
  // 전체 페이지 캡처 시 뷰포트가 바뀌어 차트가 다시 애니메이션되므로, 캡처 정확도를 위해 모션 최소화로 실행
  const page = await newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  await page.goto(base + '?scenario=admin&page=admin');
  await page.locator('#pin').fill('123456');
  await page.getByRole('button', { name: '로그인' }).click();
  await page.getByText('진행 중 교과목', { exact: true }).waitFor();
  const pulses = await page.locator('.course-pulse').count();
  assert.equal(pulses, await page.evaluate(() => window.__server.getCourses_().length), '교과목 한눈에 카드');
  assert.ok(await page.locator('.course-pulse .sparkbars').count() >= 2, '공개된 교과목은 영역 막대 표시');
  await page.waitForTimeout(300);
  await shot(page, 'd10-admin-dashboard');

  // 결과: 샘플(30명) → 해제, 비교 차트 2종
  await page.getByRole('tab', { name: '결과' }).click();
  await page.waitForSelector('#radar');
  // 이전 학기·다른 분반 자료가 있는 교과목(디지털리터러시와 AI활용)을 직접 선택
  await page.selectOption('#res-course', await page.evaluate(() => window.__PREVIEW.courseId));
  await page.waitForSelector('#semChart');
  assert.equal(await page.locator('#semChart').count(), 1, '학기 간 비교 차트');
  assert.equal(await page.locator('#secChart').count(), 1, '분반 간 비교 차트');
  const sem = await page.evaluate(() => window.__server); void sem;
  const labels = await page.$$eval('#k5 ~ * table tbody th, section[aria-labelledby="k5"] tbody th', (els) => els.map((e) => e.textContent.trim()));
  assert.ok(labels.length >= 2 && !labels.some((l) => /B반/.test(l)), '학기 간 비교에 같은 학기의 다른 반이 섞이지 않음: ' + labels.join(','));
  assert.equal(await page.locator('.kpi-ring').count() >= 4, true, 'KPI 링 4종');
  // 수강인원을 입력하지 않으므로 응답률 링 대신 응답 수 카드
  assert.equal(await page.locator('.ring[aria-label^="응답률"]').count(), 0);
  await page.waitForFunction(() => /^30/.test((document.querySelector('[aria-label="응답 수"] .big-num') || {}).textContent || ''));
  // 워드 클라우드: 단어 클릭 → 해당 응답만 표시 → 해제
  await page.waitForSelector('#wc text');
  assert.ok(await page.locator('#wc text').count() >= 8, '단어 8개 이상');
  const word = await page.locator('#wc text').first().getAttribute('data-w');
  await page.locator('#wc text').first().click();
  await page.getByText(`‘${word}’이(가) 들어간 응답`).waitFor();
  // 표시 건수 = 해당 단어가 들어간 전체 서술형 응답 수(누락 없음)
  const expected = await page.evaluate((w) => window.__server.getResults(window.__server.adminLogin('123456').session, window.__PREVIEW.courseId)
    .texts.flatMap((t) => t.answers).filter((a) => a.replace(/wi-?fi/gi, '와이파이').toLowerCase().includes(w.toLowerCase())).length, word);
  const shown = Number(await page.locator('#wc-hits strong .num').innerText());
  assert.equal(shown, expected, '단어 포함 응답 수 일치');
  assert.ok(await page.locator('#wc-hits mark').count() >= 1, '하이라이트');
  await shot(page, 'd11b-wordcloud-filter');
  await page.getByRole('button', { name: '선택 해제' }).click();
  await page.locator('[data-wc]').nth(2).click();
  await page.waitForSelector('#wc text');
  assert.equal(await page.locator('.card-title', { hasText: '성별별 비교' }).count(), 0, '성별 문항 삭제 → 성별 비교 카드 없음');
  await page.waitForTimeout(700);
  await shot(page, 'd11-admin-results');

  // 응답 0건 교과목 → 잠금 화면
  const tokenCourse = await page.evaluate(() => window.__server.getCourses_().find((c) => c.course_name === '간호관리학').course_id);
  await page.selectOption('#res-course', tokenCourse);
  await page.getByText(/명 이상 모이면 결과가 열립니다/).waitFor();
  await shot(page, 'd12-results-locked');

  // 교과목: QR 모달
  await page.getByRole('tab', { name: '교과목' }).click();
  await page.locator('[data-act="qr"]').first().click();
  await page.waitForSelector('.qr-box svg');
  // 학생 링크 복사·링크 점검·새 창에서 열기는 삭제, 공통 주소 복사만 남김
  for (const sel of ['[data-open-link]', '[data-check-link]', '[data-copy]', '.modal-body .linkbox']) {
    assert.equal(await page.locator(sel).count(), 0, sel + ' 없음');
  }
  assert.equal(await page.getByText('시크릿 창').count(), 0, '시크릿 창 안내 문구 없음');
  await shot(page, 'd13-qr-modal');
  const ov = await page.$eval('.modal-body', (el) => [el.scrollWidth, el.clientWidth]);
  assert.ok(ov[0] <= ov[1], 'QR 모달 가로 넘침 없음: ' + ov);
  await page.keyboard.press('Escape');

  // 토큰 생성 → 절취형 인쇄 시트
  await page.getByRole('tab', { name: '교과목' }).click();
  await page.locator(`[data-act="tokens"][data-id="${tokenCourse}"]`).click();
  await page.locator('#tk-n').fill('12');
  await page.getByRole('button', { name: '생성' }).click();
  await page.waitForSelector('.slip');
  assert.equal(await page.locator('.modal .slip').count(), 12);
  await shot(page, 'd14-token-sheet');
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(() => { document.getElementById('print-area').innerHTML = document.querySelector('.modal .slips').outerHTML; document.body.classList.add('printing'); });
  await page.pdf({ path: path.join(OUT, 'd15-token-sheet-A4.pdf'), format: 'A4' });
  await page.evaluate(() => { document.body.classList.remove('printing'); });
  await page.emulateMedia({ media: 'screen' });
  // × 버튼·Esc도 확인 절차를 거쳐야 함(토큰 원문 유실 방지)
  await page.locator('.modal [data-close]').first().click();
  await page.getByRole('heading', { name: '토큰 창 닫기' }).waitFor();
  await page.getByRole('button', { name: '취소' }).click();
  assert.equal(await page.locator('.modal .slip').count(), 12, '취소하면 토큰 시트 유지');
  await page.locator('[data-done]').click();
  await page.getByRole('button', { name: '닫기', exact: true }).last().click();

  // 새 교과목: 드롭다운(학과·학년·반·수업 방식)
  await page.getByRole('button', { name: '새 교과목' }).click();
  await page.locator('#f-name').fill('기본간호학실습');
  for (const id of ['#f-dept', '#f-grade', '#f-mode', '#f-type']) assert.equal(await page.locator(id).evaluate((e) => e.tagName), 'SELECT', id + ' 드롭다운');
  assert.deepEqual(await page.$$eval('#f-type option', (o) => o.map((x) => x.value)), ['이론', '실습', '이론+실습']);
  await page.selectOption('#f-type', '실습');
  assert.deepEqual(await page.$$eval('#f-grade option', (o) => o.map((x) => x.value)), ['1', '2', '3', '4']);
  assert.equal(await page.locator('#f-sec, #f-enr, [name="section"], [name="enrollment"]').count(), 0, '반·수강인원 입력란 없음');
  await page.selectOption('#f-grade', '2');
  await page.selectOption('#f-mode', '비대면');
  await shot(page, 'd13b-course-form');
  await page.getByRole('button', { name: '저장' }).click();
  await page.getByText('교과목을 만들었습니다.').waitFor();
  const made = await page.evaluate(() => { const c = window.__server.getCourses_().find((x) => x.course_name === '기본간호학실습'); return { c, n: window.__server.itemsForCourse_(c).filter((i) => i.scope === 'online').length }; });
  assert.equal(made.c.grade, '2');
  assert.equal(made.c.section, '');
  assert.equal(made.c.enrollment, 0);
  assert.equal(made.c.delivery_mode, '비대면');
  assert.equal(made.n, 4, '비대면 교과목에 온라인 문항 포함');
  assert.equal(made.c.course_type, '실습');
  // 문항 편집기: 이론 강의실 문항은 '이 교과목에서 숨김'으로 표시, 예상 시간은 보이는 문항 기준
  await page.getByRole('tab', { name: '문항' }).click();
  await page.selectOption('#items-course', made.c.course_id);
  await page.waitForSelector('.item-row');
  assert.equal(await page.locator('.item-row.is-hidden').count(), 1, '숨김 문항 1개(이론 강의실)');
  assert.match(await page.locator('.item-row.is-hidden textarea[data-f="text"]').inputValue(), /^이론 강의실/);
  await page.getByText(/1개 숨김/).waitFor();
  assert.equal(await page.locator('select[data-f="scope"]').first().evaluate((e) => e.tagName), 'SELECT');
  await shot(page, 'd13c-items-scope');
  await page.getByRole('tab', { name: '교과목' }).click();

  // 문항: 새 교과목(응답 0)에 CLO 일괄 입력 → 저장
  await page.getByRole('tab', { name: '문항' }).click();
  await page.selectOption('#items-course', tokenCourse);
  await page.waitForSelector('.item-row');
  const before = await page.locator('.item-row').count();
  await page.getByRole('button', { name: 'CLO 일괄 입력' }).click();
  await page.locator('#clo-in').fill('간호정보시스템의 구조와 기능을 설명\n임상의사결정지원시스템을 간호과정에 적용한다');
  await page.getByText('나는 임상의사결정지원시스템을 간호과정에 적용할 수 있게 되었다.').waitFor();
  await page.getByRole('button', { name: '추가', exact: true }).click();
  await page.getByRole('button', { name: /저장/ }).click();
  await page.getByText('문항을 저장했습니다.').waitFor();
  assert.equal(await page.locator('.item-row').count(), before + 2);
  await shot(page, 'd16-items');

  // 서버에서 CLO 위치(C 영역 뒤, E 영역 앞)
  const domains = await page.evaluate((id) => window.__server.getItems_(id).map((i) => i.domain[0]), tokenCourse);
  const firstD = domains.indexOf('D');
  assert.ok(firstD > domains.lastIndexOf('C') && firstD < domains.indexOf('E'));

  // 결과 내보내기(다운로드)
  await page.getByRole('tab', { name: '결과' }).click();
  const demo = await page.evaluate(() => window.__PREVIEW.courseId);
  await page.selectOption('#res-course', demo);
  await page.waitForSelector('[data-export="exportCqi"]');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-export="exportCqi"]').click()]);
  const file = path.join(OUT, 'export-cqi.csv');
  await dl.saveAs(file);
  const csv = fs.readFileSync(file, 'utf8');
  assert.ok(csv.charCodeAt(0) === 0xFEFF && csv.includes('CQI 요약표'), 'BOM 포함 CSV');
});

test('관리자를 테스트용(/dev) 주소로 연 경우: 원인 안내 → 설정에 /exec 주소 저장 → 링크·QR 정상', async () => {
  const page = await newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(base + '?scenario=dev&page=admin');
  await page.locator('#pin').fill('123456');
  await page.getByRole('button', { name: '로그인' }).click();
  await page.getByText('테스트용(/dev) 주소로 열었습니다').first().waitFor();
  await shot(page, 'd20-dev-banner');
  await page.getByRole('tab', { name: '교과목' }).click();
  await page.locator('[data-act="qr"]').first().click();
  await page.getByText('학생 링크·QR을 만들지 않았습니다').waitFor();
  assert.equal(await page.locator('.qr-box').count(), 0, '/dev 링크로 QR을 만들지 않음');
  await page.getByRole('button', { name: '설정으로 이동' }).click();
  await page.locator('#s-url').fill('https://script.google.com/macros/s/PREVIEW/dev');
  await page.getByRole('button', { name: '저장' }).first().click();
  await page.getByText(/dev 주소는 학생이 열 수 없습니다/).first().waitFor();
  await page.locator('#s-url').fill('https://script.google.com/macros/s/PREVIEW/exec');
  await page.getByRole('button', { name: '저장' }).first().click();
  await page.getByText('설정을 저장했습니다.').waitFor();
  await page.getByRole('tab', { name: '교과목' }).click();
  await page.locator('[data-act="qr"]').first().click();
  await page.waitForSelector('.qr-box svg');
  // QR에 담긴 학생 링크가 저장한 /exec 주소를 사용
  const links = await page.evaluate(() => window.__server.getCourses_().map((c) => window.__server.courseSummary_(c, 0, new Date(), window.__server.studentBaseUrl_(window.__server.getSettingsMap_())).link));
  assert.ok(links.every((l) => /PREVIEW\/exec\?c=/.test(l)), links.join(','));
});

test('교수 360px: 링크·QR 모달 가로 넘침 없음(짧은 안내·공통 주소 복사 버튼)', async () => {
  const page = await newPage();
  await page.goto(base + '?scenario=admin&page=admin');
  await page.locator('#pin').fill('123456');
  await page.getByRole('button', { name: '로그인' }).click();
  await page.getByRole('tab', { name: '교과목' }).click();
  const cid = await page.evaluate(() => window.__PREVIEW.courseId); // 접속코드 방식 교과목
  await page.locator(`[data-act="qr"][data-id="${cid}"]`).click();
  await page.waitForSelector('.qr-box svg');
  await page.getByRole('button', { name: /공통 주소 복사/ }).waitFor();
  const ov = await page.$eval('.modal-body', (el) => [el.scrollWidth, el.clientWidth]);
  assert.ok(ov[0] <= ov[1], 'QR 모달 가로 넘침 없음(360px): ' + ov);
  await noHorizontalScroll(page, 'QR 모달');
  await shot(page, 'm13-qr-modal');
});

test('브라우저 콘솔 오류 없음', () => {
  const real = consoleErrors.filter((e) => !/favicon/.test(e));
  assert.deepEqual(real, []);
});
