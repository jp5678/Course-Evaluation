'use strict';
/*
 * 최종 사용자 매뉴얼(PDF) 생성
 * 1) 로컬 미리보기 서버(tests/preview-server.js)에서 실제 화면을 장면별로 캡처
 * 2) docs/manual/manual.html 작성 → Chromium으로 A4 PDF 출력
 * 실행: node tools/build-manual.js   →  docs/강의평가Studio_사용자매뉴얼.pdf
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const TESTS = path.join(ROOT, 'tests');
const P = require(path.join(TESTS, 'preview-server'));
let chromium;
try { ({ chromium } = require(path.join(TESTS, 'node_modules', 'playwright'))); } catch (e) { ({ chromium } = require('playwright')); }

const OUT_DIR = path.join(ROOT, 'docs', 'manual');
const IMG = path.join(OUT_DIR, 'img');
const PDF = path.join(ROOT, 'docs', '강의평가Studio_사용자매뉴얼.pdf');
const VERSION = /VERSION: '([^']+)'/.exec(fs.readFileSync(path.join(ROOT, 'Code.gs'), 'utf8'))[1];
const FONT_DIR = path.join(TESTS, 'node_modules', 'pretendard', 'dist', 'web', 'static', 'woff2');

async function newPage(browser, viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' });
  await ctx.route('https://cdn.jsdelivr.net/**', (route) => {
    const file = P.cdnToLocal(route.request().url());
    if (!file) return route.fulfill({ status: 404, body: '' });
    route.fulfill({ status: 200, contentType: P.MIME[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
  });
  return ctx.newPage();
}

const settle = (page) => page.waitForTimeout(900);
const snap = async (target, name) => { await target.screenshot({ path: path.join(IMG, name + '.png') }); };

async function capture(base, browser) {
  /* ── 교수 화면(데스크톱) ── */
  const page = await newPage(browser, { width: 1280, height: 860 });
  await page.goto(base + '?scenario=admin&page=admin');
  await page.locator('#pin').waitFor();
  await settle(page);
  await snap(page, 'a01-login');
  await page.locator('#pin').fill('123456');
  await page.getByRole('button', { name: '로그인' }).click();
  await page.getByText('진행 중 교과목', { exact: true }).waitFor();
  await settle(page);
  await snap(page, 'a02-dashboard');

  const cid = await page.evaluate(() => window.__PREVIEW.courseId);
  await page.getByRole('tab', { name: '교과목' }).click();
  await page.locator(`[data-act="access"][data-id="${cid}"]`).waitFor();
  await settle(page);
  await snap(page, 'a03-courses');

  await page.locator('[data-act="new-course"]').first().click();
  await page.locator('.modal').waitFor();
  await settle(page);
  await snap(page.locator('.modal'), 'a04-course-form');
  await page.keyboard.press('Escape');

  await page.locator(`[data-act="access"][data-id="${cid}"]`).click();
  await page.waitForSelector('[data-access-addr]');
  await settle(page);
  await snap(page.locator('.modal'), 'a05-access-modal');
  await page.locator('[data-present]').click();
  await page.locator('.present').waitFor();
  await settle(page);
  await snap(page, 'a06-present');
  await page.keyboard.press('Escape');

  await page.getByRole('tab', { name: '문항' }).click();
  await page.waitForSelector('[data-act="add-item"]');
  await settle(page);
  await snap(page, 'a07-items');

  await page.getByRole('tab', { name: '결과' }).click();
  await page.locator('#res-course').selectOption(cid);
  await page.waitForSelector('#radar');
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await snap(page, 'a08-results-top');
  await snap(page.locator('section[aria-labelledby="h3"]'), 'a09-wordcloud');
  await snap(page.locator('section[aria-labelledby="k4"]'), 'a10-radar');
  await snap(page.locator('section[aria-labelledby="k9"]'), 'a11-cqi');

  await page.getByRole('tab', { name: '설정' }).click();
  await page.locator('#s-url').waitFor();
  await settle(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await snap(page, 'a12-settings');
  await page.context().close();

  /* ── 학생 화면(휴대폰) ── */
  const m = await newPage(browser, { width: 390, height: 780 });
  const code = await (async () => { await m.goto(base + '?scenario=student&c='); return m.evaluate(() => window.__PREVIEW.accessCode); })();
  await m.getByRole('heading', { name: '접속코드 입력' }).waitFor();
  await m.locator('#code').fill(code);
  await settle(m);
  await snap(m, 's01-code');
  await m.getByRole('button', { name: '시작하기' }).click();
  await m.locator('#ct').waitFor();
  await settle(m);
  await snap(m, 's02-intro');
  await m.getByRole('button', { name: '시작하기' }).click();
  await m.getByRole('heading', { name: '익명으로 응답합니다' }).waitFor();
  await settle(m);
  await snap(m, 's03-consent');
  await m.getByRole('button', { name: '동의하고 시작' }).click();
  await m.waitForSelector('.likert');
  await m.locator('.chip[data-val="4"]').first().click();
  await m.waitForTimeout(700);
  await m.getByRole('button', { name: '이전' }).click();
  await settle(m);
  await snap(m, 's04-question');
  await m.context().close();
}

function img(name, caption, cls) {
  const data = fs.readFileSync(path.join(IMG, name + '.png')).toString('base64');
  return `<figure class="${cls || ''}"><img src="data:image/png;base64,${data}" alt="${caption}"><figcaption>${caption}</figcaption></figure>`;
}

function fontFace() {
  return [['Regular', 400], ['SemiBold', 600], ['Bold', 700], ['ExtraBold', 800]].map(([n, w]) => {
    const b64 = fs.readFileSync(path.join(FONT_DIR, `Pretendard-${n}.woff2`)).toString('base64');
    return `@font-face{font-family:"Pretendard";font-weight:${w};src:url(data:font/woff2;base64,${b64}) format("woff2");}`;
  }).join('\n');
}

function html() {
  const today = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric' });
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>강의평가 Studio 사용자 매뉴얼</title>
<style>
${fontFace()}
@page { size: A4; margin: 18mm 16mm 18mm 16mm; }
:root { --ink:#1d2033; --muted:#5b6078; --line:#dcdfeb; --accent:#4b44d6; --soft:#eeedfc; --warn:#fff4d6; --warn-line:#e9c46a; }
* { box-sizing: border-box; }
body { font-family: "Pretendard", sans-serif; color: var(--ink); font-size: 10.5pt; line-height: 1.65; margin: 0; }
h1, h2, h3 { line-height: 1.3; margin: 0; }
.cover { height: 255mm; display: flex; flex-direction: column; justify-content: space-between; page-break-after: always; }
.cover .top { margin-top: 40mm; }
.cover .eyebrow { color: var(--accent); font-weight: 700; letter-spacing: .08em; font-size: 10pt; }
.cover h1 { font-size: 34pt; font-weight: 800; margin-top: 6mm; letter-spacing: -.02em; }
.cover .sub { font-size: 14pt; color: var(--muted); margin-top: 4mm; }
.cover .meta { border-top: 2px solid var(--ink); padding-top: 5mm; font-size: 10pt; color: var(--muted); display: grid; grid-template-columns: 30mm 1fr; row-gap: 1.5mm; }
.cover .meta b { color: var(--ink); font-weight: 600; }
.notice { background: var(--warn); border: 1px solid var(--warn-line); border-radius: 3mm; padding: 4mm 5mm; font-size: 9.5pt; }
.toc { page-break-after: always; }
.toc h2 { font-size: 18pt; margin-bottom: 6mm; }
.toc ol { padding-left: 6mm; margin: 0; }
.toc li { padding: 1.6mm 0; border-bottom: 1px dotted var(--line); font-size: 11pt; }
section.chapter { page-break-before: always; }
section.chapter:first-of-type { page-break-before: auto; }
h2.ch { font-size: 18pt; font-weight: 800; padding-bottom: 3mm; border-bottom: 2px solid var(--ink); margin-bottom: 5mm; }
h2.ch span { color: var(--accent); margin-right: 3mm; }
h3 { font-size: 12.5pt; font-weight: 700; margin: 6mm 0 2mm; }
p { margin: 0 0 2.5mm; }
ol.steps, ul { margin: 0 0 3mm; padding-left: 6mm; }
ol.steps li, ul li { margin-bottom: 1.4mm; }
.kbd { font-weight: 600; background: var(--soft); border-radius: 1.2mm; padding: 0 1.5mm; white-space: nowrap; }
table { width: 100%; border-collapse: collapse; margin: 2mm 0 4mm; font-size: 9.5pt; page-break-inside: avoid; }
th, td { border: 1px solid var(--line); padding: 2mm 2.5mm; text-align: left; vertical-align: top; }
th { background: var(--soft); font-weight: 600; }
figure { margin: 3mm 0 5mm; page-break-inside: avoid; text-align: center; }
figure img { max-width: 100%; max-height: 120mm; border: 1px solid var(--line); border-radius: 2mm; }
figure.phone img { max-height: 105mm; }
figcaption { font-size: 8.5pt; color: var(--muted); margin-top: 1.5mm; }
.row { display: flex; gap: 4mm; justify-content: center; }
.row figure { flex: 1; margin: 2mm 0 4mm; }
.tip { border-left: 3px solid var(--accent); background: var(--soft); padding: 2.5mm 4mm; margin: 3mm 0; font-size: 9.5pt; page-break-inside: avoid; }
.warnbox { border-left: 3px solid var(--warn-line); background: var(--warn); padding: 2.5mm 4mm; margin: 3mm 0; font-size: 9.5pt; page-break-inside: avoid; }
code { font-family: "Pretendard", monospace; background: var(--soft); padding: 0 1.2mm; border-radius: 1mm; font-size: 9.5pt; }
</style></head><body>

<div class="cover">
  <div class="top">
    <div class="eyebrow">교수자 자율형 형성평가 · CQI 도구</div>
    <h1>강의평가 Studio</h1>
    <div class="sub">사용자 매뉴얼 (교수용)</div>
  </div>
  <div>
    <p class="notice">이 도구는 <b>학교 공식 강의평가를 대체하지 않는</b> 교수자 자율형 형성평가·수업 개선(CQI)용 설문 도구입니다. 학생 응답은 익명으로 수집되며 성적과 무관합니다.</p>
    <div class="meta" style="margin-top:6mm">
      <span>버전</span><b>v${VERSION}</b>
      <span>작성일</span><b>${today}</b>
      <span>개발</span><b>정종필 교수 · 청암대학교 간호학과</b>
      <span>구성</span><b>Google 스프레드시트 + Apps Script 웹 앱</b>
    </div>
  </div>
</div>

<div class="toc">
  <h2>차례</h2>
  <ol>
    <li>한눈에 보는 강의평가 Studio</li>
    <li>설치와 배포 (최초 1회, 약 15분)</li>
    <li>로그인과 대시보드</li>
    <li>교과목 등록과 설문 기간</li>
    <li>문항 관리 (기본 문항 은행 · CLO)</li>
    <li>학생 참여 안내 (공통 주소 · 접속코드 · 토큰)</li>
    <li>학생 응답 화면</li>
    <li>결과 분석과 CQI 보고</li>
    <li>설정 · 버전 업데이트</li>
    <li>익명성 보호 원칙</li>
    <li>자주 묻는 질문과 문제 해결</li>
    <li>부록: 스프레드시트 구조</li>
  </ol>
</div>

<section class="chapter">
<h2 class="ch"><span>1</span>한눈에 보는 강의평가 Studio</h2>
<p>강의평가 Studio는 교수가 학기 중 언제든 자신의 수업에 대한 학생 의견을 익명으로 모으고, 결과를 시각화해 다음 수업 개선(CQI)에 활용하도록 돕는 웹 앱입니다. 데이터는 <b>교수 본인의 Google 스프레드시트</b>에만 저장됩니다.</p>
<table>
<tr><th style="width:28%">구분</th><th>내용</th></tr>
<tr><td>교수</td><td>교과목 등록 → 접속 주소·접속코드 안내 → 응답 현황 확인 → 결과 분석·CQI 요약표 내보내기</td></tr>
<tr><td>학생</td><td>공통 주소 열기 → 접속코드 입력 → 익명 안내 확인 → 28~32문항 응답(약 5분) → 제출</td></tr>
<tr><td>평가 영역</td><td>A 강의 설계 · B 교수학습방법 · C 평가 및 과제 · D 학습성과(CLO) · E 학습 환경 · F 디지털·AI 활용 · G 종합 · H 온라인(비대면) 강의 · I 실무 적용(전공심화과정만) · 서술형 3문항</td></tr>
<tr><td>참여 방식</td><td><b>접속코드</b>(간편, 공통 주소에서 입력) 또는 <b>일회용 토큰</b>(1인 1회 보장)</td></tr>
<tr><td>필요한 것</td><td>Google 계정, 크롬 등 최신 브라우저. 학생은 로그인 없이 휴대폰으로 응답합니다.</td></tr>
</table>
<h3>기본 문항 구성</h3>
<table>
<tr><th style="width:28%">영역</th><th style="width:12%">문항 수</th><th>주요 내용</th></tr>
<tr><td>A. 강의 설계</td><td>2</td><td>강의계획서와 수업 일치, 수업 목표의 명확성</td></tr>
<tr><td>B. 교수학습방법</td><td>4</td><td>설명의 이해 용이성, 수업 자료, 질문·참여 기회, 다양한 교수학습방법(토의·사례·시뮬레이션·플립러닝·스마트교수법·AI활용)</td></tr>
<tr><td>C. 평가 및 과제</td><td>4</td><td>평가 기준 사전 공지, 공정성, 과제의 양·난이도, 피드백 적시성</td></tr>
<tr><td>D. 학습성과(CLO)</td><td>교과목별(예시 5)</td><td>“나는 ~할 수 있게 되었다” 자기평가</td></tr>
<tr><td>E. 학습 환경</td><td>3</td><td>이론 강의실, 실습실 시설(교과목 유형에 따라 표시), 유무선 인터넷</td></tr>
<tr><td>F. 디지털·AI 활용</td><td>5</td><td>학습 도움, 간호실무 활용, 사용 방법 안내, AI 정보의 비판적 검토, 윤리·저작권·환자정보 보호</td></tr>
<tr><td>G. 종합</td><td>2</td><td>전반적 만족도, 후배 추천 의향</td></tr>
<tr><td>H. 온라인 강의</td><td>4</td><td>온라인(비대면)·혼합 교과목에만 표시</td></tr>
<tr><td>I. 실무 적용</td><td>2</td><td>임상 현장 적용 가능성, 간호 업무 효율성 향상 — 전공심화과정 교과목에만</td></tr>
<tr><td>서술형</td><td>3</td><td>도움이 된 점, 개선이 필요한 점, 다음 학기에 바라는 점</td></tr>
</table>
<p>모든 문항은 기본적으로 <b>필수 응답</b>이며, [문항] 탭에서 문항별로 바꿀 수 있습니다.</p>
</section>

<section class="chapter">
<h2 class="ch"><span>2</span>설치와 배포 (최초 1회)</h2>
<h3>2-1. 스프레드시트에 코드 넣기</h3>
<ol class="steps">
  <li>Google 드라이브에서 <b>새 스프레드시트</b>를 만들고 이름을 정합니다(예: 강의평가 Studio 2026-2학기).</li>
  <li>메뉴 <span class="kbd">확장 프로그램 ▸ Apps Script</span>를 엽니다.</li>
  <li>편집기의 <b>Code.gs</b> 내용을 모두 지우고, 배포받은 <b>Code.gs(단일 파일 설치본)</b> 전체를 붙여 넣은 뒤 저장(<span class="kbd">Ctrl+S</span>)합니다.</li>
  <li>함수 목록에서 <b>setup</b>을 고르고 <span class="kbd">실행</span>을 누릅니다.</li>
</ol>
<h3>2-2. 권한 승인</h3>
<ol class="steps">
  <li>「승인 필요」 창에서 <span class="kbd">권한 검토</span> → 본인 계정을 선택합니다.</li>
  <li>「Google에서 확인하지 않은 앱」 화면이 나오면 <span class="kbd">고급</span> ▸ <span class="kbd">강의평가 Studio(으)로 이동</span>을 누릅니다. 개인이 만든 스크립트에 항상 나오는 정상 절차입니다.</li>
  <li><span class="kbd">허용</span>을 누르고, setup을 한 번 더 실행합니다. 시트에 Settings·Courses·Items·Tokens·Responses 탭과 예시 교과목 3개(디지털리터러시와 AI활용·AI융합 간호정보학·AI융합 간호정보학(전공심화과정))가 만들어집니다. 전공심화과정은 2026학년도 2학기·4학년·이론+실습·온라인(비대면)이며, CLO는 AI융합 간호정보학과 같고 현직 간호사를 위한 <b>「I. 실무 적용」 영역 2문항</b>(서술형 바로 앞)이 더해져 34문항이며, 결과 화면에서도 별도 영역으로 분석됩니다.</li>
</ol>
<p>요청 권한은 <b>이 스프레드시트만 보고 편집</b>, <b>스프레드시트 메뉴·대화상자 표시</b> 두 가지뿐입니다.</p>
<h3>2-3. 관리자 PIN 설정</h3>
<p>스프레드시트를 새로 고치면 상단에 <b>강의평가 Studio</b> 메뉴가 생깁니다. <span class="kbd">② 관리자 PIN 설정·재설정</span>에서 숫자 6~12자리 PIN을 정합니다.</p>
<h3>2-4. 웹 앱 배포</h3>
<ol class="steps">
  <li>Apps Script 편집기 오른쪽 위 <span class="kbd">배포 ▸ 새 배포</span> ▸ 톱니바퀴 ▸ <b>웹 앱</b>을 고릅니다.</li>
  <li><b>다음 사용자 인증 정보로 실행: 나</b>를 먼저 고릅니다.</li>
  <li><b>액세스 권한이 있는 사용자: 모든 사용자</b>를 고릅니다. (「실행: 나」를 먼저 골라야 「모든 사용자」 항목이 나타납니다.)</li>
  <li><span class="kbd">배포</span>를 누르고 표시된 <b>웹 앱 URL(…/exec)</b>을 <span class="kbd">복사</span>합니다.</li>
  <li>복사한 주소 끝에 <code>?page=admin</code>을 붙여 열면 관리자 화면입니다. 이 주소를 즐겨찾기 하세요.</li>
</ol>
<div class="warnbox"><b>잘못된 설정 예:</b> 「실행: 웹 앱을 액세스하는 사용자」 또는 「액세스: Google 계정이 있는 모든 사용자」로 배포하면 학생에게 로그인과 권한 승인을 요구하고, 응답을 저장할 수 없습니다. 반드시 <b>실행: 나 / 액세스: 모든 사용자</b>로 배포하세요.</div>
<div class="tip"><b>배포 직후 확인:</b> 웹 앱 URL을 <b>시크릿 창</b>(Ctrl+Shift+N)이나 Wi-Fi를 끈 휴대폰에서 열어 접속코드 입력 화면이 나오는지 확인하세요. 학생과 같은 조건입니다.</div>
</section>

<section class="chapter">
<h2 class="ch"><span>3</span>로그인과 대시보드</h2>
<p>관리자 주소(<code>…/exec?page=admin</code>)로 접속해 PIN을 입력합니다. PIN을 5회 틀리면 10분 동안 잠깁니다.</p>
<div class="tip"><b>PIN 입력 상자가 안 보이면</b> 주소 끝에 <code>?page=admin</code>이 빠진 것입니다. <code>…/exec</code>만 열면 학생용 「접속코드 입력」 화면이 나옵니다. 그 화면 맨 아래 <span class="kbd">교수자 로그인</span> 링크를 누르거나 주소에 <code>?page=admin</code>을 붙이세요. 관리자 주소는 즐겨찾기에 저장해 두면 편리합니다.</div>
${img('a01-login', '그림 3-1. 교수 로그인 화면')}
${img('a02-dashboard', '그림 3-2. 대시보드 — 진행 중 교과목, 응답 수, 전체 평균, 긍정 응답률, 마감 임박 교과목')}
<p>맨 위 메뉴는 <b>대시보드 · 교과목 · 문항 · 결과 · 설정 · 사용 매뉴얼</b>입니다. <b>사용 매뉴얼</b> 탭에서는 이 매뉴얼의 요약을 장별로 펼쳐 볼 수 있습니다.</p>
<p>대시보드 맨 위의 <b>환영 배너</b>는 시간대별 인사와 오늘 날짜, 진행 중 설문·<b>오늘 새 응답</b>(한국 시간 기준 오늘 제출된 응답)·누적 응답·마감 임박 수를 스티커로 보여 주며(오늘 응답이 있으면 강조 표시), 오늘 응답이 들어온 교과목 카드에는 <b>오늘 +N</b>이 붙습니다. 교과목 응답이 <b>결과 공개 기준(기본 5명)</b>에 처음 도달하면(수강인원을 입력한 교과목은 응답률 80%도) 축하 효과와 알림이 교과목·목표마다 한 번 나타납니다. 배너에서는 <span class="kbd">교과목·접속 주소</span>·<span class="kbd">결과 보기</span>로 바로 이동할 수 있습니다. 각 탭 제목에는 이모지 아이콘이 붙고, 화면이 바뀔 때 부드럽게 나타납니다(기기의 「동작 줄이기」 설정을 켜면 움직임이 꺼집니다).</p>
<p>대시보드의 교과목 카드를 누르면 해당 교과목의 결과 화면으로 이동합니다. <b>마감 임박</b> 카드는 72시간 안에 응답 기간이 끝나는 교과목을 알려 줍니다.</p>
<div class="tip"><b>응답 수와 평균의 기준이 다른 이유:</b> 「응답 수」는 진행 중인 모든 교과목의 합계이고, 「전체 평균」·「긍정 응답률」은 <b>결과가 열린 교과목만</b>으로 계산합니다. 응답이 최소 공개 수 미만이거나 결과 공개일 전인 교과목은 익명성 보호를 위해 평균에서 빠지며, 카드 아래에 「결과가 열린 1개 교과목(30명) 기준 · 1개는 잠김」처럼 기준이 표시됩니다.</div>
</section>

<section class="chapter">
<h2 class="ch"><span>4</span>교과목 등록과 설문 기간</h2>
${img('a03-courses', '그림 4-1. [교과목] 탭 — 교과목별 응답 현황과 작업 버튼')}
<h3>4-1. 새 교과목 만들기</h3>
<ol class="steps">
  <li><span class="kbd">+ 새 교과목</span>을 누릅니다.</li>
  <li>교과목명, 학년도, 드롭다운(학기·학과·학년·수업 방식·교과목 유형), 응답 시작·마감 일시를 입력합니다.</li>
  <li>참여 방식(<b>접속코드</b> 또는 <b>일회용 토큰</b>)을 고릅니다. 접속코드는 교과목마다 달라야 합니다.</li>
  <li>결과 공개일을 지정하면 그날 전까지 결과가 잠깁니다(예: 성적 입력 이후).</li>
</ol>
${img('a04-course-form', '그림 4-2. 교과목 편집 창')}
<table>
<tr><th style="width:28%">설정</th><th>문항에 미치는 영향</th></tr>
<tr><td>수업 방식</td><td>대면: 온라인 문항(H) 숨김 / 온라인(비대면)·혼합: 온라인 문항 표시</td></tr>
<tr><td>교과목 유형</td><td>이론: 실습실 문항 숨김 / 실습: 이론 강의실 문항 숨김 / 이론+실습: 모두 표시</td></tr>
</table>
<div class="warnbox">응답이 1건이라도 들어오면 그 교과목의 문항, 수업 방식, 교과목 유형은 바꿀 수 없습니다. 문항이 바뀌면 이전 응답과 의미가 달라지기 때문입니다.</div>
<h3>4-2. 다음 학기에 다시 쓰기</h3>
<p><span class="kbd">복제</span>를 누르고 새 학년도·학기·기간을 입력하면 문항이 그대로 복사됩니다. 응답과 토큰은 복사되지 않으며, 새 접속코드가 자동으로 만들어집니다. 같은 교과목명의 다른 학기와는 결과 화면에서 자동으로 비교됩니다.</p>
<p>응답이 없는 교과목만 <span class="kbd">삭제</span>할 수 있습니다.</p>
<h3>4-3. 설문 중지와 다시 시작</h3>
<p>응답 기간 중에 설문을 멈추려면 <b>수동 마감</b>을 씁니다. 응답·문항·접속코드는 그대로 보관되고, 학생에게는 「응답이 마감되었습니다」 화면이 나옵니다.</p>
<ol class="steps">
  <li>[교과목] 탭에서 해당 교과목의 <span class="kbd">편집</span>을 누릅니다.</li>
  <li>맨 아래 <b>「지금 수동으로 마감(기간과 관계없이 응답 차단)」</b>을 체크하고 <span class="kbd">저장</span>합니다.</li>
  <li>교과목 카드에 <b>수동 마감</b> 배지가 표시됩니다.</li>
</ol>
<table>
<tr><th style="width:28%">다시 시작하는 방법</th><th>절차</th><th style="width:30%">언제 쓰나</th></tr>
<tr><td>새 학기 준비(일괄, 권장)</td><td>[교과목] 위쪽 <span class="kbd">새 학기 준비</span> ▸ 복제할 학기·새 학년도/학기·응답 기간 ▸ 준비하기. 그 학기 교과목 전체가 문항째 복제되고 새 접속코드가 만들어지며, 새 코드 목록이 표시됩니다. 「이전 학기 마감」을 체크하면 이전 코드로는 응답할 수 없습니다. 두 번 눌러도 중복되지 않습니다.</td><td>학기가 바뀔 때 한 번에. 이전 학기와 결과가 자동 비교되고, 학생 접속 주소(공통 주소)는 그대로입니다.</td></tr>
<tr><td>새 학기로 복제(1개)</td><td><span class="kbd">복제</span> ▸ 새 학년도·학기(예: 2027학년도 1학기)와 응답 기간 입력 ▸ 새 접속코드로 안내</td><td>교과목 하나만 다시 평가할 때.</td></tr>
<tr><td>마감 해제</td><td><span class="kbd">편집</span> ▸ 「지금 수동으로 마감」 체크 해제 ▸ 응답 기간을 새로 입력 ▸ 저장</td><td>같은 학기 안에서 잠시 멈췄다가 이어 받을 때</td></tr>
</table>
<div class="tip"><b>예시:</b> 「디지털리터러시와 AI활용」을 2026년에 멈추고 2027년 1학기에 다시 평가하려면, 지금은 <b>수동 마감</b>만 해 두고 2027년 학기 초에 <b>복제</b>로 2027학년도 1학기 교과목을 만드세요. 2026년 응답과 섞이지 않고, 결과 화면의 학기 간 비교에 2026년 결과가 함께 나타납니다.</div>
</section>

<section class="chapter">
<h2 class="ch"><span>5</span>문항 관리</h2>
${img('a07-items', '그림 5-1. [문항] 탭 — 문항 편집기와 예상 응답 시간')}
<ul>
  <li>위쪽에서 <b>공통 기본 문항 은행</b> 또는 개별 교과목을 고릅니다. 기본 문항 은행을 고치면 <b>이후 새로 만드는</b> 교과목에 적용됩니다.</li>
  <li>문항마다 영역, 문구, 유형(5점 리커트·단일 선택·복수 선택·드롭다운·서술형), 필수 여부, 역문항, 표시 조건을 정할 수 있습니다.</li>
  <li><b>영역</b>은 드롭다운에서 고릅니다(A~H, 서술형 등 전체 목록). 목록에 없는 영역은 맨 아래 <b>「직접 입력…」</b>을 고르고 이름을 입력한 뒤 Enter를 누르면 추가됩니다.</li>
  <li><b>CLO 일괄 입력</b>: 교과목 학습성과를 한 줄에 하나씩 붙여 넣으면 “나는 ~할 수 있게 되었다.” 문항으로 바뀌어 D 영역에 들어갑니다.</li>
  <li>편집기 위쪽에 <b>학생에게 보이는 문항 수와 예상 시간</b>이 표시됩니다. 기본 구성은 대면 28문항, 혼합·온라인(비대면) 32문항, 약 5분입니다.</li>
</ul>
<div class="tip">응답률을 높이려면 교과목에 맞지 않는 문항(예: 이론 교과목의 실습실 문항)을 지우거나, 서술형 일부를 「필수」에서 해제하세요.</div>
</section>

<section class="chapter">
<h2 class="ch"><span>6</span>학생 참여 안내</h2>
<p>[교과목] 탭에서 <span class="kbd">접속 주소</span>를 누릅니다. 학생은 <b>공통 주소 + 접속코드</b>로 접속합니다. 접속코드는 교과목마다 꼭 필요하며, 비워 두면 저장할 때 자동으로 만들어집니다.</p>
<div class="row">${img('a05-access-modal', '그림 6-1. 학생 접속 주소 창 — 공통 주소, 접속코드, 안내문 복사')}</div>
<table>
<tr><th style="width:28%">방법</th><th>학생이 하는 일</th><th style="width:32%">추천 상황</th></tr>
<tr><td>공통 주소 + 접속코드</td><td>LMS에 올린 공통 주소 접속 → 접속코드 입력 → 해당 교과목 설문 시작</td><td>LMS 공지, 수업 시간 화면 안내</td></tr>
<tr><td>일회용 토큰</td><td>종이 토큰에 인쇄된 공통 주소에 접속해 토큰 입력. 토큰은 1회만 사용됩니다.</td><td>1인 1회 응답이 중요할 때</td></tr>
</table>
<ul>
  <li><span class="kbd">주소 복사</span>: 모든 교과목이 같이 쓰는 공통 주소입니다. 학기 내내 바뀌지 않습니다(배포를 「새 배포」로 다시 만들지 않는 한).</li>
  <li><span class="kbd">안내문 복사(LMS 공지용)</span>: 교과목명·주소·접속코드가 들어간 안내문을 복사해 LMS 공지에 그대로 붙여 넣습니다.</li>
  <li><span class="kbd">수업 화면에 띄우기</span>: 주소와 접속코드를 강의실 화면에 크게 띄웁니다(아래 그림). <span class="kbd">Esc</span>로 닫습니다.</li>
  <li><span class="kbd">주소 복사</span>·<span class="kbd">안내문 복사</span>는 항상 <b>원래 주소</b>(…/exec)를 씁니다. 창에 보이는 주소가 Apps Script [배포 ▸ 배포 관리]의 <b>웹 앱 URL과 같은지</b> 먼저 확인하고, 다르면 [설정] ▸ 「학생용 웹 앱 주소」를 고치세요.</li>
</ul>
${img('a06-present', '그림 6-2. 수업 화면에 띄우기')}
<h3>일회용 토큰 발급</h3>
<p>토큰 방식 교과목의 <span class="kbd">토큰</span>에서 수강생 수보다 2~3개 넉넉하게 생성합니다. 토큰 원문은 <b>그 화면에서 한 번만</b> 보이므로, 바로 절취형 시트를 인쇄하거나 CSV로 받으세요. 나눠 줄 때는 명단 순서와 무관하게 <b>무작위로 섞어</b> 배부합니다.</p>
</section>

<section class="chapter">
<h2 class="ch"><span>7</span>학생 응답 화면</h2>
<p>학생은 로그인 없이 휴대폰으로 응답합니다. 화면 흐름은 다음과 같습니다.</p>
<div class="row">
  ${img('s01-code', '① 공통 주소: 접속코드 입력', 'phone')}
  ${img('s02-intro', '② 교과목 안내', 'phone')}
</div>
<div class="row">
  ${img('s03-consent', '③ 익명성 안내', 'phone')}
  ${img('s04-question', '④ 문항 응답(이모지 5점 척도)', 'phone')}
</div>
<ul>
  <li>코드를 입력한 뒤 화면을 새로 고쳐도 같은 설문으로 이어집니다. 다른 설문은 [다른 접속코드 입력]을 누르세요.</li>
  <li>예전에 안내한 링크로 들어오면 「이전 방식의 링크입니다」 안내와 함께 접속코드 입력 화면이 나옵니다.</li>
  <li>응답 중 화면을 새로 고쳐도 입력한 답과 위치가 유지됩니다(임시 저장). 탭을 닫으면 임시 저장은 지워집니다.</li>
  <li>마지막에 응답을 한 번 더 확인한 뒤 제출합니다. 빠진 필수 문항이 있으면 바로 그 문항으로 안내합니다.</li>
  <li>응답 기간 전·후, 이미 사용한 토큰은 안내 화면이 표시됩니다.</li>
</ul>
</section>

<section class="chapter">
<h2 class="ch"><span>8</span>결과 분석과 CQI 보고</h2>
<p>[결과] 탭에서 교과목을 고릅니다. 응답이 <b>최소 공개 수(기본 5명)</b> 미만이거나 결과 공개일 이전이면 결과가 잠깁니다.</p>
${img('a08-results-top', '그림 8-1. 한눈에 보기 — 응답 수, 전체 평균, 만족도·추천 의향, 영역별 평균과 응답 분포')}
${img('a09-wordcloud', '그림 8-2. 서술형 워드 클라우드 — 문항별로 바꿔 볼 수 있습니다')}
${img('a10-radar', '그림 8-3. 영역별 평균(레이더 차트)과 표')}
<h3>점수 해석 기준(5점 만점)</h3>
<table>
<tr><th>평균</th><td>4.5 이상</td><td>4.0~4.49</td><td>3.5~3.99</td><td>3.0~3.49</td><td>3.0 미만</td></tr>
<tr><th>해석</th><td>매우 우수</td><td>우수</td><td>보통 이상</td><td>보통</td><td>개선 필요</td></tr>
</table>
<p>긍정 응답률은 「그렇다」+「매우 그렇다」의 비율입니다. 역문항은 자동으로 환산됩니다.</p>
<h3>비교 분석</h3>
<ul>
  <li><b>학기 간 비교</b>: 같은 교과목명의 다른 학기 결과와 비교합니다.</li>
  <li><b>분반 간 비교</b>: 같은 학기·같은 교과목명의 다른 분반과 비교합니다.</li>
  <li>비교 대상도 최소 공개 수를 넘어야 표시됩니다.</li>
</ul>
${img('a11-cqi', '그림 8-4. CQI 요약표 — 강점(옅은 초록)·개선점(노랑) 자동 추출과 내보내기')}
<h3>내보내기</h3>
<p>CQI 요약표 카드 아래 버튼으로 결과 자료를 내려받습니다. 결과가 잠긴 교과목(최소 공개 수 미만·결과 공개일 전)은 내보낼 수 없습니다.</p>
<table>
<tr><th style="width:34%">버튼</th><th>내용</th></tr>
<tr><td>원자료 PDF</td><td>문항 번호표(Q1, Q2 …) → 객관식 응답표(12문항씩 나눔, 응답 순서 무작위) → 서술형 응답표(응답 번호별). 소규모 집단이 생기는 드롭다운 문항은 자동 제외</td></tr>
<tr><td>결과 보고서 PDF(권장)</td><td>[결과 분석] 위쪽 <span class="kbd">결과 보고서 PDF</span>. 이 매뉴얼처럼 인쇄용으로 구성한 보고서입니다: 보고서 정보(교과목·학기·응답 기간·응답 수·담당 교수) → 1 한눈에 보기 → 2 영역별 결과(평균 막대·레이더 차트) → 3 학기·분반 비교(표·차트) → 4 문항별 결과(평균·표준편차·긍정률·분포 막대) → 5 서술형 응답(워드 클라우드·자주 나온 단어·전체 응답) → 6 CQI 요약(강점 초록·개선점 노랑 상자, 붙여 넣은 AI 요약, 다음 학기 개선 계획 작성란). 글자 검색·복사가 됩니다.</td></tr>
<tr><td>CQI 요약표 PDF</td><td>전체 평균·긍정 응답률, 영역별 결과, 강점·개선점, 문항별 결과, 개선 계획 작성란, 해석 기준</td></tr>
</table>
<h3>서술형 응답 AI 분석</h3>
<p>CQI 요약표 아래 <b>서술형 응답 AI 분석</b> 칸에서 서술형 의견을 생성형 AI로 요약해 보고서로 남깁니다.</p>
<ol class="steps">
  <li><b>범위</b>를 고릅니다(전체 또는 서술형 문항 하나). 선택한 범위의 글자 수가 표시되며, 8,000자를 넘으면 문항별로 나눠 넣도록 안내합니다.</li>
  <li><span class="kbd">AI용으로 복사</span>를 눌러 생성형 AI에 붙여 넣습니다. 응답과 함께 <b>간호교육 CQI 보고 양식</b>의 요청 문구(문항별 주요 주제·강점·개선 요구 영역 분류·다음 학기 개선 과제 3가지와 성과 지표·CLO와 간호 역량 시사점)가 복사됩니다. 파일이 필요하면 <span class="kbd">서술형 텍스트(AI 붙여넣기용 TXT)</span>를 받습니다.</li>
  <li>AI 요약을 <b>검토한 뒤</b> <b>AI 요약 붙여넣기</b> 칸(최대 5,000자)에 넣고 <span class="kbd">서술형 응답 PDF(보고·인쇄용)</span>를 저장합니다. 칸을 비우면 PDF에 손으로 쓸 작성란이 인쇄됩니다.</li>
</ol>
<div class="tip">서술형 응답을 AI에 넣기 전에 이름·학번 등 개인을 식별할 수 있는 내용이 없는지 확인하세요.</div>
</section>

<section class="chapter">
<h2 class="ch"><span>9</span>설정 · 버전 업데이트</h2>
${img('a12-settings', '그림 9-1. [설정] 탭')}
<ul>
  <li><b>기본 정보</b>: 교수명, 소속, 학과 목록(교과목 드롭다운), 결과 최소 공개 수(3~50).</li>
  <li><b>PIN 변경</b>: 바꾸면 다른 기기의 로그인은 모두 해제됩니다.</li>
  <li><b>학생용 웹 앱 주소</b>: 공통 주소에 쓰는 <code>…/exec</code> 주소입니다. 보통 자동으로 저장됩니다.</li>
</ul>
<h3>새 버전으로 업데이트하는 방법</h3>
<ol class="steps">
  <li>Apps Script 편집기에서 Code.gs 전체를 새 버전으로 바꿔 붙여 넣고 저장합니다.</li>
  <li><b>setup</b>을 한 번 실행합니다. 새 문항·설정이 기존 시트에 반영됩니다(응답이 있는 교과목은 바뀌지 않습니다).</li>
  <li><span class="kbd">배포 ▸ 배포 관리 ▸ ✏️(편집) ▸ 버전: 새 버전 ▸ 배포</span>를 누릅니다.</li>
</ol>
<div class="warnbox"><b>「새 배포」를 만들지 마세요.</b> 새 배포를 만들면 웹 앱 주소가 바뀌어, 이미 안내한 공통 주소가 열리지 않습니다. 업데이트는 항상 「배포 관리 ▸ 새 버전」으로 합니다.</div>
<h3>스프레드시트 메뉴</h3>
<table>
<tr><th style="width:40%">메뉴(강의평가 Studio ▸)</th><th>기능</th></tr>
<tr><td>① 초기 설정 실행</td><td>시트·기본 문항 만들기, 새 버전 반영(업데이트 후 실행)</td></tr>
<tr><td>② 관리자 PIN 설정·재설정</td><td>관리자 PIN 설정(PIN을 잊었을 때도 사용)</td></tr>
<tr><td>웹 앱 주소 확인</td><td>현재 웹 앱 주소 표시</td></tr>
<tr><td>응답 시트 빈 열 정리(학기 시작 전)</td><td>Responses 시트에서 <b>데이터가 없는 문항 열</b>을 지웁니다. 응답 데이터는 그대로이고, 새 응답이 들어오면 필요한 열은 자동으로 다시 만들어집니다.</td></tr>
<tr><td>[테스트] 샘플 응답 생성 / 샘플 데이터 모두 삭제</td><td>결과 화면 연습용 무작위 응답 30건(교과목별) 생성 / <b>샘플 응답만</b> 삭제(교과목·접속코드 유지)</td></tr>
</table>
<h3>시트 보호</h3>
<p>Courses·Items·Tokens·Responses 시트에는 <b>「직접 편집 시 경고」</b> 보호가 걸려 있습니다. 셀을 고치려 하면 경고 창이 먼저 뜹니다. 교과목과 문항은 시트가 아니라 <b>관리자 화면</b>에서 고치세요. 앱의 동작에는 영향이 없습니다.</p>
<h3>테스트용 샘플 응답</h3>
<p>스프레드시트 메뉴 <span class="kbd">강의평가 Studio ▸ [테스트] 샘플 응답 생성</span>을 실행하면 예시 교과목마다 무작위 응답 30건이 만들어져 결과 화면을 미리 볼 수 있습니다. 실제 평가 전에는 반드시 <span class="kbd">[테스트] 샘플 데이터 모두 삭제</span>를 실행하세요. 삭제는 샘플 응답만 지우므로 교과목 ID·접속코드가 바뀌지 않아, 이미 안내한 주소·접속코드를 그대로 쓸 수 있습니다.</p>
</section>

<section class="chapter">
<h2 class="ch"><span>10</span>익명성 보호 원칙</h2>
<ul>
  <li>학번·이름·이메일·IP·기기 정보를 수집하지 않습니다. 학생은 로그인하지 않습니다.</li>
  <li>제출 <b>날짜만</b> 저장하고 시각은 저장하지 않습니다. 응답 행은 시트의 무작위 위치에 들어가 제출 순서를 알 수 없습니다.</li>
  <li>응답이 최소 공개 수 미만이면 결과·내보내기·비교가 모두 잠깁니다.</li>
  <li>서술형 응답은 무작위 순서로 보여 줍니다.</li>
  <li>일회용 토큰은 해시로만 저장되어, 어떤 토큰이 어떤 응답인지 연결할 수 없습니다.</li>
  <li>성별 같은 드롭다운 문항은 집단이 작으면 인원수와 비교 결과를 숨깁니다(기본 문항에서는 제외).</li>
</ul>
<div class="warnbox"><b>한계:</b> 접속코드 방식은 같은 학생의 중복 응답을 완전히 막지 못합니다(같은 기기에서는 「이미 제출」 안내만 표시). 주소와 접속코드가 단체방 등으로 퍼지면 수업 밖에서도 응답할 수 있습니다. 1인 1회가 중요하면 일회용 토큰을 쓰고, 응답 기간을 짧게 잡으세요.</div>
</section>

<section class="chapter">
<h2 class="ch"><span>11</span>자주 묻는 질문과 문제 해결</h2>
<table>
<tr><th style="width:34%">증상</th><th>원인과 해결</th></tr>
<tr><td>학생 링크에서 「현재 파일을 열 수 없습니다」</td><td>① 시크릿 창이나 로그인하지 않은 휴대폰에서 열어 보세요. 열리면 교수님 브라우저에 Google 계정이 여러 개 로그인된 탓이며 학생에게는 문제가 없습니다.<br>② 시크릿 창에서도 안 열리면 [배포 관리]에서 <b>실행: 나 / 액세스: 모든 사용자</b>인지 확인하세요.<br>③ [배포 관리]의 웹 앱 URL과 [설정]의 학생용 웹 앱 주소가 같은지 확인하세요.</td></tr>
<tr><td>학생에게 Google 로그인 화면이 뜸</td><td>배포의 액세스가 「Google 계정이 있는 모든 사용자」입니다. 「모든 사용자」로 바꾸고 새 버전으로 배포하세요.</td></tr>
<tr><td>관리자 화면에 「테스트용(/dev) 주소로 열었습니다」</td><td>편집기의 테스트 배포 주소로 접속했습니다. [배포 관리]의 <code>…/exec</code> 주소에 <code>?page=admin</code>을 붙여 접속하세요.</td></tr>
<tr><td>「다른 교과목이 이미 쓰는 접속코드입니다」</td><td>공통 주소에서 코드로 교과목을 찾기 때문에 코드는 교과목마다 달라야 합니다. 다른 코드를 입력하거나 자동 생성 버튼을 누르세요.</td></tr>
<tr><td>모든 교과목 학생 주소가 휴대폰에서 「현재 파일을 열 수 없습니다」(배포는 실행: 나 / 액세스: 모든 사용자로 정상)</td><td>이 스프레드시트에 연결된 Apps Script 프로젝트의 배포가 로그인 없는 접속에서 막힌 경우입니다(같은 계정의 새 프로젝트는 정상). <b>①</b> 스프레드시트 <span class="kbd">파일 ▸ 사본 만들기</span> <b>②</b> 사본의 <span class="kbd">확장 프로그램 ▸ Apps Script</span>에서 <b>setup</b> 실행 — 사본임을 알아차려 원본의 학생용 주소를 자동으로 비웁니다 <b>③</b> <span class="kbd">배포 ▸ 새 배포 ▸ 웹 앱</span>(실행: 나 / 액세스: 모든 사용자) <b>④</b> 새 URL 끝에 <code>?page=admin</code>을 붙여 접속하면 새 주소가 자동 저장됩니다 <b>⑤</b> [접속 주소]의 새 주소를 안내하고, 휴대폰 개인정보 보호(시크릿) 모드로 열리는지 확인합니다. 교과목·문항·응답·PIN은 사본에 그대로 있습니다.</td></tr>
<tr><td>v1.5 독립형 설치를 시험했다가 되돌릴 때</td><td>스프레드시트의 <span class="kbd">확장 프로그램 ▸ Apps Script</span>(연결형)에 최신 설치 파일을 붙여 넣고 <b>setup</b>을 실행합니다. Settings의 쓰지 않는 행(script_id·webapp_script_id)을 지우고 학생 주소를 이 프로젝트의 배포 주소로 다시 저장합니다. 이어서 「배포 관리 ▸ 새 버전」으로 배포하고 [접속 주소]에서 주소를 확인하세요. 독립형 프로젝트는 배포를 보관한 뒤 Drive에서 삭제해도 됩니다.</td></tr>
<tr><td>예전에 안내한 링크로 들어온 학생</td><td>「이전 방식의 링크입니다」 안내와 함께 접속코드 입력 화면이 나옵니다. 공통 주소와 접속코드를 다시 안내하세요.</td></tr>
<tr><td>결과가 열리지 않음</td><td>응답 수가 최소 공개 수(기본 5명) 미만이거나 결과 공개일 이전입니다.</td></tr>
<tr><td>문항을 고칠 수 없음</td><td>응답이 들어온 교과목은 문항이 잠깁니다. [복제]로 새 교과목을 만들어 고치세요.</td></tr>
<tr><td>PIN을 잊었음</td><td>스프레드시트 메뉴 <span class="kbd">② 관리자 PIN 설정·재설정</span>에서 다시 정합니다(스프레드시트 소유자만 가능).</td></tr>
<tr><td>PIN 입력이 잠김</td><td>5회 틀리면 10분간 잠깁니다. 10분 뒤 다시 시도하세요.</td></tr>
<tr><td>교수자 로그인 화면에 PIN 입력 상자가 없음</td><td><code>?page=admin</code> 없이 공통 주소로 들어갔습니다. 접속코드 화면 아래 <span class="kbd">교수자 로그인</span> 링크를 누르세요.</td></tr>
<tr><td>Items 시트에 같은 문항이 여러 번 있음</td><td>정상입니다. 기본 문항 은행(TEMPLATE)과 교과목마다 문항을 따로 복사해 둡니다. 지우면 해당 교과목 설문에서 문항이 사라지므로 지우지 마세요.</td></tr>
<tr><td>Tokens 시트가 비어 있음</td><td>모든 교과목이 접속코드 방식이면 비어 있는 것이 정상입니다. 앱이 이 시트를 읽으므로 <b>지우지 마세요</b>(지우면 관리자 화면이 열리지 않습니다). 거슬리면 시트 탭을 [숨기기] 하세요.</td></tr>
<tr><td>Responses 시트에 빈칸이 많음</td><td>정상입니다. 응답 시트는 <b>문항마다 열이 따로</b> 있고 교과목마다 문항 ID가 다르므로, 한 교과목의 응답 행은 다른 교과목의 문항 열에서 비어 있습니다(예: 디지털리터러시와 AI활용 행은 AI융합 간호정보학 문항 열이 빈칸). 각 교과목의 답은 자기 문항 열에 모두 채워져 있습니다. 오른쪽으로 스크롤해 보세요. <b>머리글 색이 교과목마다 다르고</b>, 머리글에 마우스를 올리면 「[교과목명] [영역] 문항」이 보이며, A~C열(응답 ID·교과목 ID·날짜)은 고정되어 있습니다. 샘플 응답을 만들면 교과목별 열 범위(예: AF~BK열)도 함께 알려 줍니다.</td></tr>
<tr><td>시트를 고치려는데 경고 창이 뜸</td><td>앱이 관리하는 시트의 보호 경고입니다. 관리자 화면에서 고치는 것이 안전합니다.</td></tr>
<tr><td>동시에 많은 학생이 제출</td><td>제출은 잠금으로 한 건씩 순서대로 처리되고, 일시적으로 바쁘면 자동으로 다시 시도합니다. 실제 사용 전에 학생 몇 명과 함께 동시에 제출해 보는 것을 권장합니다.</td></tr>
</table>
</section>

<section class="chapter">
<h2 class="ch"><span>12</span>부록: 스프레드시트 구조</h2>
<p>모든 데이터는 교수 본인의 스프레드시트 한 개에 저장됩니다. 시트 5개의 역할은 다음과 같습니다. <b>시트를 지우거나 이름을 바꾸면 앱이 동작하지 않습니다.</b></p>
<table>
<tr><th style="width:16%">시트</th><th style="width:34%">저장하는 내용</th><th style="width:22%">주요 열</th><th>관리 방법</th></tr>
<tr><td><b>Settings</b></td><td>교수명·소속, 학과 목록, 최소 공개 수, 학생용 웹 앱 주소, PIN 해시·salt, 설치 버전</td><td>key · value · description</td><td>관리자 화면 [설정]. PIN·salt 행은 직접 고치지 마세요.</td></tr>
<tr><td><b>Courses</b></td><td>교과목 1개 = 1행. 학년도·학기·학년, 응답 기간, 참여 방식·접속코드, 상태(진행·마감), 수업 방식, 교과목 유형</td><td>course_id · course_name · start_at · end_at · access_code · status</td><td>관리자 화면 [교과목] (경고 보호)</td></tr>
<tr><td><b>Items</b></td><td>문항 1개 = 1행. <code>TEMPLATE</code> 행은 공통 기본 문항 은행, 나머지는 교과목별 복사본</td><td>item_id · course_id · domain · text · type · required · scope</td><td>관리자 화면 [문항] (경고 보호)</td></tr>
<tr><td><b>Tokens</b></td><td>일회용 토큰의 <b>해시</b>와 사용 여부(토큰 원문은 저장하지 않음). 접속코드 방식만 쓰면 비어 있음</td><td>course_id · token_hash · used</td><td>관리자 화면 [토큰] (경고 보호). 지우지 마세요.</td></tr>
<tr><td><b>Responses</b></td><td>응답 1건 = 1행(무작위 위치). 제출 날짜만, 문항별 답은 item_id 열에 저장. 모든 교과목이 한 시트를 함께 쓰므로 다른 교과목의 문항 열은 빈칸</td><td>response_id · course_id · submitted_date · 문항 ID 열들</td><td>직접 편집 금지(경고 보호). 학기 시작 전 메뉴 「응답 시트 빈 열 정리」</td></tr>
</table>
<div class="tip"><b>백업:</b> 학기가 끝나면 Google 드라이브에서 스프레드시트를 <span class="kbd">사본 만들기</span>로 보관하거나, 결과 화면의 CSV·CQI 요약표를 내려받아 두세요.</div>
<p style="margin-top:6mm;color:var(--muted);font-size:9pt">본 매뉴얼의 화면은 v${VERSION} 기준이며, 교과목·응답은 예시 자료입니다.</p>
</section>
</body></html>`;
}

(async () => {
  fs.mkdirSync(IMG, { recursive: true });
  const srv = await P.start(0);
  const base = `http://127.0.0.1:${srv.address().port}/exec`;
  const browser = await chromium.launch();
  try {
    await capture(base, browser);
    const htmlPath = path.join(OUT_DIR, 'manual.html');
    fs.writeFileSync(htmlPath, html());
    const page = await (await browser.newContext()).newPage();
    await page.goto('file://' + htmlPath);
    await page.evaluate(() => document.fonts.ready);
    await page.pdf({
      path: PDF, format: 'A4', printBackground: true, displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `<div style="width:100%;font-size:8px;color:#5b6078;padding:0 16mm;display:flex;justify-content:space-between;font-family:sans-serif"><span>강의평가 Studio 사용자 매뉴얼 · v${VERSION}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
      margin: { top: '18mm', bottom: '18mm', left: '16mm', right: '16mm' }
    });
    console.log('매뉴얼 생성 완료:', path.relative(ROOT, PDF));
  } finally {
    await browser.close();
    srv.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
