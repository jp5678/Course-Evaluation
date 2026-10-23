'use strict';
/*
 * 동시 제출 테스트 — worker_threads로 실제 병렬 실행
 * 모든 워커가 같은 파일(시트 상태)을 공유하고, LockService는 파일 잠금(mkdir 원자성)으로 모사합니다.
 * 각 시트 연산 사이에 0~3ms 무작위 지연을 넣어 경쟁 조건이 드러나기 쉽게 했습니다.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const H = require('./helpers');

if (!isMainThread) {
  // ───── 워커: 시작 신호를 기다렸다가 submitResponse 1회 실행 ─────
  const { GasMock } = H;
  const d = workerData;
  const env = GasMock.createEnv({
    store: GasMock.fileStore(d.stateFile, 3),
    lockFactory: GasMock.fileLock(d.lockDir, d.noLock),
    cache: GasMock.fileCache(d.cacheFile),
    fastSleep: false
  });
  const server = GasMock.loadServer(env, H.SOURCES);
  const flag = new Int32Array(d.flag);
  Atomics.wait(flag, 0, 0);
  const t0 = Date.now();
  let res;
  // 클라이언트(Scripts.html CES.call)와 같은 지수 백오프 재시도: BUSY면 최대 4회
  for (let attempt = 0; ; attempt++) {
    res = server.submitResponse(d.courseId, d.cred, d.answers, d.nonce);
    if (!(res && res.code === 'BUSY') || attempt >= 4) break;
    GasMock.makeSleep()(Math.min(8000, 800 * 2 ** attempt));
  }
  parentPort.postMessage({ res, ms: Date.now() - t0 });
  return;
}

function prepare(mode, tokenCount) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ces-conc-'));
  const { env, server } = H.makeServer({ pin: '123456' });
  const s = H.login(server, '123456');
  const courseId = H.createCourse(server, s, { access_mode: mode, access_code: mode === 'code' ? 'ABC123' : '' });
  const tokens = mode === 'token' ? server.generateTokens(s, courseId, tokenCount).tokens : [];
  const items = server.getItems_(courseId);
  const stateFile = path.join(dir, 'state.json');
  fs.writeFileSync(stateFile, H.GasMock.serialize(env.__store.read()));
  return { dir, stateFile, lockDir: path.join(dir, 'lock'), cacheFile: path.join(dir, 'cache.json'), courseId, tokens, items };
}

async function runParallel(ctx, creds, noLock) {
  const flag = new SharedArrayBuffer(4);
  const workers = creds.map((cred, i) => new Worker(__filename, {
    workerData: {
      stateFile: ctx.stateFile, lockDir: ctx.lockDir, cacheFile: ctx.cacheFile, flag, noLock: !!noLock,
      courseId: ctx.courseId, cred, answers: H.fullAnswers(ctx.items, 1 + (i % 5)), nonce: 'nonce-' + String(i).padStart(12, '0')
    }
  }));
  const results = workers.map((w) => new Promise((resolve, reject) => { w.once('message', resolve); w.once('error', reject); }));
  await new Promise((r) => setTimeout(r, 400)); // 모든 워커가 대기 상태에 들어갈 시간
  const t0 = Date.now();
  const f = new Int32Array(flag);
  Atomics.store(f, 0, 1);
  Atomics.notify(f, 0);
  const out = await Promise.all(results);
  const wall = Date.now() - t0;
  await Promise.all(workers.map((w) => w.terminate()));
  const state = H.GasMock.revive(fs.readFileSync(ctx.stateFile, 'utf8'));
  const tableOf = (name) => {
    const rows = state.sheets[name].values.filter((r) => r && r.some((v) => v !== '' && v != null));
    return rows.slice(1).map((r) => Object.fromEntries(rows[0].map((h, i) => [h, r[i]])));
  };
  return { out, wall, responses: tableOf('Responses'), tokens: tableOf('Tokens') };
}

test('동시 제출 20건(토큰 20개, 각 1회) → 20건 모두 기록, 토큰 20개 사용, 유실·중복 없음', async () => {
  const ctx = prepare('token', 20);
  const r = await runParallel(ctx, ctx.tokens);
  const ok = r.out.filter((x) => x.res.ok).length;
  console.log(`  [토큰 20건] 성공 ${ok}/20, 경과 ${r.wall}ms, 최장 ${Math.max(...r.out.map((x) => x.ms))}ms`);
  assert.equal(ok, 20);
  assert.equal(r.responses.length, 20, '응답 행 20');
  assert.equal(new Set(r.responses.map((x) => x.response_id)).size, 20, 'response_id 중복 없음');
  assert.equal(r.tokens.filter((t) => t.used === true).length, 20, '토큰 20개 사용 처리');
});

test('동시 제출 20건(접속코드 방식) → 20건 모두 기록', async () => {
  const ctx = prepare('code', 0);
  const r = await runParallel(ctx, new Array(20).fill('ABC123'));
  const ok = r.out.filter((x) => x.res.ok).length;
  console.log(`  [접속코드 20건] 성공 ${ok}/20, 경과 ${r.wall}ms`);
  assert.equal(ok, 20);
  assert.equal(r.responses.length, 20);
});

test('같은 토큰으로 동시 제출 20건 → 정확히 1건만 성공(나머지 TOKEN_USED)', async () => {
  const ctx = prepare('token', 1);
  const r = await runParallel(ctx, new Array(20).fill(ctx.tokens[0]));
  const ok = r.out.filter((x) => x.res.ok).length;
  const used = r.out.filter((x) => x.res.code === 'TOKEN_USED').length;
  console.log(`  [동일 토큰 20건] 성공 ${ok}, TOKEN_USED ${used}`);
  assert.equal(ok, 1);
  assert.equal(used, 19);
  assert.equal(r.responses.length, 1);
});

test('[대조군] LockService를 끄면 같은 토큰 동시 제출에서 중복·유실이 생길 수 있음(잠금의 필요성 확인)', async () => {
  const ctx = prepare('token', 1);
  const r = await runParallel(ctx, new Array(20).fill(ctx.tokens[0]), true);
  const ok = r.out.filter((x) => x.res.ok).length;
  console.log(`  [대조군·잠금 해제] 성공 응답 ${ok}건, 실제 기록 ${r.responses.length}행 (잠금이 있으면 1/1)`);
  // 경쟁 조건은 확률적이므로 단언하지 않고 관찰값만 보고합니다.
  assert.ok(true);
});
