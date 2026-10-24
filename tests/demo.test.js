'use strict';
/* 체험판(GitHub Pages) 검증: 정적 파일 서버로 index.html → 학생 응답 → 교수 결과 → 초기화 */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const path = require('path');
const P = require('./preview-server');

let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'output');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.css': 'text/css' };
let srv, base, browser;
const errors = [];

test.before(async () => {
  // GitHub Pages와 같은 하위 경로(/Course-Evaluation/)로 제공
  srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (!u.pathname.startsWith('/Course-Evaluation/')) { res.writeHead(404); return res.end(); }
    let p = decodeURIComponent(u.pathname.replace('/Course-Evaluation/', '')) || 'index.html';
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${srv.address().port}/Course-Evaluation/`;
  browser = await chromium.launch();
});
test.after(async () => { await browser.close(); srv.close(); });

async function page(viewport) {
  const ctx = await browser.newContext({ viewport: viewport || { width: 360, height: 740 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  await ctx.route('https://cdn.jsdelivr.net/**', (route) => {
    const file = P.cdnToLocal(route.request().url());
    if (!file) return route.fulfill({ status: 404, body: '' });
    route.fulfill({ status: 200, contentType: P.MIME[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
  });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return p;
}

test('체험판: 첫 화면 → 학생 응답 제출 → 교수 결과 반영 → 초기화', async () => {
  const p = await page();
  await p.goto(base);
  await p.getByRole('heading', { name: '강의평가 Studio 체험하기' }).waitFor();
  const cards = p.locator('#course-list .card');
  assert.equal(await cards.count(), 2, '예시 교과목 2개');
  assert.match(await cards.first().innerText(), /디지털리터러시와 AI활용[\s\S]*1학년 · 이론\+실습[\s\S]*28문항/);
  const sw = await p.evaluate(() => document.documentElement.scrollWidth);
  assert.ok(sw <= 360, '첫 화면 가로 스크롤 없음');
  await p.screenshot({ path: path.join(OUT, 'demo-01-landing.png'), fullPage: true });
  // 정식 설치 파일 내려받기(같은 출처 + download 속성 → 파일로 저장)
  const [dl] = await Promise.all([p.waitForEvent('download'), p.locator('#download-code').click()]);
  assert.equal(dl.suggestedFilename(), 'Code.gs');
  const saved = path.join(OUT, 'downloaded-Code.gs');
  await dl.saveAs(saved);
  assert.equal(fs.readFileSync(saved, 'utf8'), fs.readFileSync(path.join(ROOT, 'dist', 'Code.gs'), 'utf8'), '내려받은 파일 = 설치 파일');

  const code = (await cards.first().locator('.kbd').innerText()).trim();
  await cards.first().getByRole('link', { name: '응답해 보기' }).click();
  await p.getByRole('button', { name: '시작하기' }).waitFor();
  assert.match(await p.locator('#demo-hint').innerText(), new RegExp(code), '배너에 접속코드');
  await p.getByRole('button', { name: '시작하기' }).click();
  await p.locator('#cred').fill(code);
  await p.getByRole('button', { name: '확인' }).click();
  await p.getByRole('button', { name: '동의하고 시작' }).click();
  for (let g = 0; g < 40; g++) {
    if (await p.locator('#rv').count()) break;
    const before = await p.locator('.survey-head strong').innerText();
    if (await p.locator('.likert').count()) await p.locator('.chip[data-val="5"]').click();
    else { if (await p.locator('select[data-select]').count()) await p.locator('select[data-select]').selectOption({ index: 1 }); if (await p.locator('textarea').count()) await p.locator('textarea').fill('체험판 응답: 실습이 최고'); await p.getByRole('button', { name: /다음|검토하기/ }).click(); }
    await p.waitForFunction((b) => document.getElementById('rv') || document.querySelector('.survey-head strong').textContent !== b, before);
  }
  await p.getByRole('button', { name: '제출하기' }).click();
  await p.getByRole('heading', { name: '응답이 제출되었습니다' }).waitFor();

  // 교수 화면: localStorage에 저장된 응답이 결과에 반영
  await p.goto(base + 'demo/admin.html');
  assert.match(await p.locator('#demo-hint').innerText(), /123456/);
  await p.locator('#pin').fill('123456');
  await p.getByRole('button', { name: '로그인' }).click();
  await p.getByText('교과목 한눈에').waitFor();
  await p.getByRole('tab', { name: '결과' }).click();
  await p.waitForSelector('#wc text');
  // 수강인원을 입력하지 않으므로 응답률 대신 응답 수 표시
  assert.equal(await p.locator('.ring[aria-label^="응답률"]').count(), 0);
  await p.waitForFunction(() => /^31/.test((document.querySelector('[aria-label="응답 수"] .big-num') || {}).textContent || ''));
  await p.waitForTimeout(800);
  await p.screenshot({ path: path.join(OUT, 'demo-02-admin-results.png'), fullPage: true });

  // 링크·QR은 체험판 주소(student.html?c=)를 가리킴
  const link = await p.evaluate(() => window.__server.getAdminBootstrap(JSON.parse(sessionStorage.getItem('ces:admin')).s).courses[0].link);
  assert.match(link, /\/Course-Evaluation\/demo\/student\.html\?c=/);

  // 초기화
  p.once('dialog', (d) => d.accept());
  await p.locator('.demo-bar button', { hasText: '초기화' }).click();
  await p.waitForLoadState('load');
  await p.goto(base);
  const n = await p.evaluate(() => window.__server.readResponses_().length);
  assert.equal(n, 60, '초기화 후 샘플 60건만');
});

test('체험판: 교수 화면 주소(student.html?page=admin)는 admin.html로 이동, 콘솔 오류 없음', async () => {
  const p = await page({ width: 1280, height: 900 });
  await p.goto(base + 'demo/student.html?page=admin');
  await p.waitForURL(/admin\.html$/);
  await p.getByRole('heading', { name: '교수자 로그인' }).waitFor();
  assert.deepEqual(errors, []);
});
