'use strict';
/* WCAG 2.2 대비 검사: Styles.html의 :root 토큰을 읽어 텍스트(4.5:1)·UI(3:1) 조합을 확인 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'Styles.html'), 'utf8');
function tokens(block) {
  const out = {};
  for (const m of block.matchAll(/--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})/g)) out[m[1]] = m[2];
  return out;
}
const light = tokens(css.slice(css.indexOf(':root {'), css.indexOf('@media (prefers-color-scheme: dark)')));
const darkBlock = css.slice(css.indexOf(':root:not([data-theme="light"])'));
const dark = Object.assign({}, light, tokens(darkBlock.slice(0, darkBlock.indexOf('}'))));

const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// [전경, 배경, 최소 대비, 용도]
const pairs = [
  ['ink', 'bg', 4.5, '본문'], ['ink', 'surface', 4.5, '카드 본문'], ['muted', 'bg', 4.5, '보조 텍스트(배경)'],
  ['muted', 'surface', 4.5, '보조 텍스트(카드)'], ['on-primary', 'primary', 4.5, '주 버튼·선택 칩'],
  ['primary-ink', 'surface', 4.5, '링크·영역명'], ['primary-ink', 'primary-soft', 4.5, '진행 중 배지'],
  ['danger-ink', 'surface', 4.5, '오류 메시지'], ['danger-ink', 'danger-soft', 4.5, '위험 배지'],
  ['ink', 'butter', 4.5, '경고 카드'], ['ink', 'sky', 4.5, '정보 카드'], ['ink', 'primary-soft', 4.5, '강조 카드'],
  ['focus', 'surface', 3, '포커스 링'], ['control', 'surface', 3, '입력·칩 경계'], ['control', 'bg', 3, '입력·칩 경계(배경)'], ['primary', 'surface', 3, '진행 바·차트 표식']
];

for (const [name, t] of [['라이트', light], ['다크', dark]]) {
  test(`${name} 모드 대비(WCAG 2.2 AA)`, () => {
    const rows = pairs.map(([f, b, min, use]) => ({ use, pair: `${f}/${b}`, ratio: +ratio(t[f], t[b]).toFixed(2), min }));
    console.table(rows);
    const bad = rows.filter((r) => r.ratio < r.min);
    assert.deepEqual(bad, []);
  });
}
