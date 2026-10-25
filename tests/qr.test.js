'use strict';
/* Scripts.html의 내장 QR 인코더를 실제 디코더(jsQR)로 검증 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const jsQR = require('jsqr');

const html = fs.readFileSync(path.join(__dirname, '..', 'Scripts.html'), 'utf8');
const js = html.replace(/^\s*<script>/, '').replace(/<\/script>\s*$/, '');
const win = {};
vm.runInNewContext(js, { window: win, unescape, encodeURIComponent, Array, Math, String, Object, Error });
const QR = win.CES.QR;

function decode(text) {
  const m = QR.encode(text);
  const scale = 4, quiet = 4, n = m.length, dim = (n + quiet * 2) * scale;
  const data = new Uint8ClampedArray(dim * dim * 4).fill(255);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (!m[y][x]) continue;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const i = (((y + quiet) * scale + dy) * dim + (x + quiet) * scale + dx) * 4;
      data[i] = data[i + 1] = data[i + 2] = 0;
    }
  }
  const r = jsQR(data, dim, dim);
  return { version: (n - 17) / 4, text: r && r.data };
}

const base = 'https://script.google.com/macros/s/AKfycbx' + 'Q'.repeat(72) + '/exec';
const cases = [
  'hello',
  base + '?c=c7k2mx9pq',
  base + '?c=c7k2mx9pq&t=ABCDEFGH',
  // 실제 형식: 접속코드가 담긴 학생 QR(v1.3.0~)
  'https://script.google.com/macros/s/AKfycbwafmZykHzkkBGj0CHzpPdMd0FEyOdnIsfrz2faBBL7SkkgQFJLSDVOqHXRDcWEo8IN/exec?c=demotaam&k=NURSE74',
  base + '?page=admin&x=' + 'a'.repeat(120),
  '강의평가 Studio 한글 UTF-8 테스트 · 간호학과',
  'x'.repeat(600)
];

for (const text of cases) {
  test(`QR 왕복 디코딩 (${text.length}자)`, () => {
    const r = decode(text);
    assert.equal(r.text, text, `버전 ${r.version}`);
  });
}

test('QR SVG 출력은 정사각 viewBox와 접근성 레이블을 가짐', () => {
  const svg = QR.toSvg(base + '?c=abc', { label: 'QR 코드' });
  assert.match(svg, /^<svg[^>]+viewBox="0 0 (\d+) \1"/);
  assert.match(svg, /role="img" aria-label="QR 코드"/);
});
