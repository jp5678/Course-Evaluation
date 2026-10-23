/*
 * Google Apps Script 모의 환경 (Node·브라우저 공용)
 * - Sheets 동작 모사: ' 접두 텍스트, 숫자·날짜·TRUE/FALSE 자동 변환, 수식 실행 감지(__FORMULA__ 표식)
 * - LockService: 메모리(단일 스레드) 또는 파일 잠금(멀티 스레드)
 * - HtmlService: GAS 스크립틀릿(<? ?>, <?= ?>, <?!= ?>) 템플릿 엔진
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GasMock = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var KST = 9 * 3600 * 1000;
  var isNode = typeof process !== 'undefined' && process.versions && process.versions.node;

  /* ───── SHA-256 (동기, 순수 JS) ───── */
  function sha256Bytes(str) {
    var bytes = Array.from(new TextEncoder().encode(str));
    var K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var l = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (var i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (l >>> (i * 8)) & 0xff);
    var w = new Array(64);
    var rotr = function (x, n) { return (x >>> n) | (x << (32 - n)); };
    for (var off = 0; off < bytes.length; off += 64) {
      for (i = 0; i < 16; i++) w[i] = (bytes[off + i * 4] << 24) | (bytes[off + i * 4 + 1] << 16) | (bytes[off + i * 4 + 2] << 8) | bytes[off + i * 4 + 3];
      for (i = 16; i < 64; i++) {
        var s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        var s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (i = 0; i < 64; i++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var t1 = (h + S1 + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H = [H[0] + a, H[1] + b, H[2] + c, H[3] + d, H[4] + e, H[5] + f, H[6] + g, H[7] + h].map(function (x) { return x | 0; });
    }
    var out = [];
    H.forEach(function (x) { for (var k = 3; k >= 0; k--) out.push((x >>> (k * 8)) & 0xff); });
    return out.map(function (b) { return b > 127 ? b - 256 : b; }); // GAS는 부호 있는 바이트 배열
  }

  /* ───── 날짜(Asia/Seoul 고정 +09:00) ───── */
  function formatDate(d, tz, pattern) {
    var k = new Date(d.getTime() + KST);
    var p2 = function (n) { return ('0' + n).slice(-2); };
    var map = {
      yyyy: String(k.getUTCFullYear()), MM: p2(k.getUTCMonth() + 1), dd: p2(k.getUTCDate()),
      HH: p2(k.getUTCHours()), mm: p2(k.getUTCMinutes()), ss: p2(k.getUTCSeconds()), M: String(k.getUTCMonth() + 1)
    };
    return pattern.replace(/'([^']*)'|yyyy|MM|dd|HH|mm|ss|M/g, function (m, lit) { return lit != null ? lit : map[m]; });
  }
  function parseDate(str, tz, pattern) {
    var m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(str);
    if (!m || pattern !== 'yyyy-MM-dd HH:mm') throw new Error('parseDate mock: unsupported ' + str + ' / ' + pattern);
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - KST);
  }

  /* ───── 셀 값 모사 ───── */
  function coerce(v) {
    if (v === null || v === undefined) return '';
    if (v instanceof Date) return new Date(v.getTime());
    if (typeof v !== 'string') return v;
    if (v.charAt(0) === "'") return v.slice(1);
    if (v === '') return '';
    if (/^[=]/.test(v)) return '__FORMULA__' + v;
    if (/^[+-]?\d+(\.\d+)?$/.test(v.trim())) return Number(v);
    if (/^(TRUE|FALSE)$/i.test(v)) return v.toUpperCase() === 'TRUE';
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]) - KST);
    return v;
  }
  function cloneVal(v) { return v instanceof Date ? new Date(v.getTime()) : v; }

  function serialize(state) {
    return JSON.stringify(state, function (k, v) {
      if (this[k] instanceof Date) return { $d: this[k].getTime() };
      return v;
    });
  }
  function revive(json) {
    return JSON.parse(typeof json === 'string' ? json : JSON.stringify(json), function (k, v) {
      return v && typeof v === 'object' && typeof v.$d === 'number' ? new Date(v.$d) : v;
    });
  }

  /* ───── 저장소 ───── */
  function memoryStore(initial) {
    var state = initial || { order: [], sheets: {} };
    return { read: function () { return state; }, write: function (s) { state = s; }, snapshot: function () { return state; } };
  }
  function fileStore(path, jitter) {
    var fs = require('fs');
    var sleep = makeSleep();
    return {
      read: function () { if (jitter) sleep(Math.random() * jitter); return revive(fs.readFileSync(path, 'utf8')); },
      write: function (s) {
        if (jitter) sleep(Math.random() * jitter);
        var tmp = path + '.' + process.pid + '.' + Math.random().toString(36).slice(2) + '.tmp';
        fs.writeFileSync(tmp, serialize(s));
        fs.renameSync(tmp, path); // 원자적 교체(실제 Sheets 읽기는 부분 쓰기를 보지 않음)
      },
      snapshot: function () { return revive(fs.readFileSync(path, 'utf8')); }
    };
  }

  function makeSleep() {
    if (isNode) {
      var sab = new Int32Array(new SharedArrayBuffer(4));
      return function (ms) { if (ms > 0) Atomics.wait(sab, 0, 0, ms); };
    }
    return function () { /* 브라우저: 메인 스레드를 막지 않음 */ };
  }

  /* ───── 시트·범위 ───── */
  function createSpreadsheet(store, log) {
    function S(name) {
      this.name = name;
    }
    function data(name) {
      var st = store.read();
      if (!st.sheets[name]) throw new Error('Sheet deleted: ' + name);
      return { st: st, sh: st.sheets[name] };
    }
    function lastRowOf(sh) {
      for (var r = sh.values.length - 1; r >= 0; r--) {
        if (sh.values[r] && sh.values[r].some(function (v) { return v !== '' && v != null; })) return r + 1;
      }
      return 0;
    }
    function lastColOf(sh) {
      var max = 0;
      sh.values.forEach(function (row) {
        if (!row) return;
        for (var c = row.length - 1; c >= 0; c--) if (row[c] !== '' && row[c] != null) { max = Math.max(max, c + 1); break; }
      });
      return max;
    }
    S.prototype.getName = function () { return this.name; };
    S.prototype.getLastRow = function () { return lastRowOf(data(this.name).sh); };
    S.prototype.getLastColumn = function () { return lastColOf(data(this.name).sh); };
    S.prototype.getMaxRows = function () { return Math.max(1000, data(this.name).sh.values.length); };
    S.prototype.getMaxColumns = function () { return data(this.name).sh.maxCols; };
    S.prototype.insertColumnsAfter = function (after, n) {
      var d = data(this.name);
      d.sh.maxCols += n;
      d.sh.values.forEach(function (row) { if (row) row.splice(after, 0, ...new Array(n).fill('')); });
      store.write(d.st);
    };
    S.prototype.insertRowBefore = function (pos) {
      var d = data(this.name);
      d.sh.values.splice(pos - 1, 0, []);
      store.write(d.st);
    };
    S.prototype.setFrozenRows = function () { return this; };
    S.prototype.setTabColor = function () { return this; };
    S.prototype.protect = function () {
      var name = this.name;
      var prot = { warningOnly: false, description: '' };
      var api = {
        setDescription: function (s) { prot.description = s; save(); return api; },
        setWarningOnly: function (b) { prot.warningOnly = b; save(); return api; }
      };
      function save() { var d = data(name); d.sh.protections = [prot]; store.write(d.st); }
      save();
      return api;
    };
    S.prototype.getProtections = function () { return (data(this.name).sh.protections || []).slice(); };
    S.prototype.getRange = function (row, col, numRows, numCols) {
      numRows = numRows || 1; numCols = numCols || 1;
      if (row < 1 || col < 1) throw new Error('Range out of bounds');
      if (col + numCols - 1 > data(this.name).sh.maxCols) throw new Error('Range exceeds max columns: ' + (col + numCols - 1));
      return new R(this.name, row, col, numRows, numCols);
    };

    function R(name, row, col, nr, nc) { this.n = name; this.r = row; this.c = col; this.nr = nr; this.nc = nc; }
    R.prototype.getValues = function () {
      var sh = data(this.n).sh, out = [];
      for (var i = 0; i < this.nr; i++) {
        var row = sh.values[this.r - 1 + i] || [], line = [];
        for (var j = 0; j < this.nc; j++) {
          var v = row[this.c - 1 + j];
          line.push(v === undefined || v === null ? '' : cloneVal(v));
        }
        out.push(line);
      }
      return out;
    };
    R.prototype.getValue = function () { return this.getValues()[0][0]; };
    R.prototype.setValues = function (vals) {
      if (vals.length !== this.nr || vals.some(function (r) { return r.length !== this.nc; }, this)) {
        throw new Error('setValues dimension mismatch: expected ' + this.nr + 'x' + this.nc + ', got ' + vals.length + 'x' + (vals[0] || []).length);
      }
      var d = data(this.n);
      for (var i = 0; i < this.nr; i++) {
        var ri = this.r - 1 + i;
        d.sh.values[ri] = d.sh.values[ri] || [];
        for (var j = 0; j < this.nc; j++) {
          if (vals[i][j] instanceof Date === false && typeof vals[i][j] === 'object' && vals[i][j] !== null) throw new Error('Object value');
          if (log) log.push({ sheet: this.n, row: ri + 1, col: this.c + j, raw: vals[i][j] });
          d.sh.values[ri][this.c - 1 + j] = coerce(vals[i][j]);
        }
      }
      store.write(d.st);
      return this;
    };
    R.prototype.setValue = function (v) { return this.setValues([[v]]); };
    R.prototype.clearContent = function () {
      var vals = [];
      for (var i = 0; i < this.nr; i++) vals.push(new Array(this.nc).fill(''));
      return this.setValues(vals);
    };
    ['setFontWeight', 'setBackground', 'setFontColor', 'setNumberFormat', 'setNote', 'setNotes', 'clearNote'].forEach(function (m) {
      R.prototype[m] = function () { return this; };
    });

    return {
      getSheetByName: function (name) { return store.read().sheets[name] ? new S(name) : null; },
      insertSheet: function (name) {
        var st = store.read();
        if (st.sheets[name]) throw new Error('exists');
        st.sheets[name] = { values: [], maxCols: 26, protections: [] };
        st.order.push(name);
        store.write(st);
        return new S(name);
      },
      getSheets: function () { return store.read().order.map(function (n) { return new S(n); }); },
      deleteSheet: function (s) {
        var st = store.read();
        delete st.sheets[s.getName()];
        st.order = st.order.filter(function (n) { return n !== s.getName(); });
        store.write(st);
      }
    };
  }

  /* ───── 잠금 ───── */
  function memoryLock(ctl) {
    return function () {
      var mine = false;
      return {
        tryLock: function () { if (ctl.held) return false; ctl.held = true; mine = true; ctl.count = (ctl.count || 0) + 1; return true; },
        waitLock: function () { if (!this.tryLock()) throw new Error('Lock timeout'); },
        releaseLock: function () { if (mine) { ctl.held = false; mine = false; } },
        hasLock: function () { return mine; }
      };
    };
  }
  function fileLock(dir, disabled) {
    var fs = require('fs');
    var sleep = makeSleep();
    return function () {
      var mine = false;
      return {
        tryLock: function (ms) {
          if (disabled) { mine = true; return true; }
          var t0 = Date.now();
          for (;;) {
            try { fs.mkdirSync(dir); mine = true; return true; } catch (e) { if (e.code !== 'EEXIST') throw e; }
            if (Date.now() - t0 > ms) return false;
            sleep(2 + Math.random() * 6);
          }
        },
        releaseLock: function () { if (mine && !disabled) { try { fs.rmdirSync(dir); } catch (e) { /* 무시 */ } } mine = false; },
        hasLock: function () { return mine; }
      };
    };
  }

  /* ───── 캐시 ───── */
  function memoryCache() {
    var m = new Map();
    return {
      get: function (k) { var e = m.get(k); if (!e) return null; if (e.exp < Date.now()) { m.delete(k); return null; } return e.v; },
      put: function (k, v, ttl) { m.set(k, { v: String(v), exp: Date.now() + (ttl || 600) * 1000 }); },
      remove: function (k) { m.delete(k); },
      _map: m
    };
  }
  function fileCache(path) {
    var fs = require('fs');
    var read = function () { try { return JSON.parse(fs.readFileSync(path, 'utf8')); } catch (e) { return {}; } };
    var write = function (o) {
      var tmp = path + '.' + Math.random().toString(36).slice(2) + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(o));
      fs.renameSync(tmp, path);
    };
    return {
      get: function (k) { var o = read()[k]; return o && o.exp > Date.now() ? o.v : null; },
      put: function (k, v, ttl) { var o = read(); o[k] = { v: String(v), exp: Date.now() + (ttl || 600) * 1000 }; write(o); },
      remove: function (k) { var o = read(); delete o[k]; write(o); }
    };
  }

  /* ───── HtmlService(템플릿 엔진) ───── */
  function htmlEscape(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function output(content) {
    var o = {
      _content: content, _title: '', _meta: [],
      getContent: function () { return o._content; },
      setTitle: function (t) { o._title = t; return o; },
      addMetaTag: function (n, c) { o._meta.push([n, c]); return o; },
      setXFrameOptionsMode: function () { return o; },
      setWidth: function () { return o; },
      setHeight: function () { return o; }
    };
    return o;
  }
  function makeHtmlService(readFile, getServer) {
    return {
      XFrameOptionsMode: { DEFAULT: 'DEFAULT', ALLOWALL: 'ALLOWALL' },
      createHtmlOutput: function (html) { return output(html); },
      createHtmlOutputFromFile: function (name) { return output(readFile(name + '.html')); },
      createTemplateFromFile: function (name) { return this.createTemplate(readFile(name + '.html')); },
      createTemplate: function (src) {
        if (typeof src !== 'string') throw new Error('createTemplate: 문자열이 필요합니다');
        var t = {
          evaluate: function () {
            var vars = {};
            Object.keys(t).forEach(function (k) { if (k !== 'evaluate') vars[k] = t[k]; });
            var code = 'var __o="";\n', re = /<\?(!?=)?([\s\S]*?)\?>/g, last = 0, m;
            while ((m = re.exec(src))) {
              code += '__o+=' + JSON.stringify(src.slice(last, m.index)) + ';\n';
              var expr = m[2].trim().replace(/;$/, '');
              if (m[1] === '=') code += '__o+=__esc(' + expr + ');\n';
              else if (m[1] === '!=') code += '__o+=String(' + expr + ');\n';
              else code += m[2] + '\n';
              last = re.lastIndex;
            }
            code += '__o+=' + JSON.stringify(src.slice(last)) + ';return __o;';
            var names = Object.keys(vars);
            /* eslint-disable-next-line no-new-func */
            var fn = new Function(['__esc', 'include'].concat(names).join(','), code);
            return output(fn.apply(null, [htmlEscape, getServer().include].concat(names.map(function (n) { return vars[n]; }))));
          }
        };
        return t;
      }
    };
  }

  /* ───── 환경 조립 ───── */
  function createEnv(opts) {
    opts = opts || {};
    var store = opts.store || memoryStore(opts.state);
    var lockCtl = opts.lockCtl || { held: false };
    var log = opts.writeLog || null;
    var ss = createSpreadsheet(store, log);
    var cache = opts.cache || memoryCache();
    var sleep = opts.sleep || makeSleep();
    var uiCalls = [];
    var serverRef = { current: null };
    var env = {
      SpreadsheetApp: {
        getActiveSpreadsheet: function () { return ss; },
        flush: function () {},
        getUi: function () {
          if (!opts.ui) throw new Error('Cannot call SpreadsheetApp.getUi() from this context.');
          return opts.ui;
        },
        ProtectionType: { SHEET: 'SHEET', RANGE: 'RANGE' }
      },
      LockService: { getScriptLock: opts.lockFactory || memoryLock(lockCtl) },
      CacheService: { getScriptCache: function () { return cache; } },
      Utilities: {
        DigestAlgorithm: { SHA_256: 'SHA_256' },
        Charset: { UTF_8: 'UTF_8' },
        computeDigest: function (alg, str) { return sha256Bytes(String(str)); },
        getUuid: function () {
          if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
          return require('crypto').randomUUID();
        },
        sleep: function (ms) { sleep(opts.fastSleep ? Math.min(ms, 5) : ms); },
        formatDate: formatDate,
        parseDate: parseDate
      },
      Session: { getScriptTimeZone: function () { return 'Asia/Seoul'; } },
      ScriptApp: { getService: function () { return { getUrl: function () { return opts.url || 'https://script.google.com/macros/s/TEST/exec'; } }; } },
      HtmlService: makeHtmlService(opts.readFile || function () { throw new Error('readFile not configured'); }, function () { return serverRef.current; }),
      console: opts.console || console
    };
    env.__store = store;
    env.__cache = cache;
    env.__lockCtl = lockCtl;
    env.__uiCalls = uiCalls;
    env.__serverRef = serverRef;
    return env;
  }

  /** GAS 전역 함수들을 하나의 스코프에 로드하고 모든 최상위 함수를 반환합니다. */
  function loadServer(env, sources) {
    var src = sources.join('\n;\n');
    var names = [];
    var re = /^function\s+([A-Za-z_$][\w$]*)\s*\(/gm, m;
    while ((m = re.exec(src))) names.push(m[1]);
    ['APP', 'HEADERS', 'LIKERT_LABELS', 'DEFAULT_ITEMS'].forEach(function (n) { if (new RegExp('^var ' + n + '\\b', 'm').test(src)) names.push(n); });
    var keys = Object.keys(env).filter(function (k) { return k.indexOf('__') !== 0; });
    /* eslint-disable-next-line no-new-func */
    var fn = new Function(keys.join(','), src + '\nreturn {' + names.map(function (n) { return JSON.stringify(n) + ':' + n; }).join(',') + '};');
    var server = fn.apply(null, keys.map(function (k) { return env[k]; }));
    env.__serverRef.current = server;
    return server;
  }

  /** 반환값에 Date 등 직렬화 불가 값이 있으면 예외(google.script.run 동작 모사). */
  function assertSerializable(v, path) {
    path = path || 'result';
    if (v instanceof Date) throw new Error('google.script.run cannot return Date at ' + path);
    if (typeof v === 'function') throw new Error('function at ' + path);
    if (v && typeof v === 'object') Object.keys(v).forEach(function (k) { assertSerializable(v[k], path + '.' + k); });
  }

  /** 브라우저용 google.script.run 모사 */
  function makeRun(server, opt) {
    opt = opt || {};
    function runner(succ, fail) {
      var base = {
        withSuccessHandler: function (f) { return runner(f, fail); },
        withFailureHandler: function (f) { return runner(succ, f); },
        withUserObject: function () { return runner(succ, fail); }
      };
      return new Proxy(base, {
        get: function (t, name) {
          if (name in t) return t[name];
          return function () {
            var args = JSON.parse(JSON.stringify(Array.prototype.slice.call(arguments)));
            setTimeout(function () {
              try {
                if (/_$/.test(name) || typeof server[name] !== 'function') throw new Error('Script function not found: ' + String(name));
                if (opt.failNext && opt.failNext[name] > 0) { opt.failNext[name]--; throw new Error('NetworkError: 연결 끊김(모의)'); }
                var r = server[name].apply(null, args);
                assertSerializable(r);
                if (opt.onCall) opt.onCall(name, args, r);
                if (succ) succ(r === undefined ? null : JSON.parse(JSON.stringify(r)));
              } catch (e) {
                if (fail) fail(new Error(e.message)); else console.error(e);
              }
            }, opt.latency == null ? 40 : opt.latency);
          };
        }
      });
    }
    return runner(null, null);
  }

  return {
    createEnv: createEnv, loadServer: loadServer, makeRun: makeRun, assertSerializable: assertSerializable,
    memoryStore: memoryStore, fileStore: fileStore, fileLock: fileLock, fileCache: fileCache, memoryCache: memoryCache,
    serialize: serialize, revive: revive, sha256Bytes: sha256Bytes, formatDate: formatDate, makeSleep: makeSleep
  };
});
