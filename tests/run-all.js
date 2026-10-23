'use strict';
/* 전체 테스트 실행: node run-all.js  (또는 npm test) */
const { spawnSync } = require('child_process');
// 체험판을 먼저 최신 소스로 빌드
spawnSync(process.execPath, [require('path').join(__dirname, '..', 'tools', 'build-demo.js')], { stdio: 'inherit' });
const suites = [
  ['서버 로직·보안', 'server.test.js'],
  ['동시 제출(멀티 스레드)', 'concurrency.test.js'],
  ['QR 인코더(jsQR 디코딩)', 'qr.test.js'],
  ['WCAG 대비', 'contrast.test.js'],
  ['브라우저 UI(Playwright, 360px·데스크톱·다크)', 'ui.test.js'],
  ['체험판(GitHub Pages, 정적 파일)', 'demo.test.js']
];
let failed = 0;
for (const [name, file] of suites) {
  const r = spawnSync(process.execPath, ['--test', '--test-concurrency=1', file], { cwd: __dirname, encoding: 'utf8', env: Object.assign({}, process.env, { TZ: 'Asia/Seoul' }) });
  const out = r.stdout + r.stderr;
  const pass = (/# pass (\d+)/.exec(out) || [])[1];
  const fail = (/# fail (\d+)/.exec(out) || [])[1];
  console.log(`${fail === '0' ? '✔' : '✘'} ${name}: pass ${pass}, fail ${fail}`);
  out.split('\n').filter((l) => /^# {2}\[|^not ok/.test(l)).forEach((l) => console.log('   ' + l.replace(/^#\s*/, '')));
  if (fail !== '0') { failed++; console.log(out); }
}
process.exit(failed ? 1 : 0);
