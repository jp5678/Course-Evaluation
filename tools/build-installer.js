'use strict';
/*
 * 정식 설치용 단일 파일 빌드
 *   node tools/build-installer.js  →  dist/CourseEvaluationStudio.gs
 * Code.gs·Setup.gs와 HTML 4개(Student·Admin·Styles·Scripts)를 Apps Script 파일 하나로 묶습니다.
 * 교수는 스프레드시트의 Apps Script 편집기에 이 파일 하나만 붙여 넣으면 됩니다.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const version = /VERSION:\s*'([^']+)'/.exec(read('Code.gs'))[1];

const files = {};
['Student', 'Admin', 'Styles', 'Scripts'].forEach((n) => { files[n] = read(n + '.html'); });

function rewrite(src, name) {
  const before = src;
  src = src
    .replace("HtmlService.createTemplateFromFile(isAdmin ? 'Admin' : 'Student')", "__template_(isAdmin ? 'Admin' : 'Student')")
    .replace('HtmlService.createHtmlOutputFromFile(name).getContent()', '__FILES__[name]')
    // 프로젝트 시간대 설정과 무관하게 한국 시간으로 계산
    .replace(/function tz_\(\) \{[\s\S]*?\n\}/, "function tz_() {\n  return 'Asia/Seoul';\n}");
  if (name === 'Code.gs' && (src === before || /createTemplateFromFile|createHtmlOutputFromFile/.test(src))) {
    throw new Error('Code.gs 변환 실패: 파일 접근 코드가 남아 있습니다');
  }
  return src;
}

const out = `/**
 * ============================================================
 *  강의평가 Studio v${version} — 정식 설치 파일(단일 파일)
 * ============================================================
 *  설치 방법
 *  1) 스프레드시트 ▸ [확장 프로그램] ▸ [Apps Script]
 *  2) 왼쪽 'Code.gs'의 내용을 모두 지우고 이 파일 전체를 붙여 넣은 뒤 저장(Ctrl+S)
 *  3) 위쪽 함수 선택에서 'setup' 선택 ▸ [실행] ▸ 권한 승인
 *  4) [배포] ▸ [새 배포] ▸ 웹 앱 (실행: 나 / 액세스: 모든 사용자)
 *  5) 스프레드시트 새로고침 ▸ 메뉴 [강의평가 Studio] ▸ ② 관리자 PIN 설정
 *  자세한 안내: https://github.com/jp5678/Course-Evaluation#설치-가이드-교수용--약-15분
 *
 *  ※ 이 파일은 tools/build-installer.js로 생성됩니다. 원본 소스는 저장소의 Code.gs·Setup.gs·*.html입니다.
 *  ※ 학교 공식 강의평가를 대체하지 않는 교수자 자율형 형성평가·CQI 도구입니다.
 *  Developed by 정종필 교수 · 청암대학교 간호학과
 *
 * @OnlyCurrentDoc
 */

/* ───── 화면 파일(HTML) — 원본: Student.html, Admin.html, Styles.html, Scripts.html ───── */
var __FILES__ = ${JSON.stringify(files, null, 1)};

function __template_(name) {
  return HtmlService.createTemplate(__FILES__[name]);
}

/* ───── Code.gs ───── */
${rewrite(read('Code.gs'), 'Code.gs')}

/* ───── Setup.gs ───── */
${rewrite(read('Setup.gs'), 'Setup.gs')}
`;

fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist', 'CourseEvaluationStudio.gs'), out);
// 내려받기용: Apps Script의 Code.gs에 그대로 붙여 넣는 파일(내용 동일, 파일 이름만 Code.gs)
fs.writeFileSync(path.join(ROOT, 'dist', 'Code.gs'), out);
console.log(`설치 파일 빌드 완료: dist/CourseEvaluationStudio.gs, dist/Code.gs (v${version}, ${(Buffer.byteLength(out) / 1024).toFixed(0)} KB)`);
