/**
 * 강의평가 Studio — 서버 코드
 * 교수자 자율형 형성평가·CQI용 설문 도구입니다. 학교 공식 강의평가를 대체하지 않습니다.
 *
 * 모든 공개 API(google.script.run 대상)는 { ok: boolean, ... } 객체를 반환합니다.
 * 날짜는 문자열로만 반환합니다(google.script.run은 Date 반환을 허용하지 않음).
 *
 * @OnlyCurrentDoc
 */

var APP = {
  NAME: '강의평가 Studio',
  VERSION: '1.4.11',
  SHEETS: {
    SETTINGS: 'Settings',
    COURSES: 'Courses',
    ITEMS: 'Items',
    TOKENS: 'Tokens',
    RESPONSES: 'Responses'
  },
  TEMPLATE_ID: 'TEMPLATE',
  // 학생이 열 수 있는 배포 주소(/exec). /dev(테스트 배포)는 편집자만 열 수 있습니다.
  EXEC_URL_RE: /^https:\/\/script\.google\.com\/(?:a\/macros\/[^/?#]+|macros)\/s\/[A-Za-z0-9_-]+\/exec$/,
  TEXT_MAX: 1000,
  ITEM_TEXT_MAX: 300,
  OPTION_MAX: 60,
  MAX_ITEMS: 60,
  PIN_PATTERN: /^\d{6,12}$/,
  PIN_MAX_FAIL: 5,
  PIN_LOCK_SEC: 600,
  SESSION_SEC: 21600,
  LOCK_WAIT_MS: 25000,
  TOKEN_LENGTH: 8,
  TOKEN_MAX_BATCH: 300,
  TOKEN_ALPHABET: 'ABCDEFGHJKMNPQRSTUVWXYZ23456789',
  ID_ALPHABET: 'abcdefghjkmnpqrstuvwxyz23456789',
  SUBMIT_DEDUP_SEC: 3600,
  MIN_RESPONSES_FLOOR: 3,
  SEMESTERS: ['1', '2'],
  GRADES: [1, 2, 3, 4],
  SECTIONS: ['A', 'B', 'C', 'D', 'E', 'F'],
  DELIVERY: ['대면', '온라인(비대면)', '혼합'],
  // 이전 버전에서 쓰던 수업 방식 이름 → 현재 이름
  DELIVERY_RENAMED: { '비대면': '온라인(비대면)' },
  COURSE_TYPES: ['이론', '실습', '이론+실습'],
  // 문항 표시 조건: ''=항상, online=온라인(비대면)·혼합만, theory=이론 포함 교과목만, practice=실습 포함 교과목만
  SCOPES: ['', 'online', 'theory', 'practice'],
  ITEM_TYPES: ['likert5', 'single', 'multi', 'select', 'text'],
  STATUS: { READY: '준비', OPEN: '진행', CLOSED: '마감' }
};

var HEADERS = {
  Settings: ['key', 'value', 'description'],
  Courses: ['course_id', 'course_name', 'year', 'semester', 'grade', 'section', 'enrollment',
    'start_at', 'end_at', 'access_mode', 'access_code', 'status', 'result_open_date', 'department', 'delivery_mode', 'course_type'],
  Items: ['item_id', 'course_id', 'domain', 'text', 'type', 'required', 'order', 'reverse', 'options', 'scope'],
  Tokens: ['course_id', 'token_hash', 'used'],
  Responses: ['response_id', 'course_id', 'submitted_date']
};

var LIKERT_LABELS = ['전혀 그렇지 않다', '그렇지 않다', '보통이다', '그렇다', '매우 그렇다'];

/* ───────────────────────────── 웹 앱 진입점 ───────────────────────────── */

function doGet(e) {
  var p = (e && e.parameter) || {};
  var settings = {};
  try { settings = getSettingsMap_(); } catch (err) { /* setup 이전: 빈 푸터 */ }
  var isAdmin = String(p.page || '') === 'admin';
  rememberExecUrl_(settings);
  var t = HtmlService.createTemplateFromFile(isAdmin ? 'Admin' : 'Student');
  // 학생은 공통 주소에서 접속코드(또는 토큰)를 입력해 들어옵니다.
  // 이전 버전 링크(?c=…&k=…&t=…)는 자동 접속하지 않고, 접속코드 입력 화면에 안내만 표시합니다.
  t.legacyLink = (p.c || p.k || p.t) ? '1' : '';
  // 공통 주소(학생 접속코드 화면)에서 교수자 로그인으로 가는 주소: 저장된 학생용 /exec 주소 우선
  var base = '';
  try { base = studentBaseUrl_(settings) || webAppUrl_(); } catch (err) { base = ''; }
  t.adminUrl = base ? base + '?page=admin' : '';
  t.professorName = String(settings.professor_name || '');
  t.affiliation = String(settings.affiliation || '');
  return t.evaluate()
    .setTitle(isAdmin ? APP.NAME + ' · 교수' : APP.NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/** HTML include 패턴: <?!= include('Styles'); ?> */
function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/* ───────────────────────────── 학생 API ───────────────────────────── */

/** 교과목 카드 정보와 현재 상태(준비/진행/마감)를 반환합니다. */
function getCourseForStudent(courseId) {
  return safe_(function () {
    var course = findCourse_(sanitizeId_(courseId));
    if (!course) return { ok: false, code: 'NOT_FOUND' };
    var items = itemsForCourse_(course);
    return {
      ok: true,
      state: effectiveStatus_(course, new Date()),
      course: publicCourse_(course, items, getSettingsMap_())
    };
  });
}

/**
 * 공통 주소에서 접속코드(또는 일회용 토큰)만으로 교과목을 찾습니다.
 * 같은 코드가 여럿이면 응답 기간 중인 교과목을 우선합니다. 실패 시 지연으로 무차별 대입을 늦춥니다.
 */
function findCourseByCode(code) {
  return safe_(function () {
    var raw = String(code == null ? '' : code).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
    if (!raw) return { ok: false, code: 'BAD_CODE' };
    var now = new Date();
    var courses = getCourses_();
    var hits = courses.filter(function (c) {
      return c.access_mode !== 'token' && String(c.access_code || '').trim().toUpperCase() === raw;
    });
    var isToken = false;
    if (!hits.length && raw.length === APP.TOKEN_LENGTH) {
      var tokens = readTable_(APP.SHEETS.TOKENS).rows;
      var salt = tokenSalt_();
      hits = courses.filter(function (c) {
        if (c.access_mode !== 'token') return false;
        var h = tokenHash_(c.course_id, raw, salt);
        return tokens.some(function (r) { return String(r.course_id) === c.course_id && String(r.token_hash) === h; });
      });
      isToken = hits.length > 0;
    }
    if (!hits.length) {
      Utilities.sleep(400);
      return { ok: false, code: 'BAD_CODE' };
    }
    var open = hits.filter(function (c) { return effectiveStatus_(c, now) === APP.STATUS.OPEN; });
    return { ok: true, course_id: (open[0] || hits[0]).course_id, token: isToken };
  });
}

/** 접속코드 또는 토큰을 확인하고 문항을 반환합니다(토큰은 이 단계에서 사용 처리하지 않음). */
function verifyAccess(courseId, credential) {
  return safe_(function () {
    var course = findCourse_(sanitizeId_(courseId));
    if (!course) return { ok: false, code: 'NOT_FOUND' };
    var state = effectiveStatus_(course, new Date());
    if (state !== APP.STATUS.OPEN) return { ok: false, code: stateCode_(state) };
    var check = checkCredential_(course, credential);
    if (!check.ok) {
      Utilities.sleep(400); // 무차별 대입 속도 저하
      return { ok: false, code: check.code };
    }
    return {
      ok: true,
      items: itemsForCourse_(course).map(publicItem_),
      likertLabels: LIKERT_LABELS
    };
  });
}

/**
 * 응답을 제출합니다.
 * 토큰 검증 → 사용 처리 → 응답 기록을 스크립트 잠금 안에서 원자적으로 수행합니다.
 * nonce는 네트워크 재시도 시 중복 기록을 막는 멱등 키이며, 응답과 함께 저장하지 않습니다.
 */
function submitResponse(courseId, credential, answers, nonce) {
  return safe_(function () {
    var course = findCourse_(sanitizeId_(courseId));
    if (!course) return { ok: false, code: 'NOT_FOUND' };
    var state = effectiveStatus_(course, new Date());
    if (state !== APP.STATUS.OPEN) return { ok: false, code: stateCode_(state) };

    var items = itemsForCourse_(course);
    var clean = sanitizeAnswers_(items, answers);
    if (!clean.ok) return clean;

    nonce = /^[A-Za-z0-9-]{16,64}$/.test(String(nonce || '')) ? String(nonce) : '';
    var cache = CacheService.getScriptCache();

    return withLock_(function () {
      if (nonce && cache.get('sub_' + nonce)) return { ok: true, duplicate: true };

      var check = checkCredential_(course, credential);
      if (!check.ok) return { ok: false, code: check.code };

      if (check.tokenRow) setTokenUsed_(check.tokenRow, true);
      try {
        retry_(function () {
          appendResponse_(course.course_id, items, clean.values, Utilities.getUuid());
        });
      } catch (err) {
        if (check.tokenRow) setTokenUsed_(check.tokenRow, false);
        throw err;
      }
      if (nonce) cache.put('sub_' + nonce, '1', APP.SUBMIT_DEDUP_SEC);
      return { ok: true };
    });
  });
}

/* ───────────────────────────── 교수 인증 API ───────────────────────────── */

function adminLogin(pin) {
  return safe_(function () {
    var cache = CacheService.getScriptCache();
    var now = Date.now();
    var lockedUntil = Number(cache.get('pin_lock_until') || 0);
    if (lockedUntil > now) {
      return { ok: false, code: 'LOCKED', remainSec: Math.ceil((lockedUntil - now) / 1000) };
    }
    var s = getSettingsMap_();
    if (!s.pin_hash) return { ok: false, code: 'NO_PIN' };

    pin = String(pin == null ? '' : pin);
    var valid = APP.PIN_PATTERN.test(pin) && safeEqual_(hashPin_(pin, s.pin_salt), String(s.pin_hash));
    if (!valid) {
      var failed = withLock_(function () {
        var fails = Number(cache.get('pin_fail') || 0) + 1;
        if (fails >= APP.PIN_MAX_FAIL) {
          cache.put('pin_lock_until', String(Date.now() + APP.PIN_LOCK_SEC * 1000), APP.PIN_LOCK_SEC);
          cache.remove('pin_fail');
          return { ok: false, code: 'LOCKED', remainSec: APP.PIN_LOCK_SEC };
        }
        cache.put('pin_fail', String(fails), APP.PIN_LOCK_SEC);
        return { ok: false, code: 'WRONG', left: APP.PIN_MAX_FAIL - fails };
      });
      if (failed.code === 'WRONG') Utilities.sleep(500); // 잠금 밖에서 지연
      return failed;
    }
    cache.remove('pin_fail');
    var session = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
    cache.put('sess_' + session, String(s.session_epoch || '0'), APP.SESSION_SEC);
    return { ok: true, session: session };
  });
}

function adminLogout(session) {
  return safe_(function () {
    if (isSessionFormat_(session)) CacheService.getScriptCache().remove('sess_' + session);
    return { ok: true };
  });
}

function changePin(session, currentPin, newPin) {
  return adminApi_(session, function () {
    var s = getSettingsMap_();
    if (!safeEqual_(hashPin_(String(currentPin || ''), s.pin_salt), String(s.pin_hash))) {
      return { ok: false, code: 'WRONG' };
    }
    if (!APP.PIN_PATTERN.test(String(newPin || ''))) return { ok: false, code: 'PIN_FORMAT' };
    withLock_(function () { storePin_(String(newPin)); });
    return { ok: true };
  });
}

/* ───────────────────────────── 교수 데이터 API ───────────────────────────── */

/** 대시보드·교과목 목록·설정을 한 번에 반환합니다. */
function getAdminBootstrap(session) {
  return adminApi_(session, function () {
    var settings = getSettingsMap_();
    var minN = minResponses_(settings);
    var courses = getCourses_();
    var itemsByCourse = groupBy_(getAllItems_(), 'course_id');
    var respByCourse = groupBy_(readResponses_(), 'course_id');
    var tokenStats = getTokenStats_();
    var now = new Date();
    var url = studentBaseUrl_(settings);
    var current = webAppUrl_();

    var list = courses.map(function (c) {
      var rows = respByCourse[c.course_id] || [];
      var its = filterScope_(itemsByCourse[c.course_id] || [], c);
      var lock = resultLock_(c, rows.length, minN, now);
      var summary = courseSummary_(c, rows.length, now, url);
      summary.locked_reason = lock;
      var st = lock || !rows.length ? null : computeStats_(its, rows);
      summary.mean = st ? st.overall : null;
      summary.pos_pct = st ? st.overall_pos_pct : null;
      summary.domains = st ? st.domains.map(function (d) { return { domain: d.domain, mean: d.mean, pos_pct: d.pos_pct }; }) : [];
      summary.item_count = its.length;
      summary.est_minutes = estMinutes_(its);
      var todayKey = fmtD_(now);
      summary.today_count = rows.filter(function (r) { return dateOnly_(r.submitted_date) === todayKey; }).length; // 오늘(한국 시간) 새 응답
      summary.tokens_total = (tokenStats[c.course_id] || {}).total || 0;
      summary.tokens_used = (tokenStats[c.course_id] || {}).used || 0;
      return summary;
    });
    list.sort(function (a, b) {
      return (b.year - a.year) || (semesterRank_(b.semester) - semesterRank_(a.semester)) ||
        String(a.course_name).localeCompare(String(b.course_name)) || String(a.section).localeCompare(String(b.section));
    });

    return {
      ok: true,
      settings: {
        professor_name: String(settings.professor_name || ''),
        affiliation: String(settings.affiliation || ''),
        min_responses: minN,
        departments: departments_(settings),
        webapp_url: String(settings.webapp_url || '')
      },
      courses: list,
      webAppUrl: url,
      currentUrl: APP.EXEC_URL_RE.test(current) ? current : '',
      devMode: isDevUrl_(current),
      now: fmtDT_(now),
      version: APP.VERSION
    };
  });
}

/** 교과목 생성(course_id 없음) 또는 수정. */
function saveCourse(session, data) {
  return adminApi_(session, function () {
    var v = validateCourse_(data || {});
    if (!v.ok) return v;
    var c = v.course;
    return withLock_(function () {
      var table = readTable_(APP.SHEETS.COURSES);
      var existing = null;
      if (data.course_id) {
        existing = table.rows.filter(function (r) { return String(r.course_id) === String(data.course_id); })[0];
        if (!existing) return { ok: false, code: 'NOT_FOUND' };
        c.course_id = existing.course_id;
      } else {
        c.course_id = newCourseId_(table.rows);
      }
      c.status = data.manual_close ? APP.STATUS.CLOSED : statusByDates_(c, new Date());
      // 학생은 공통 주소에서 접속코드로만 들어오므로, 접속코드 방식인데 코드가 비어 있으면 자동으로 만듭니다.
      if (c.access_mode !== 'token' && !String(c.access_code || '').trim()) c.access_code = uniqueAccessCode_(table.rows);
      // 공통 주소에서 접속코드만으로 교과목을 찾으므로 코드는 교과목마다 달라야 합니다.
      var code = String(c.access_code || '').toUpperCase();
      if (c.access_mode !== 'token' && code && table.rows.some(function (r) {
        return String(r.course_id) !== String(c.course_id) && String(r.access_mode) !== 'token' && String(r.access_code || '').trim().toUpperCase() === code;
      })) {
        return { ok: false, code: 'VALIDATION', field: 'access_code', message: '다른 교과목이 이미 쓰는 접속코드입니다. 다른 코드를 입력하세요.' };
      }
      var row = courseToRow_(c);
      if (existing) {
        // 응답이 들어온 뒤 문항 구성(표시 조건)이 바뀌면 앞뒤 응답의 문항이 달라지므로 막습니다.
        var prev = normalizeCourse_(existing);
        var changed = prev.course_type !== c.course_type ? 'course_type' : prev.delivery_mode !== c.delivery_mode ? 'delivery_mode' : '';
        if (changed && readResponses_(c.course_id).length > 0) {
          return { ok: false, code: 'VALIDATION', field: changed, message: '응답이 수집된 뒤에는 수업 방식·교과목 유형을 바꿀 수 없습니다(문항 구성이 바뀌기 때문입니다).' };
        }
        table.sheet.getRange(existing._row, 1, 1, row.length).setValues([row]);
        if (c.delivery_mode !== '대면') addOnlineItems_(c.course_id);
      } else {
        table.sheet.getRange(table.sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
        // 기본 문항을 모두 복사하고, 화면에는 수업 방식·교과목 유형에 맞는 문항만 표시합니다(filterScope_).
        if (data.copy_template !== false) copyItems_(APP.TEMPLATE_ID, c.course_id);
      }
      return { ok: true, course_id: c.course_id };
    });
  });
}

/** 이전 학기 교과목을 새 학기로 복제합니다(문항 포함, 응답·토큰 제외). */
function duplicateCourse(session, sourceId, data) {
  return adminApi_(session, function () {
    var src = findCourse_(sanitizeId_(sourceId));
    if (!src) return { ok: false, code: 'NOT_FOUND' };
    return withLock_(function () { return duplicateCore_(src, data); });
  });
}

/** 복제 공통 처리(잠금 안에서 호출). 새 교과목 ID·접속코드를 돌려줍니다. */
function duplicateCore_(src, data) {
  var merged = {
    course_name: src.course_name, grade: src.grade, enrollment: 0,
    access_mode: src.access_mode, access_code: '',
    department: src.department, delivery_mode: data.delivery_mode || src.delivery_mode,
    course_type: data.course_type || src.course_type,
    year: data.year, semester: data.semester, section: data.section != null ? data.section : '',
    start_at: data.start_at, end_at: data.end_at, result_open_date: data.result_open_date || ''
  };
  var v = validateCourse_(merged);
  if (!v.ok) return v;
  var c = v.course;
  var table = readTable_(APP.SHEETS.COURSES);
  c.course_id = newCourseId_(table.rows);
  c.access_code = uniqueAccessCode_(table.rows); // 공통 주소에서 코드로 교과목을 찾으므로 겹치지 않게
  c.status = statusByDates_(c, new Date());
  var row = courseToRow_(c);
  table.sheet.getRange(table.sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
  copyItems_(src.course_id, c.course_id);
  if (c.delivery_mode !== '대면') addOnlineItems_(c.course_id);
  return { ok: true, course_id: c.course_id, access_code: c.access_code };
}

/**
 * 새 학기 준비: 한 학기의 교과목을 모두 새 학기로 복제(새 접속코드·응답 기간)하고, 원하면 이전 학기 교과목을 마감합니다.
 * data: { from_year, from_semester, year, semester, start_at, end_at, close_old }
 * 새 학기에 같은 이름(·반)의 교과목이 이미 있으면 건너뜁니다(두 번 눌러도 중복 없음).
 */
function prepareNewTerm(session, data) {
  return adminApi_(session, function () {
    data = data || {};
    var fy = Number(data.from_year), fs = String(data.from_semester || '');
    var ty = Number(data.year), ts = String(data.semester || '');
    if (fy === ty && fs === ts) return { ok: false, code: 'VALIDATION', field: 'semester', message: '새 학기는 이전 학기와 달라야 합니다.' };
    return withLock_(function () {
      var all = getCourses_();
      var sources = all.filter(function (c) { return Number(c.year) === fy && String(c.semester) === fs; });
      if (!sources.length) return { ok: false, code: 'VALIDATION', field: 'from', message: '선택한 학기에 교과목이 없습니다.' };
      var key = function (c) { return String(c.course_name).trim() + '|' + String(c.section || ''); };
      var exists = {};
      all.forEach(function (c) { if (Number(c.year) === ty && String(c.semester) === ts) exists[key(c)] = true; });
      var made = [], skipped = [];
      for (var i = 0; i < sources.length; i++) {
        var src = sources[i];
        if (exists[key(src)]) { skipped.push(src.course_name); continue; }
        var r = duplicateCore_(src, { year: ty, semester: ts, start_at: data.start_at, end_at: data.end_at });
        if (!r.ok) return r;
        made.push({ course_id: r.course_id, course_name: src.course_name, access_mode: src.access_mode, access_code: r.access_code });
      }
      var closed = 0;
      if (data.close_old) {
        var t = readTable_(APP.SHEETS.COURSES);
        var col = HEADERS.Courses.indexOf('status') + 1;
        t.rows.forEach(function (r) {
          if (Number(r.year) === fy && String(r.semester) === fs && String(r.status) !== APP.STATUS.CLOSED) {
            t.sheet.getRange(r._row, col).setValue(APP.STATUS.CLOSED);
            closed++;
          }
        });
      }
      return { ok: true, made: made, skipped: skipped, closed: closed };
    });
  });
}

/** 응답이 없는 교과목만 삭제합니다(문항·토큰 함께 삭제). */
function deleteCourse(session, courseId) {
  return adminApi_(session, function () {
    var id = sanitizeId_(courseId);
    if (!id || id === APP.TEMPLATE_ID) return { ok: false, code: 'NOT_FOUND' };
    return withLock_(function () {
      if (readResponses_(id).length > 0) return { ok: false, code: 'HAS_RESPONSES' };
      var removed = filterTable_(APP.SHEETS.COURSES, function (r) { return String(r.course_id) !== id; });
      if (!removed) return { ok: false, code: 'NOT_FOUND' };
      filterTable_(APP.SHEETS.ITEMS, function (r) { return String(r.course_id) !== id; });
      filterTable_(APP.SHEETS.TOKENS, function (r) { return String(r.course_id) !== id; });
      return { ok: true };
    });
  });
}

/** 일회용 토큰 N개를 생성합니다. 원문은 이 응답에서만 반환되고 시트에는 해시만 저장됩니다. */
function generateTokens(session, courseId, count) {
  return adminApi_(session, function () {
    var course = findCourse_(sanitizeId_(courseId));
    if (!course) return { ok: false, code: 'NOT_FOUND' };
    var n = Math.floor(Number(count));
    if (!(n >= 1 && n <= APP.TOKEN_MAX_BATCH)) return { ok: false, code: 'VALIDATION', field: 'count' };
    var salt = tokenSalt_();
    return withLock_(function () {
      var sh = sheet_(APP.SHEETS.TOKENS);
      var existing = {};
      readTable_(APP.SHEETS.TOKENS).rows.forEach(function (r) { existing[String(r.token_hash)] = true; });
      var tokens = [], rows = [];
      while (tokens.length < n) {
        var t = randomString_(APP.TOKEN_LENGTH, APP.TOKEN_ALPHABET);
        var h = tokenHash_(course.course_id, t, salt);
        if (existing[h]) continue;
        existing[h] = true;
        tokens.push(t.slice(0, 4) + '-' + t.slice(4));
        rows.push([course.course_id, asTextCell_(h), false]);
      }
      sh.getRange(sh.getLastRow() + 1, 1, rows.length, 3).setValues(rows);
      return {
        ok: true,
        tokens: tokens,
        course: courseSummary_(course, 0, new Date(), studentBaseUrl_(getSettingsMap_()))
      };
    });
  });
}

/** 문항 목록. courseId가 'TEMPLATE'이면 공통 기본 문항 은행입니다. */
function getItemsAdmin(session, courseId) {
  return adminApi_(session, function () {
    var id = courseId === APP.TEMPLATE_ID ? APP.TEMPLATE_ID : sanitizeId_(courseId);
    if (id !== APP.TEMPLATE_ID && !findCourse_(id)) return { ok: false, code: 'NOT_FOUND' };
    var n = id === APP.TEMPLATE_ID ? 0 : readResponses_(id).length;
    return { ok: true, items: getItems_(id), locked: n > 0, response_count: n };
  });
}

/** 문항 전체 저장(교체). 응답이 1건 이상인 교과목은 잠깁니다. */
function saveItems(session, courseId, items) {
  return adminApi_(session, function () {
    var id = courseId === APP.TEMPLATE_ID ? APP.TEMPLATE_ID : sanitizeId_(courseId);
    if (id !== APP.TEMPLATE_ID && !findCourse_(id)) return { ok: false, code: 'NOT_FOUND' };
    if (!Array.isArray(items) || items.length === 0) return { ok: false, code: 'VALIDATION', message: '문항이 1개 이상 필요합니다.' };
    if (items.length > APP.MAX_ITEMS) return { ok: false, code: 'VALIDATION', message: '문항은 최대 ' + APP.MAX_ITEMS + '개입니다.' };

    return withLock_(function () {
      if (id !== APP.TEMPLATE_ID && readResponses_(id).length > 0) return { ok: false, code: 'LOCKED_ITEMS' };
      var all = readTable_(APP.SHEETS.ITEMS);
      var ownIds = {}, takenIds = {};
      all.rows.forEach(function (r) {
        takenIds[String(r.item_id)] = true;
        if (String(r.course_id) === id) ownIds[String(r.item_id)] = true;
      });
      var clean = [];
      for (var i = 0; i < items.length; i++) {
        var v = validateItem_(items[i], i);
        if (!v.ok) return v;
        var itemId = String(items[i].item_id || '');
        if (!ownIds[itemId] || clean.some(function (x) { return x.item_id === itemId; })) {
          itemId = newItemId_(takenIds);
        }
        takenIds[itemId] = true;
        v.item.item_id = itemId;
        v.item.course_id = id;
        v.item.order = i + 1;
        clean.push(v.item);
      }
      var kept = all.rows.filter(function (r) { return String(r.course_id) !== id; }).map(function (r) {
        return HEADERS.Items.map(function (h) { return r[h]; });
      });
      var rows = kept.concat(clean.map(itemToRow_));
      rewriteBody_(all.sheet, HEADERS.Items.length, rows);
      return { ok: true, items: getItems_(id) };
    });
  });
}

/** 결과 분석. 응답 수 < 최소 공개 수, 또는 결과공개일 이전이면 잠깁니다. */
function getResults(session, courseId) {
  return adminApi_(session, function () {
    var ctx = resultContext_(courseId);
    if (!ctx.ok) return ctx;
    if (ctx.locked) return lockedResult_(ctx);

    var stats = computeStats_(ctx.items, ctx.rows);
    // 드롭다운(성별 등) 분포는 집단이 작으면 인원수 자체를 숨깁니다.
    stats.items.forEach(function (st) {
      if (st.type !== 'select') return;
      var it = ctx.items.filter(function (x) { return x.item_id === st.item_id; })[0];
      if (!selectGroups_(it, ctx.rows, ctx.minN).safe) { delete st.options; st.n = null; st.suppressed = true; }
    });
    return {
      ok: true,
      locked: false,
      course: ctx.summary,
      n: ctx.rows.length,
      min_responses: ctx.minN,
      stats: stats,
      semester_compare: compareGroups_(ctx, 'semester'),
      section_compare: compareGroups_(ctx, 'section'),
      groups: groupCompare_(ctx.items, ctx.rows, ctx.minN),
      texts: textAnswers_(ctx.items, ctx.rows),
      wordcloud: wordCloudData_(ctx.items, ctx.rows),
      ai_prompt: AI_PROMPT,
      cqi: cqiSummary_(stats),
      likertLabels: LIKERT_LABELS
    };
  });
}

/** 원자료 CSV(행 순서 무작위, 수식 주입 방지). */
function exportCsv(session, courseId) {
  return adminApi_(session, function () {
    var ctx = resultContext_(courseId);
    if (!ctx.ok) return ctx;
    if (ctx.locked) return lockedResult_(ctx);
    var cols = rawColumns_(ctx);
    var omitted = ctx.items.length - cols.length;
    var header = ['번호', '제출일'].concat(cols.map(function (it, i) {
      return (i + 1) + '. [' + it.domain + '] ' + it.text + (it.reverse ? ' (역문항·원점수)' : '');
    }));
    var lines = [header];
    shuffle_(ctx.rows.slice()).forEach(function (r, i) {
      lines.push([i + 1, dateOnly_(r.submitted_date)].concat(cols.map(function (it) {
        return r[it.item_id] == null ? '' : r[it.item_id];
      })));
    });
    return { ok: true, filename: exportName_(ctx.course, '원자료') + '.csv', content: toCsv_(lines), omitted: omitted };
  });
}

/** 원자료에 넣을 문항 열. 소규모 집단이 생기는 드롭다운(성별 등) 열은 응답자 특정 위험이 있어 제외합니다. */
function rawColumns_(ctx) {
  return ctx.items.filter(function (it) { return it.type !== 'select' || selectGroups_(it, ctx.rows, ctx.minN).safe; });
}

/** CQI 요약표 CSV(영역별 평균·표준편차, 강점·개선점). */
function exportCqi(session, courseId) {
  return adminApi_(session, function () {
    var ctx = resultContext_(courseId);
    if (!ctx.ok) return ctx;
    if (ctx.locked) return lockedResult_(ctx);
    var stats = computeStats_(ctx.items, ctx.rows);
    var cqi = cqiSummary_(stats);
    var c = ctx.summary;
    var lines = [
      ['CQI 요약표', c.course_name],
      ['학년도·학기', c.year + '학년도 ' + c.semester + '학기', '학과', c.department, '학년', c.grade, '분반', c.section, '수업 방식', c.delivery_mode, '교과목 유형', c.course_type],
      ['응답 수', ctx.rows.length, '수강인원', c.enrollment || '', '응답률(%)', c.response_rate == null ? '' : c.response_rate],
      ['전체 평균(5점)', stats.overall == null ? '' : stats.overall],
      [],
      ['영역', '문항 수', '평균', '표준편차', '긍정 응답률(%)', '해석']
    ];
    stats.domains.forEach(function (d) {
      lines.push([d.domain, d.item_count, d.mean, d.sd, d.pos_pct, interpretMean_(d.mean)]);
    });
    lines.push([]);
    lines.push(['구분', '영역', '문항', '평균', '표준편차']);
    cqi.strengths.forEach(function (s) { lines.push(['강점', s.domain, s.text, s.mean, s.sd]); });
    cqi.improvements.forEach(function (s) { lines.push(['개선점', s.domain, s.text, s.mean, s.sd]); });
    lines.push([]);
    lines.push(['개선 계획(교수 작성)', '']);
    lines.push(['※ 본 자료는 학교 공식 강의평가가 아닌 교수자 자율형 형성평가·CQI 자료입니다.']);
    return { ok: true, filename: exportName_(ctx.course, 'CQI요약') + '.csv', content: toCsv_(lines) };
  });
}

/** 서술형 전체 텍스트(AI 요약용). 문항별로 무작위 순서. */
function exportText(session, courseId, itemId) {
  return adminApi_(session, function () {
    var ctx = resultContext_(courseId);
    if (!ctx.ok) return ctx;
    if (ctx.locked) return lockedResult_(ctx);
    var texts = scopedTexts_(ctx, itemId);
    if (!texts) return { ok: false, code: 'VALIDATION', field: 'item_id' };
    var c = ctx.summary;
    var out = [];
    out.push('[' + APP.NAME + '] 서술형 응답 — ' + c.course_name + ' (' + c.year + '학년도 ' + c.semester +
      '학기' + (c.section ? ', ' + c.section + '반' : '') + ') / 응답 ' + ctx.rows.length + '명' +
      (itemId ? ' / 문항 1개만' : ''));
    out.push('※ 응답 순서는 무작위입니다. 이름·학번 등 개인을 식별할 수 있는 내용이 있으면 AI에 입력하기 전에 삭제하세요.');
    out.push('');
    texts.forEach(function (t) {
      out.push('■ ' + t.text + ' (' + t.answers.length + '건)');
      t.answers.forEach(function (a) { out.push('- ' + a.replace(/\n+/g, ' ')); });
      out.push('');
    });
    out.push('---');
    out.push('[AI 요약 요청]');
    out.push(AI_PROMPT);
    var suffix = itemId ? '서술형' + (ctx.items.filter(function (it) { return it.type === 'text'; }).map(function (it) { return it.item_id; }).indexOf(itemId) + 1) : '서술형';
    return { ok: true, filename: exportName_(ctx.course, suffix) + '.txt', content: out.join('\n') };
  });
}

/** 서술형 AI 요약 요청 문구(간호교육 CQI 보고 양식). TXT·복사·PDF가 함께 씁니다. */
var AI_PROMPT = [
  '당신은 간호학과 교과목의 CQI(지속적 질 개선) 보고서 작성을 돕는 교육 평가 전문가입니다.',
  '위 학생 서술형 응답만을 근거로 다음 형식에 맞춰 한국어 개조식으로 정리해 주세요.',
  '1) 문항별 주요 주제 3~5개: 주제명, 대략적 언급 건수, 대표 응답 1개 인용',
  '2) 강점: 다음 학기에도 유지할 교수학습 요소',
  '3) 개선 요구: 교수학습방법 / 평가·과제 / 학습 환경(강의실·실습실·인터넷) / 디지털·AI 활용 영역으로 분류',
  '4) 다음 학기 CQI 개선 과제 3가지: 개선 내용, 실행 방법, 성과 확인 지표',
  '5) 학습성과(CLO)와 간호 실무 역량에 주는 시사점',
  '조건: 응답에 없는 내용은 추측하지 말 것. 특정 학생을 짐작할 수 있는 표현은 제외할 것. 긍정·부정 의견의 비중을 왜곡하지 말 것.'
].join('\n');

/** 서술형 응답(문항별 무작위 순서). itemId가 있으면 그 서술형 문항만, 잘못된 ID면 null */
function scopedTexts_(ctx, itemId) {
  var texts = textAnswers_(ctx.items, ctx.rows);
  if (!itemId) return texts;
  var one = texts.filter(function (t) { return t.item_id === String(itemId); });
  return one.length ? one : null;
}

/**
 * 원자료·CQI 요약표·서술형 응답을 PDF로 내보냅니다(kind: raw | cqi | text).
 * 보고서 HTML을 PDF로 변환해 base64로 반환합니다. 결과와 같은 잠금 규칙(최소 공개 수·공개일)을 적용합니다.
 */
function exportPdf(session, courseId, kind, opts) {
  return adminApi_(session, function () {
    var builders = { raw: rawPdfBody_, cqi: cqiPdfBody_, text: textPdfBody_, report: reportPdfBody_ };
    if (!builders.hasOwnProperty(kind)) return { ok: false, code: 'VALIDATION', field: 'kind' };
    var ctx = resultContext_(courseId);
    if (!ctx.ok) return ctx;
    if (ctx.locked) return lockedResult_(ctx);
    opts = opts && typeof opts === 'object' ? opts : {};
    if (kind === 'text' && opts.itemId && !scopedTexts_(ctx, opts.itemId)) return { ok: false, code: 'VALIDATION', field: 'item_id' };
    var built = builders[kind](ctx, opts);
    var pdf = HtmlService.createHtmlOutput(pdfDocument_(built.title, ctx, built.body)).getAs('application/pdf');
    return {
      ok: true,
      filename: exportName_(ctx.course, built.label) + '.pdf',
      base64: Utilities.base64Encode(pdf.getBytes()),
      mime: 'application/pdf',
      omitted: built.omitted || 0
    };
  });
}

function escHtml_(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/** PDF 공통 틀: 제목·교과목 정보·작성일, 끝에 형성평가 안내 */
function pdfDocument_(title, ctx, body) {
  var c = ctx.summary;
  var meta = [c.year + '학년도 ' + c.semester + '학기', c.grade ? c.grade + '학년' : '', c.section ? c.section + '반' : '',
    c.department, c.delivery_mode, c.course_type, '응답 ' + ctx.rows.length + '명', '작성일 ' + fmtD_(new Date())].filter(String).join(' · ');
  return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>' +
    'body{font-family:"Noto Sans KR","Malgun Gothic",sans-serif;font-size:10pt;color:#1d2033;line-height:1.5;margin:0}' +
    'h1{font-size:16pt;margin:0 0 4px}h2{font-size:12pt;margin:18px 0 6px;border-bottom:1px solid #1d2033;padding-bottom:3px}' +
    '.meta{color:#5b6078;font-size:9pt;margin-bottom:12px}' +
    'table{width:100%;border-collapse:collapse;margin:6px 0 10px;font-size:8.5pt}' +
    'th,td{border:1px solid #c9cce0;padding:3px 5px;text-align:left;vertical-align:top}th{background:#eeedfc}' +
    'td.n,th.n{text-align:center;white-space:nowrap}ol{margin:4px 0 10px;padding-left:22px}li{margin:2px 0}' +
    '.box{border:1px solid #c9cce0;padding:8px 10px;margin:8px 0;background:#fafafe}.note{color:#5b6078;font-size:8.5pt}' +
    '.plan{height:90px;border:1px solid #c9cce0}' +
    'h2 .no{display:inline-block;background:#5B4BFF;color:#fff;border-radius:3px;padding:0 6px;margin-right:4px}h3{font-size:10.5pt;margin:12px 0 4px}' +
    'table.info th{width:22%;background:#f3f2fb}table.kpis td.kpi{text-align:center;width:25%;padding:8px 4px;background:#fafafe}' +
    '.kt{color:#5b6078;font-size:8.5pt}.kb{font-size:20pt;font-weight:bold;color:#3d2fd6;line-height:1.2}.kb small{font-size:9pt;color:#5b6078}.ks{font-size:8pt;color:#5b6078}' +
    '.bar{background:#ebeaf3;height:8px;width:100%}.bar div{height:8px}.dist{height:8px;width:100%;background:#f1f0ec;white-space:nowrap;font-size:0}.dist div{display:inline-block;height:8px}' +
    'td.nw{white-space:nowrap}.fig{text-align:center;margin:8px 0 12px;page-break-inside:avoid}.fig img{max-width:100%;max-height:300px}.cap{font-size:8.5pt;color:#5b6078;margin-top:2px}' +
    '.good{background:#DDF3E4;padding:8px 10px;margin:8px 0}.improve{background:#FFE8A3;padding:8px 10px;margin:8px 0}' +
    '</style></head><body>' +
    '<h1>' + escHtml_(title) + '</h1>' +
    '<div class="meta"><b>' + escHtml_(c.course_name) + '</b> · ' + escHtml_(meta) + '</div>' +
    body +
    '<p class="note" style="margin-top:16px">※ ' + escHtml_(APP.NAME) + ' — 학교 공식 강의평가가 아닌 교수자 자율형 형성평가·CQI(지속적 질 개선) 자료입니다. 응답자를 식별하는 정보는 수집하지 않았습니다.</p>' +
    '</body></html>';
}

/** 원자료 PDF: 객관식은 Q번호 표(12문항씩), 서술형은 응답 번호별 표. 행 순서는 무작위. */
function rawPdfBody_(ctx) {
  var cols = rawColumns_(ctx);
  var rows = shuffle_(ctx.rows.slice());
  var num = {};
  cols.forEach(function (it, i) { num[it.item_id] = 'Q' + (i + 1); });
  var cell = function (r, it) { return escHtml_(r[it.item_id] == null ? '' : r[it.item_id]); };
  var closed = cols.filter(function (it) { return it.type !== 'text'; });
  var texts = cols.filter(function (it) { return it.type === 'text'; });
  var html = '<h2>문항 번호</h2><table><tr><th class="n">번호</th><th>영역</th><th>문항</th></tr>' +
    cols.map(function (it) {
      return '<tr><td class="n">' + num[it.item_id] + '</td><td>' + escHtml_(it.domain) + '</td><td>' + escHtml_(it.text) +
        (it.reverse ? ' (역문항·원점수)' : '') + '</td></tr>';
    }).join('') + '</table>';
  html += '<h2>객관식 응답 (리커트 1~5점 원점수)</h2>';
  for (var k = 0; k < closed.length; k += 12) {
    var part = closed.slice(k, k + 12);
    html += '<table><tr><th class="n">응답</th><th class="n">제출일</th>' + part.map(function (it) { return '<th class="n">' + num[it.item_id] + '</th>'; }).join('') + '</tr>' +
      rows.map(function (r, i) {
        return '<tr><td class="n">' + (i + 1) + '</td><td class="n">' + escHtml_(dateOnly_(r.submitted_date)) + '</td>' +
          part.map(function (it) { return '<td class="n">' + cell(r, it) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</table>';
  }
  if (texts.length) {
    html += '<h2>서술형 응답 (응답 번호별)</h2><table><tr><th class="n">응답</th>' +
      texts.map(function (it) { return '<th>' + num[it.item_id] + '. ' + escHtml_(it.text) + '</th>'; }).join('') + '</tr>' +
      rows.map(function (r, i) {
        return '<tr><td class="n">' + (i + 1) + '</td>' + texts.map(function (it) { return '<td>' + cell(r, it) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</table>';
  }
  var omitted = ctx.items.length - cols.length;
  if (omitted) html += '<p class="note">익명성 보호를 위해 소규모 집단이 생기는 드롭다운 문항 ' + omitted + '개는 제외했습니다.</p>';
  return { title: '강의평가 원자료', label: '원자료', body: html, omitted: omitted };
}

/** 결과 보고서 PDF에 넣을 차트 그림(브라우저가 만든 PNG). 형식·크기를 확인해 안전한 것만 씁니다. */
var REPORT_IMAGE_KEYS = ['radar', 'semester', 'section', 'wordcloud'];
var REPORT_IMAGE_MAX = 3 * 1024 * 1024; // 그림 1개 최대 3MB(base64 길이)

function reportImages_(opts) {
  var src = opts && opts.images && typeof opts.images === 'object' ? opts.images : {};
  var out = {};
  REPORT_IMAGE_KEYS.forEach(function (k) {
    var v = src[k];
    if (typeof v === 'string' && v.length <= REPORT_IMAGE_MAX && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+\/=]+$/.test(v)) out[k] = v;
  });
  return out;
}

/** 5점 척도 막대(평균) — PDF 표 안에 그리는 단순 막대 */
function meanBar_(m, color) {
  var w = m == null ? 0 : Math.max(0, Math.min(100, Math.round(m / 5 * 100)));
  return '<div class="bar"><div style="width:' + w + '%;background:' + (color || '#5B4BFF') + '"></div></div>';
}

/** 응답 분포 막대(1~5점 비율) */
function distBar_(dist) {
  var n = (dist || []).reduce(function (a, b) { return a + b; }, 0);
  if (!n) return '';
  var colors = ['#E5484D', '#F2A08A', '#C9C6BE', '#9E95FF', '#5B4BFF'];
  return '<div class="dist">' + dist.map(function (c, i) {
    var w = Math.round(c / n * 1000) / 10;
    return w ? '<div style="width:' + w + '%;background:' + colors[i] + '"></div>' : '';
  }).join('') + '</div>';
}

/**
 * 결과 보고서 PDF(매뉴얼처럼 인쇄용으로 설계): 보고서 정보 → 1 한눈에 보기 → 2 영역별 결과 → 3 학기·분반 비교
 * → 4 문항별 결과 → 5 서술형 응답 → 6 CQI(강점·개선점·AI 요약·개선 계획). 차트는 opts.images(PNG)로 받습니다.
 */
function reportPdfBody_(ctx, opts) {
  opts = opts || {};
  var img = reportImages_(opts);
  var stats = computeStats_(ctx.items, ctx.rows);
  var cqi = cqiSummary_(stats);
  var c = ctx.summary;
  var settings = getSettingsMap_();
  var f = function (v) { return v == null ? '—' : String(v); };
  var figure = function (key, caption) {
    return img[key] ? '<div class="fig"><img src="' + img[key] + '"><div class="cap">' + escHtml_(caption) + '</div></div>' : '';
  };
  var no = 0;
  var h2 = function (t) { no++; return '<h2><span class="no">' + no + '</span> ' + escHtml_(t) + '</h2>'; };

  // 보고서 정보
  var info = [
    ['교과목', c.course_name], ['학년도·학기', c.year + '학년도 ' + c.semester + '학기'], ['학년', c.grade ? c.grade + '학년' : '—'],
    ['학과', c.department || '—'], ['수업 방식', c.delivery_mode], ['교과목 유형', c.course_type],
    ['응답 기간', (ctx.course.start_at ? fmtD_(ctx.course.start_at) : '') + ' ~ ' + (ctx.course.end_at ? fmtD_(ctx.course.end_at) : '')],
    ['응답 수', ctx.rows.length + '명' + (c.enrollment ? ' (수강 ' + c.enrollment + '명, 응답률 ' + c.response_rate + '%)' : '')],
    ['담당 교수', [settings.professor_name, settings.affiliation].filter(String).join(' · ') || '—'], ['작성일', fmtD_(new Date())]
  ];
  var html = '<table class="info">' + info.map(function (r) { return '<tr><th>' + escHtml_(r[0]) + '</th><td>' + escHtml_(r[1]) + '</td></tr>'; }).join('') + '</table>';

  // 1. 한눈에 보기
  var k = stats.kpis || {};
  var kpi = function (title, big, sub) { return '<td class="kpi"><div class="kt">' + escHtml_(title) + '</div><div class="kb">' + big + '</div><div class="ks">' + sub + '</div></td>'; };
  html += h2('한눈에 보기') + '<table class="kpis"><tr>' +
    kpi('응답 수', ctx.rows.length + '<small>명</small>', escHtml_(c.year + '-' + c.semester + '학기')) +
    kpi('전체 평균', f(stats.overall) + '<small>/5</small>', escHtml_(interpretMean_(stats.overall)) + ' · 긍정 ' + f(stats.overall_pos_pct) + '%') +
    kpi('전반적 만족도', k.satisfaction ? f(k.satisfaction.pos_pct) + '<small>%</small>' : '—', k.satisfaction ? '긍정(4·5점) · 평균 ' + f(k.satisfaction.mean) : '문항 없음') +
    kpi('추천 의향', k.recommend ? f(k.recommend.pos_pct) + '<small>%</small>' : '—', k.recommend ? '긍정(4·5점) · 평균 ' + f(k.recommend.mean) : '문항 없음') +
    '</tr></table>';

  // 2. 영역별 결과
  html += h2('영역별 결과') + '<table><tr><th>영역</th><th class="n">문항</th><th class="n">평균</th><th style="width:28%">평균(5점)</th><th class="n">표준편차</th><th class="n">긍정(%)</th><th class="n">해석</th></tr>' +
    stats.domains.map(function (d) {
      return '<tr><td>' + escHtml_(d.domain) + '</td><td class="n">' + d.item_count + '</td><td class="n"><b>' + f(d.mean) + '</b></td><td>' +
        meanBar_(d.mean, d.mean != null && d.mean < 3 ? '#E5484D' : '#5B4BFF') + '</td><td class="n">' + f(d.sd) + '</td><td class="n">' + f(d.pos_pct) +
        '</td><td class="n">' + escHtml_(interpretMean_(d.mean)) + '</td></tr>';
    }).join('') + '</table>' + figure('radar', '그림. 영역별 평균(레이더 차트)');

  // 3. 학기·분반 비교
  var cmpTable = function (g, label) {
    if (!g || !g.groups || g.groups.length < 2) return '';
    var doms = g.groups[0].domains.map(function (d) { return d.domain; });
    return '<h3>' + escHtml_(label) + '</h3><table><tr><th>구분</th><th class="n">응답</th><th class="n">전체</th>' +
      doms.map(function (d) { return '<th class="n">' + escHtml_(String(d).charAt(0)) + '</th>'; }).join('') + '</tr>' +
      g.groups.map(function (x) {
        return '<tr><td>' + escHtml_(x.label) + '</td><td class="n">' + x.n + '</td><td class="n"><b>' + f(x.overall) + '</b></td>' +
          doms.map(function (d) { var m = (x.domains.filter(function (y) { return y.domain === d; })[0] || {}).mean; return '<td class="n">' + f(m) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</table>';
  };
  var sem = compareGroups_(ctx, 'semester'), sec = compareGroups_(ctx, 'section');
  var cmp = cmpTable(sem, '학기 간 비교 (같은 교과목명)') + figure('semester', '그림. 학기 간 비교') + cmpTable(sec, '분반 간 비교 (같은 학기)') + figure('section', '그림. 분반 간 비교');
  if (cmp) html += h2('학기·분반 비교') + cmp + '<p class="note">영역 머리글은 영역 기호(A~I)입니다. 응답이 최소 공개 수 미만인 학기·분반은 제외됩니다.</p>';

  // 4. 문항별 결과
  html += h2('문항별 결과') + '<table><tr><th class="n">#</th><th>영역</th><th>문항</th><th class="n">n</th><th class="n">평균</th><th class="n">SD</th><th class="n">긍정(%)</th><th style="width:16%">분포(1→5점)</th></tr>' +
    stats.items.filter(function (s) { return s.type === 'likert5'; }).map(function (s, i) {
      return '<tr><td class="n">' + (i + 1) + '</td><td class="nw">' + escHtml_(String(s.domain).replace(/\s.*$/, '')) + '</td><td>' + escHtml_(s.text) + (s.reverse ? ' (역문항)' : '') +
        '</td><td class="n">' + s.n + '</td><td class="n"><b>' + f(s.mean) + '</b></td><td class="n">' + f(s.sd) + '</td><td class="n">' + f(s.pos_pct) + '</td><td>' + distBar_(s.sdist) + '</td></tr>';
    }).join('') + '</table><p class="note">분포 색: 빨강 1점 · 주황 2점 · 회색 3점 · 연보라 4점 · 보라 5점(역문항은 환산 점수).</p>';

  // 5. 서술형 응답
  var texts = textAnswers_(ctx.items, ctx.rows);
  var wc = wordCloudData_(ctx.items, ctx.rows);
  html += h2('서술형 응답') + figure('wordcloud', '그림. 서술형 응답 워드 클라우드') +
    (wc.all && wc.all.length ? '<p><b>자주 나온 단어</b> ' + wc.all.slice(0, 15).map(function (x) { return escHtml_(x.w) + '(' + x.n + ')'; }).join(' · ') + '</p>' : '') +
    (texts.map(function (t) {
      return '<h3>' + escHtml_(t.text) + ' <span class="note">(' + t.answers.length + '건)</span></h3>' +
        (t.answers.length ? '<ol>' + t.answers.map(function (a) { return '<li>' + escHtml_(a) + '</li>'; }).join('') + '</ol>' : '<p class="note">응답 없음</p>');
    }).join('') || '<p class="note">서술형 문항이 없습니다.</p>');

  // 6. CQI
  var list = function (arr) {
    return '<ol>' + (arr.map(function (x) { return '<li>' + escHtml_(x.text) + ' <b>(' + f(x.mean) + ')</b> <span class="note">' + escHtml_(x.domain) + '</span></li>'; }).join('') || '<li>—</li>') + '</ol>';
  };
  var summary = String(opts.aiSummary == null ? '' : opts.aiSummary).replace(/\r\n?/g, '\n').trim().slice(0, 5000);
  html += h2('CQI 요약') +
    '<div class="good"><b>강점</b> (문항 평균 상위)' + list(cqi.strengths) + '</div>' +
    '<div class="improve"><b>개선점</b> (문항 평균 하위)' + list(cqi.improvements) + '</div>' +
    (summary ? '<h3>서술형 AI 요약 (교수 검토)</h3><div class="box">' + escHtml_(summary).replace(/\n/g, '<br>') + '</div>' : '') +
    '<h3>다음 학기 개선 계획 (교수 작성)</h3><div class="plan"></div>' +
    '<p class="note">해석 기준(5점): 4.5 이상 매우 우수 · 4.0 이상 우수 · 3.5 이상 보통 이상 · 3.0 이상 보통 · 3.0 미만 개선 필요. 긍정 응답률 = 4·5점 비율, 역문항은 환산.</p>';
  return { title: '강의평가 결과 보고서', label: '결과보고서', body: html };
}

/** CQI 요약표 PDF: 영역별 평균·표준편차·긍정 응답률·해석, 강점·개선점, 개선 계획 작성란 */
function cqiPdfBody_(ctx) {
  var stats = computeStats_(ctx.items, ctx.rows);
  var cqi = cqiSummary_(stats);
  var f = function (v) { return v == null ? '—' : String(v); };
  var html = '<div class="box">전체 평균 <b>' + f(stats.overall) + '</b> / 5 · 긍정 응답률 <b>' + f(stats.overall_pos_pct) + '%</b> · 해석: ' +
    escHtml_(interpretMean_(stats.overall)) + '</div>';
  html += '<h2>영역별 결과</h2><table><tr><th>영역</th><th class="n">문항 수</th><th class="n">평균</th><th class="n">표준편차</th><th class="n">긍정 응답률(%)</th><th class="n">해석</th></tr>' +
    stats.domains.map(function (d) {
      return '<tr><td>' + escHtml_(d.domain) + '</td><td class="n">' + d.item_count + '</td><td class="n">' + f(d.mean) + '</td><td class="n">' + f(d.sd) +
        '</td><td class="n">' + f(d.pos_pct) + '</td><td class="n">' + escHtml_(interpretMean_(d.mean)) + '</td></tr>';
    }).join('') + '</table>';
  var list = function (arr) {
    return '<table><tr><th>영역</th><th>문항</th><th class="n">평균</th><th class="n">표준편차</th></tr>' + (arr.map(function (x) {
      return '<tr><td>' + escHtml_(x.domain) + '</td><td>' + escHtml_(x.text) + '</td><td class="n">' + f(x.mean) + '</td><td class="n">' + f(x.sd) + '</td></tr>';
    }).join('') || '<tr><td colspan="4">—</td></tr>') + '</table>';
  };
  html += '<h2>강점 (문항 평균 상위)</h2>' + list(cqi.strengths);
  html += '<h2>개선점 (문항 평균 하위)</h2>' + list(cqi.improvements);
  html += '<h2>문항별 결과</h2><table><tr><th class="n">#</th><th>영역</th><th>문항</th><th class="n">n</th><th class="n">평균</th><th class="n">표준편차</th><th class="n">긍정(%)</th></tr>' +
    stats.items.filter(function (s) { return s.type === 'likert5'; }).map(function (s, i) {
      return '<tr><td class="n">' + (i + 1) + '</td><td>' + escHtml_(s.domain) + '</td><td>' + escHtml_(s.text) + (s.reverse ? ' (역문항)' : '') +
        '</td><td class="n">' + s.n + '</td><td class="n">' + f(s.mean) + '</td><td class="n">' + f(s.sd) + '</td><td class="n">' + f(s.pos_pct) + '</td></tr>';
    }).join('') + '</table>';
  html += '<h2>개선 계획 (교수 작성)</h2><div class="plan"></div>' +
    '<p class="note">해석 기준(5점): 4.5 이상 매우 우수 · 4.0 이상 우수 · 3.5 이상 보통 이상 · 3.0 이상 보통 · 3.0 미만 개선 필요. 긍정 응답률 = 4·5점 비율, 역문항은 환산.</p>';
  return { title: 'CQI 요약표', label: 'CQI요약', body: html };
}

/**
 * 서술형 응답 PDF(보고·인쇄용): 주의 문구 → 문항별 응답(무작위 순서) → AI 요약 결과(교수가 붙여 넣은 내용, 없으면 작성란) → AI 요청 문구.
 * opts.itemId: 서술형 문항 하나만, opts.aiSummary: 붙여 넣은 AI 요약(최대 5,000자, 이스케이프)
 */
function textPdfBody_(ctx, opts) {
  opts = opts || {};
  var html = '<p class="note">응답 순서는 무작위입니다. 이름·학번 등 개인을 식별할 수 있는 내용이 있으면 공유·AI 입력 전에 삭제하세요.</p>';
  html += (scopedTexts_(ctx, opts.itemId) || []).map(function (t) {
    return '<h2>' + escHtml_(t.text) + ' <span class="note">(' + t.answers.length + '건)</span></h2>' +
      (t.answers.length ? '<ol>' + t.answers.map(function (a) { return '<li>' + escHtml_(a) + '</li>'; }).join('') + '</ol>' : '<p class="note">응답 없음</p>');
  }).join('') || '<p class="note">서술형 문항이 없습니다.</p>';
  var summary = String(opts.aiSummary == null ? '' : opts.aiSummary).replace(/\r\n?/g, '\n').trim().slice(0, 5000);
  html += '<h2>AI 요약 결과</h2>' + (summary
    ? '<div class="box">' + escHtml_(summary).replace(/\n/g, '<br>') + '</div><p class="note">※ 생성형 AI가 작성한 요약을 교수가 검토해 붙여 넣은 내용입니다.</p>'
    : '<div class="plan" style="height:160px"></div><p class="note">AI 요약 결과를 붙여 넣거나 직접 작성하세요.</p>');
  html += '<div class="box"><b>AI 요약 요청 문구</b><br>' + escHtml_(AI_PROMPT).replace(/\n/g, '<br>') + '</div>';
  return { title: '서술형 응답 (보고·인쇄용)', label: '서술형', body: html };
}

function saveSettings(session, data) {
  return adminApi_(session, function () {
    data = data || {};
    var name = cleanText_(data.professor_name, 40);
    var aff = cleanText_(data.affiliation, 80);
    var minN = Math.floor(Number(data.min_responses));
    if (!name) return { ok: false, code: 'VALIDATION', field: 'professor_name' };
    if (!(minN >= APP.MIN_RESPONSES_FLOOR && minN <= 50)) return { ok: false, code: 'VALIDATION', field: 'min_responses' };
    var depts = (Array.isArray(data.departments) ? data.departments : String(data.departments || '').split(/\n|,/))
      .map(function (d) { return cleanText_(d, 40); }).filter(String);
    depts = depts.filter(function (d, i) { return depts.indexOf(d) === i; }).slice(0, 30);
    if (!depts.length) return { ok: false, code: 'VALIDATION', field: 'departments' };
    var execUrl = String(data.webapp_url == null ? '' : data.webapp_url).trim().replace(/[?#].*$/, '');
    if (execUrl && !APP.EXEC_URL_RE.test(execUrl)) {
      return { ok: false, code: 'VALIDATION', field: 'webapp_url', message: '웹 앱 주소는 https://script.google.com/…/exec 형식이어야 합니다(/dev 주소는 학생이 열 수 없습니다).' };
    }
    withLock_(function () {
      setSetting_('professor_name', name);
      setSetting_('affiliation', aff);
      setSetting_('min_responses', minN);
      setSetting_('departments', depts.join('\n'));
      if (data.webapp_url !== undefined) setSetting_('webapp_url', execUrl);
    });
    return { ok: true };
  });
}

/* ───────────────────────────── 결과 계산 ───────────────────────────── */

function resultContext_(courseId) {
  var course = findCourse_(sanitizeId_(courseId));
  if (!course) return { ok: false, code: 'NOT_FOUND' };
  var settings = getSettingsMap_();
  var minN = minResponses_(settings);
  var rows = readResponses_(course.course_id);
  var now = new Date();
  return {
    ok: true,
    course: course,
    summary: courseSummary_(course, rows.length, now, studentBaseUrl_(settings)),
    items: itemsForCourse_(course),
    rows: rows,
    minN: minN,
    now: now,
    locked: resultLock_(course, rows.length, minN, now)
  };
}

function lockedResult_(ctx) {
  return {
    ok: true,
    locked: true,
    reason: ctx.locked,
    n: ctx.rows.length,
    min_responses: ctx.minN,
    open_date: ctx.course.result_open_date ? fmtD_(ctx.course.result_open_date) : '',
    course: ctx.summary
  };
}

/** 잠금 사유: 'MIN_RESPONSES' | 'BEFORE_OPEN_DATE' | null */
function resultLock_(course, n, minN, now) {
  if (n < minN) return 'MIN_RESPONSES';
  if (course.result_open_date && fmtD_(now) < fmtD_(course.result_open_date)) return 'BEFORE_OPEN_DATE';
  return null;
}

function likertScore_(item, raw) {
  var n = Number(raw);
  if (raw === '' || raw == null || !(n >= 1 && n <= 5) || Math.floor(n) !== n) return null;
  return item.reverse ? 6 - n : n;
}

function computeStats_(items, rows) {
  var itemStats = items.map(function (it) {
    var base = { item_id: it.item_id, domain: it.domain, text: it.text, type: it.type, reverse: it.reverse };
    if (it.type === 'likert5') {
      var dist = [0, 0, 0, 0, 0], scores = [];
      rows.forEach(function (r) {
        var raw = Number(r[it.item_id]);
        var s = likertScore_(it, r[it.item_id]);
        if (s == null) return;
        dist[raw - 1]++;
        scores.push(s);
      });
      base.n = scores.length;
      base.mean = round2_(mean_(scores));
      base.sd = round2_(sd_(scores));
      base.dist = dist;
      base.sdist = it.reverse ? dist.slice().reverse() : dist.slice(); // 점수 기준 분포(역문항 환산)
      polarity_(base, base.sdist);
      return base;
    }
    if (it.type === 'single' || it.type === 'multi' || it.type === 'select') {
      var counts = {};
      it.options.forEach(function (o) { counts[o] = 0; });
      var answered = 0;
      rows.forEach(function (r) {
        var v = String(r[it.item_id] == null ? '' : r[it.item_id]);
        if (!v) return;
        answered++;
        (it.type === 'multi' ? v.split('; ') : [v]).forEach(function (o) {
          if (counts.hasOwnProperty(o)) counts[o]++;
        });
      });
      base.n = answered;
      base.options = it.options.map(function (o) { return { label: o, count: counts[o] }; });
      return base;
    }
    base.n = rows.filter(function (r) { return String(r[it.item_id] == null ? '' : r[it.item_id]).trim() !== ''; }).length;
    return base;
  });

  var byDomain = {}, order = [];
  itemStats.forEach(function (s) {
    if (s.type !== 'likert5' || s.mean == null) return;
    if (!byDomain[s.domain]) { byDomain[s.domain] = []; order.push(s.domain); }
    byDomain[s.domain].push(s);
  });
  var domains = order.map(function (d) {
    var means = byDomain[d].map(function (s) { return s.mean; });
    var dist = [0, 0, 0, 0, 0];
    byDomain[d].forEach(function (s) { s.sdist.forEach(function (n, i) { dist[i] += n; }); });
    return polarity_({ domain: d, item_count: means.length, mean: round2_(mean_(means)), sd: round2_(domainSd_(byDomain[d], items, rows)), dist: dist }, dist);
  });
  var likert = itemStats.filter(function (s) { return s.type === 'likert5' && s.mean != null; });
  var allMeans = likert.map(function (s) { return s.mean; });
  var pick = function (re) {
    var s = likert.filter(function (x) { return re.test(x.text); })[0];
    return s ? { text: s.text, mean: s.mean, pos_pct: s.pos_pct, n: s.n } : null;
  };
  var total = [0, 0, 0, 0, 0];
  likert.forEach(function (s) { s.sdist.forEach(function (n, i) { total[i] += n; }); });
  return {
    items: itemStats,
    domains: domains,
    overall: round2_(mean_(allMeans)),
    overall_pos_pct: polarity_({}, total).pos_pct,
    kpis: { satisfaction: pick(/만족/), recommend: pick(/추천/) }
  };
}

/** 점수 분포로 긍정(4·5)·중립(3)·부정(1·2) 비율(%)을 붙입니다. */
function polarity_(obj, sdist) {
  var n = sdist.reduce(function (a, b) { return a + b; }, 0);
  var pct = function (x) { return n ? Math.round(x / n * 1000) / 10 : null; };
  obj.pos_pct = pct(sdist[3] + sdist[4]);
  obj.neu_pct = pct(sdist[2]);
  obj.neg_pct = pct(sdist[0] + sdist[1]);
  return obj;
}

/**
 * 드롭다운 문항(성별 등)의 집단 구성. 미응답 포함 어느 집단이든 1명 이상 minN명 미만이면 safe=false.
 * (작은 집단은 전체 평균과의 차이로 개인 응답이 역산될 수 있으므로 모두 숨깁니다.)
 */
function selectGroups_(item, rows, minN) {
  var groups = {}, none = [];
  item.options.forEach(function (o) { groups[o] = []; });
  rows.forEach(function (r) {
    var v = String(r[item.item_id] == null ? '' : r[item.item_id]);
    if (groups.hasOwnProperty(v)) groups[v].push(r); else none.push(r);
  });
  var sizes = Object.keys(groups).map(function (k) { return groups[k].length; }).concat([none.length]);
  var nonEmpty = item.options.filter(function (o) { return groups[o].length > 0; }).length;
  var safe = nonEmpty >= 2 && sizes.every(function (n) { return n === 0 || n >= minN; });
  return { safe: safe, groups: groups, unanswered: none.length };
}

/** 드롭다운 문항별 집단 비교(예: 성별). 익명성 기준을 넘지 못하면 수치 없이 사유만 반환합니다. */
function groupCompare_(items, rows, minN) {
  var likertItems = items.filter(function (it) { return it.type === 'likert5'; });
  return items.filter(function (it) { return it.type === 'select'; }).map(function (it) {
    var g = selectGroups_(it, rows, minN);
    if (!g.safe) return { item_id: it.item_id, text: it.text, suppressed: true, min_responses: minN };
    return {
      item_id: it.item_id, text: it.text, suppressed: false,
      groups: it.options.filter(function (o) { return g.groups[o].length; }).map(function (o) {
        var st = computeStats_(likertItems, g.groups[o]);
        return { label: o, n: g.groups[o].length, overall: st.overall, pos_pct: st.overall_pos_pct, domains: st.domains.map(function (d) { return { domain: d.domain, mean: d.mean }; }) };
      })
    };
  });
}

/* ───────────────────────────── 워드 클라우드 ───────────────────────────── */

var KO_PARTICLES = ['에서는', '에게서', '으로는', '으로도', '이라서', '이라도', '이라는', '라서', '에서', '에게', '한테', '으로', '까지', '부터', '처럼', '보다', '이나', '이랑', '에는', '에도', '와는', '과는', '이라', '이고',
  '은', '는', '이', '가', '을', '를', '에', '의', '도', '로', '와', '과', '만', '랑', '라', '나'];
// 서술어 어미(2글자 이상 + '다'). '요·고·면·게' 같은 1글자 어미는 '필요·최고·비대면' 같은 명사와 겹쳐 제외합니다.
var KO_PREDICATE = /(습니다|니다|어요|아요|해요|여요|네요|군요|세요|어서|아서|해서|지만|는데|면서|으면|다면|도록|었고|았고|했고|하게|하는|되는|있는|없는|좋은|같은|싶은|었던|았던|했던|겠고|다)$/;
// 조사처럼 보이는 글자로 끝나는 명사(잘리면 안 되는 단어)
var KO_KEEP = ['와이파이', '난이도', '이해도', '만족도', '참여도', '집중도', '정도', '속도', '태도', '제도', '시도', '강도', '빈도', '진도',
  '평가', '휴가', '과제', '결과', '효과', '교과', '성과', '학과', '자료', '이론', '진로', '강의', '토의', '회의', '논의', '정의', '동의',
  '모의', '주의', '아이', '디스플레이', '지도', '도구', '문제', '주제', '실제', '경제', '체계', '관계', '단계', '기기',
  '비대면', '대면', '화면', '측면', '보고서', '계획서', '강의계획서', '설명서', '참고', '최고'];
var KO_STOP = ['수업', '강의', '교수님', '교수', '학생', '정말', '너무', '조금', '많이', '매우', '진짜', '그냥', '그리고', '하지만', '그래서', '이번', '다음', '학기',
  '부분', '생각', '느낌', '경우', '정도', '때문', '자주', '올려', '늘려', '해주', '주세요', '있으면', '있었으면', '했으면',
  '다른', '많아', '많이', '많은', '알려', '겹치', '고르지', '주가', '있어', '없어', '같이', '함께', '위주', '대해', '더욱', '계속', '빨리', '좋겠', '어려', '쉬웠', '쉽게', '다뤄', '따라', '만들', '들어', '이것', '그것', '저것', '우리', '저희', '제가', '모든', '항상', '가장', '좀더', '보다', '없음', '없다', '있음', '해서', '대한', '관련', '통해', '위해', '여러', '것들', '좋았', '같아요'];

/** 한국어 응답에서 명사 위주의 단어 빈도를 셉니다(형태소 분석기 없이 조사 제거·서술어 제외 휴리스틱). */
function wordFreq_(texts, limit) {
  var counts = {};
  texts.forEach(function (t) {
    String(t).replace(/wi-?fi/gi, '와이파이').replace(/e-?mr/gi, 'EMR')
      .replace(/[^0-9A-Za-z가-힣\s]/g, ' ').split(/\s+/).forEach(function (raw) {
      if (!raw) return;
      var w = raw;
      if (/[가-힣]/.test(w)) {
        if (w.length >= 3 && /한$/.test(w)) return; // 필요한·부족한 등 관형형
        if (KO_KEEP.indexOf(w) < 0 && (KO_PREDICATE.test(w) || (w.length >= 3 && /([요히고할면]|[겨져워려와]서)$/.test(w)))) return; // 서술어·부사 제외
        for (var i = 0; i < KO_PARTICLES.length && KO_KEEP.indexOf(w) < 0; i++) {
          var p = KO_PARTICLES[i];
          if (w.length - p.length >= 2 && w.slice(-p.length) === p) { w = w.slice(0, -p.length); break; }
        }
      }
      if (/^[A-Za-z0-9]+$/.test(w)) w = w.toUpperCase();
      if (w.length < 2 || /^\d+$/.test(w) || KO_STOP.indexOf(w) >= 0) return;
      counts[w] = (counts[w] || 0) + 1;
    });
  });
  return Object.keys(counts).map(function (w) { return { w: w, n: counts[w] }; })
    .sort(function (a, b) { return (b.n - a.n) || a.w.localeCompare(b.w); })
    .slice(0, limit || 50);
}

function wordCloudData_(items, rows) {
  var all = [], byItem = {};
  items.filter(function (it) { return it.type === 'text'; }).forEach(function (it) {
    var texts = rows.map(function (r) { return String(r[it.item_id] == null ? '' : r[it.item_id]).trim(); }).filter(String);
    all = all.concat(texts);
    byItem[it.item_id] = wordFreq_(texts, 40);
  });
  return { all: wordFreq_(all, 50), items: byItem };
}

/** 영역 표준편차: 응답자별 영역 평균 점수의 표준편차. */
function domainSd_(domainStats, items, rows) {
  var ids = {};
  domainStats.forEach(function (s) { ids[s.item_id] = true; });
  var its = items.filter(function (it) { return ids[it.item_id]; });
  var perResp = [];
  rows.forEach(function (r) {
    var sc = its.map(function (it) { return likertScore_(it, r[it.item_id]); }).filter(function (x) { return x != null; });
    if (sc.length) perResp.push(mean_(sc));
  });
  return sd_(perResp);
}

function overallMean_(items, rows) {
  if (!items.length || !rows.length) return null;
  return computeStats_(items, rows).overall;
}

/** 학기 간(동일 교과목명·분반) 또는 분반 간(동일 교과목명·학년도·학기) 비교. 각 집단도 최소 공개 수를 적용합니다. */
function compareGroups_(ctx, kind) {
  var name = normName_(ctx.course.course_name);
  var all = getCourses_().filter(function (c) {
    if (normName_(c.course_name) !== name) return false;
    if (kind === 'section') {
      return Number(c.year) === Number(ctx.course.year) && String(c.semester) === String(ctx.course.semester);
    }
    // 학기 간 비교: 교과목명 기준으로 '다른 학기'만(같은 학기의 다른 반은 분반 간 비교에서 다룸).
    // 두 교과목 모두 반이 지정된 경우(이전 버전 자료)에는 같은 반끼리만 비교
    if (c.course_id === ctx.course.course_id) return true;
    if (Number(c.year) === Number(ctx.course.year) && String(c.semester) === String(ctx.course.semester)) return false;
    return !c.section || !ctx.course.section || normName_(c.section) === normName_(ctx.course.section);
  });
  if (all.length < 2) return { groups: [], excluded: 0 };
  var itemsBy = groupBy_(getAllItems_(), 'course_id');
  var respBy = groupBy_(readResponses_(), 'course_id');
  var groups = [], excluded = 0;
  all.forEach(function (c) {
    var rows = respBy[c.course_id] || [];
    if (resultLock_(c, rows.length, ctx.minN, ctx.now)) { excluded++; return; }
    var st = computeStats_(filterScope_(itemsBy[c.course_id] || [], c), rows);
    groups.push({
      course_id: c.course_id,
      label: kind === 'section' ? (c.section + '반') : (c.year + '-' + c.semester + (c.section ? ' ' + c.section + '반' : '')),
      year: Number(c.year), semester: String(c.semester), section: String(c.section),
      n: rows.length, overall: st.overall, domains: st.domains,
      current: c.course_id === ctx.course.course_id
    });
  });
  groups.sort(function (a, b) {
    return (a.year - b.year) || (semesterRank_(a.semester) - semesterRank_(b.semester)) || a.section.localeCompare(b.section);
  });
  return { groups: groups, excluded: excluded };
}

function textAnswers_(items, rows) {
  return items.filter(function (it) { return it.type === 'text'; }).map(function (it) {
    var answers = rows.map(function (r) { return String(r[it.item_id] == null ? '' : r[it.item_id]).trim(); })
      .filter(function (s) { return s !== ''; });
    return { item_id: it.item_id, text: it.text, answers: shuffle_(answers) };
  });
}

function cqiSummary_(stats) {
  var likert = stats.items.filter(function (s) { return s.type === 'likert5' && s.mean != null; });
  var sorted = likert.slice().sort(function (a, b) { return (b.mean - a.mean) || (a.sd - b.sd); });
  var k = Math.min(3, Math.floor(sorted.length / 2));
  var pick = function (s) { return { domain: s.domain, text: s.text, mean: s.mean, sd: s.sd }; };
  return {
    strengths: sorted.slice(0, k).map(pick),
    improvements: sorted.slice(sorted.length - k).reverse().map(pick)
  };
}

function interpretMean_(m) {
  if (m == null) return '';
  if (m >= 4.5) return '매우 우수';
  if (m >= 4.0) return '우수';
  if (m >= 3.5) return '보통 이상';
  if (m >= 3.0) return '보통';
  return '개선 필요';
}

/* ───────────────────────────── 응답 처리 ───────────────────────────── */

function checkCredential_(course, credential) {
  if (course.access_mode === 'token') {
    var tok = normalizeToken_(credential);
    if (tok.length !== APP.TOKEN_LENGTH) return { ok: false, code: 'TOKEN_INVALID' };
    var h = tokenHash_(course.course_id, tok, tokenSalt_());
    var t = readTable_(APP.SHEETS.TOKENS);
    for (var i = 0; i < t.rows.length; i++) {
      var r = t.rows[i];
      if (String(r.course_id) === course.course_id && String(r.token_hash) === h) {
        if (toBool_(r.used)) return { ok: false, code: 'TOKEN_USED' };
        return { ok: true, tokenRow: r._row };
      }
    }
    return { ok: false, code: 'TOKEN_INVALID' };
  }
  var expected = String(course.access_code || '').trim().toUpperCase();
  if (!expected) return { ok: true };
  var given = String(credential == null ? '' : credential).trim().toUpperCase().slice(0, 20);
  return safeEqual_(given, expected) ? { ok: true } : { ok: false, code: 'BAD_CODE' };
}

function setTokenUsed_(row, used) {
  sheet_(APP.SHEETS.TOKENS).getRange(row, 3).setValue(used);
}

function sanitizeAnswers_(items, answers) {
  answers = (answers && typeof answers === 'object') ? answers : {};
  var values = {}, missing = [];
  items.forEach(function (it) {
    var raw = answers[it.item_id];
    var v = '';
    if (it.type === 'likert5') {
      var n = Number(raw);
      if (raw !== '' && raw != null && n >= 1 && n <= 5 && Math.floor(n) === n) v = n;
    } else if (it.type === 'single' || it.type === 'select') {
      if (typeof raw === 'string' && it.options.indexOf(raw) >= 0) v = asTextCell_(raw);
    } else if (it.type === 'multi') {
      if (Array.isArray(raw)) {
        var sel = it.options.filter(function (o) { return raw.indexOf(o) >= 0; });
        if (sel.length) v = asTextCell_(sel.join('; '));
      }
    } else if (it.type === 'text') {
      var s = cleanText_(raw, APP.TEXT_MAX);
      if (s) v = asTextCell_(s);
    }
    if (it.required && v === '') missing.push(it.item_id);
    values[it.item_id] = v;
  });
  if (missing.length) return { ok: false, code: 'MISSING', missing: missing };
  return { ok: true, values: values };
}

/** 응답 1행을 무작위 위치에 삽입합니다(행 순서로 제출 순서를 추정하기 어렵게). 시각은 저장하지 않습니다. */
function appendResponse_(courseId, items, values, responseId) {
  var sh = sheet_(APP.SHEETS.RESPONSES);
  var headers = ensureResponseColumns_(sh, items);
  var today = asTextCell_(fmtD_(new Date()));
  var row = headers.map(function (h) {
    if (h === 'response_id') return responseId;
    if (h === 'course_id') return courseId;
    if (h === 'submitted_date') return today;
    return values.hasOwnProperty(h) ? values[h] : '';
  });
  var last = sh.getLastRow();
  var pos = last < 2 ? 2 : 2 + Math.floor(Math.random() * last); // 2 … last+1
  if (pos <= last) sh.insertRowBefore(pos);
  sh.getRange(pos, 1, 1, row.length).setValues([row]);
}

/** Responses 헤더에 없는 item_id 열을 추가하고 전체 헤더를 반환합니다. */
function ensureResponseColumns_(sh, items) {
  var lastCol = Math.max(sh.getLastColumn(), HEADERS.Responses.length);
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
  var missing = items.filter(function (it) { return headers.indexOf(it.item_id) < 0; });
  if (missing.length) {
    var start = headers.length + 1;
    var need = headers.length + missing.length;
    if (need > sh.getMaxColumns()) sh.insertColumnsAfter(sh.getMaxColumns(), need - sh.getMaxColumns());
    var range = sh.getRange(1, start, 1, missing.length);
    range.setValues([missing.map(function (it) { return it.item_id; })]);
    range.setFontWeight('bold');
    headers = headers.concat(missing.map(function (it) { return it.item_id; }));
    styleResponseHeaders_();
  }
  return headers;
}

var RESPONSE_HEADER_COLORS = ['#E8E5FF', '#DDF3E8', '#FFF1D6', '#E0EEFF', '#FCE4EC', '#EDE7F6'];

/**
 * 응답 시트 머리글 꾸미기: 모든 교과목이 한 시트를 쓰므로(다른 교과목 문항 열은 빈칸)
 * 문항 열 머리글을 교과목별 색으로 칠하고, 메모에 [교과목명] [영역] 문항을 적고, A~C열을 고정합니다.
 */
function styleResponseHeaders_() {
  var sh = sheet_(APP.SHEETS.RESPONSES);
  var base = HEADERS.Responses.length;
  sh.setFrozenColumns(base);
  var last = sh.getLastColumn();
  if (last <= base) return;
  var headers = sh.getRange(1, 1, 1, last).getValues()[0].map(function (h) { return String(h).trim(); });
  var items = {}, courses = {};
  getAllItems_().forEach(function (it) { items[it.item_id] = it; });
  getCourses_().forEach(function (c, i) { courses[c.course_id] = { name: c.course_name, color: RESPONSE_HEADER_COLORS[i % RESPONSE_HEADER_COLORS.length] }; });
  var notes = [], bgs = [];
  for (var i = base; i < last; i++) {
    var it = items[headers[i]];
    var c = it && courses[it.course_id];
    notes.push(it ? '[' + (c ? c.name : it.course_id) + '] [' + it.domain + '] ' + it.text : '');
    bgs.push(c ? c.color : '#F4F4F5');
  }
  sh.getRange(1, base + 1, 1, last - base).setNotes([notes]).setBackgrounds([bgs]);
}

function readResponses_(courseId) {
  var t = readTable_(APP.SHEETS.RESPONSES);
  return t.rows.filter(function (r) {
    return r.response_id !== '' && (!courseId || String(r.course_id) === courseId);
  });
}

/* ───────────────────────────── 교과목·문항 ───────────────────────────── */

function getCourses_() {
  return readTable_(APP.SHEETS.COURSES).rows
    .filter(function (r) { return String(r.course_id).trim() !== ''; })
    .map(normalizeCourse_);
}

function findCourse_(id) {
  if (!id) return null;
  return getCourses_().filter(function (c) { return c.course_id === id; })[0] || null;
}

function normalizeCourse_(r) {
  return {
    course_id: String(r.course_id).trim(),
    course_name: String(r.course_name || ''),
    year: Number(r.year) || '',
    semester: String(r.semester || ''),
    grade: r.grade === '' || r.grade == null ? '' : String(r.grade),
    section: String(r.section || ''),
    enrollment: Number(r.enrollment) || 0,
    start_at: toDate_(r.start_at),
    end_at: toDate_(r.end_at),
    access_mode: String(r.access_mode) === 'token' ? 'token' : 'code',
    access_code: String(r.access_code || ''),
    status: String(r.status || APP.STATUS.READY),
    result_open_date: toDate_(r.result_open_date),
    department: String(r.department || ''),
    delivery_mode: deliveryMode_(r.delivery_mode),
    course_type: APP.COURSE_TYPES.indexOf(String(r.course_type)) >= 0 ? String(r.course_type) : '이론+실습',
    _row: r._row
  };
}

function courseToRow_(c) {
  return [c.course_id, guardFormula_(c.course_name), c.year, asTextCell_(c.semester), c.grade, asTextCell_(c.section),
    c.enrollment, c.start_at, c.end_at, c.access_mode, asTextCell_(c.access_code), c.status, c.result_open_date || '',
    guardFormula_(c.department || ''), c.delivery_mode || '대면', c.course_type || '이론+실습'];
}

function validateCourse_(d) {
  var err = function (field, message) { return { ok: false, code: 'VALIDATION', field: field, message: message }; };
  var name = cleanText_(d.course_name, 100);
  if (!name) return err('course_name', '교과목명을 입력하세요.');
  var year = Math.floor(Number(d.year));
  if (!(year >= 2000 && year <= 2100)) return err('year', '학년도를 확인하세요.');
  var sem = String(d.semester || '');
  if (APP.SEMESTERS.indexOf(sem) < 0) return err('semester', '학기(1학기·2학기)를 선택하세요.');
  var grade = Math.floor(Number(d.grade));
  if (APP.GRADES.indexOf(grade) < 0) return err('grade', '학년(1~4)을 선택하세요.');
  // 반·수강인원은 교과목 편집에서 입력하지 않습니다(선택 항목: 비우면 '' / 0).
  var section = String(d.section == null ? '' : d.section).trim().toUpperCase();
  if (section && APP.SECTIONS.indexOf(section) < 0) return err('section', '반은 A~F 중 하나여야 합니다.');
  var department = cleanText_(d.department, 40);
  if (!department) return err('department', '학과를 선택하세요.');
  var delivery = APP.DELIVERY_RENAMED[String(d.delivery_mode)] || String(d.delivery_mode || '대면');
  if (APP.DELIVERY.indexOf(delivery) < 0) return err('delivery_mode', '수업 방식을 선택하세요.');
  var ctype = String(d.course_type || '이론+실습');
  if (APP.COURSE_TYPES.indexOf(ctype) < 0) return err('course_type', '교과목 유형(이론/실습/이론+실습)을 선택하세요.');
  var enroll = d.enrollment === '' || d.enrollment == null ? 0 : Math.floor(Number(d.enrollment));
  if (!(enroll >= 0 && enroll <= 1000)) return err('enrollment', '수강인원은 0~1000명입니다.');
  var start = parseDT_(d.start_at), end = parseDT_(d.end_at);
  if (!start) return err('start_at', '시작일시를 입력하세요.');
  if (!end) return err('end_at', '종료일시를 입력하세요.');
  if (end.getTime() <= start.getTime()) return err('end_at', '종료일시는 시작일시보다 늦어야 합니다.');
  var mode = d.access_mode === 'token' ? 'token' : 'code';
  var code = String(d.access_code == null ? '' : d.access_code).trim().toUpperCase();
  if (!/^[A-Z0-9]{0,12}$/.test(code)) return err('access_code', '접속코드는 영문·숫자 12자 이내입니다.');
  var open = '';
  if (d.result_open_date) {
    open = parseDT_(d.result_open_date);
    if (!open) return err('result_open_date', '결과공개일을 확인하세요.');
  }
  return {
    ok: true,
    course: {
      course_name: name, year: year, semester: sem, grade: grade, section: section, enrollment: enroll,
      start_at: start, end_at: end, access_mode: mode, access_code: code, result_open_date: open,
      department: department, delivery_mode: delivery, course_type: ctype
    }
  };
}

function statusByDates_(c, now) {
  if (!c.start_at || !c.end_at) return APP.STATUS.READY;
  if (now.getTime() < c.start_at.getTime()) return APP.STATUS.READY;
  if (now.getTime() > c.end_at.getTime()) return APP.STATUS.CLOSED;
  return APP.STATUS.OPEN;
}

/** 저장된 상태가 '마감'(수동 마감)이면 마감, 그 외에는 기간으로 판정합니다. */
function effectiveStatus_(c, now) {
  if (c.status === APP.STATUS.CLOSED) return APP.STATUS.CLOSED;
  return statusByDates_(c, now);
}

function stateCode_(state) {
  return state === APP.STATUS.READY ? 'NOT_STARTED' : 'CLOSED';
}

function courseSummary_(c, n, now, url) {
  var status = effectiveStatus_(c, now);
  var hoursLeft = c.end_at ? (c.end_at.getTime() - now.getTime()) / 3600000 : null;
  return {
    course_id: c.course_id,
    course_name: c.course_name,
    year: c.year,
    semester: c.semester,
    grade: c.grade,
    section: c.section,
    enrollment: c.enrollment,
    start_at: c.start_at ? fmtDT_(c.start_at) : '',
    end_at: c.end_at ? fmtDT_(c.end_at) : '',
    access_mode: c.access_mode,
    access_code: c.access_code,
    manual_close: c.status === APP.STATUS.CLOSED && statusByDates_(c, now) !== APP.STATUS.CLOSED,
    status: status,
    result_open_date: c.result_open_date ? fmtD_(c.result_open_date) : '',
    response_count: n,
    response_rate: c.enrollment ? Math.round(n / c.enrollment * 1000) / 10 : null, // 수강인원이 없으면 응답률 없음
    department: c.department,
    delivery_mode: c.delivery_mode,
    course_type: c.course_type,
    hours_left: status === APP.STATUS.OPEN && hoursLeft != null ? Math.round(hoursLeft * 10) / 10 : null,
    // 학생 접속 주소(공통 주소). 학생은 이 주소에서 접속코드나 토큰을 입력합니다.
    base_url: url || ''
  };
}

/** 예상 응답 시간(분): 리커트 7초, 서술형 35초, 그 밖 10초 */
function estMinutes_(items) {
  var sec = 0;
  items.forEach(function (it) { sec += it.type === 'text' ? 35 : it.type === 'likert5' ? 7 : 10; });
  return Math.max(1, Math.round(sec / 60));
}

function publicCourse_(c, items, settings) {
  return {
    course_id: c.course_id,
    course_name: c.course_name,
    department: c.department,
    delivery_mode: c.delivery_mode,
    course_type: c.course_type,
    year: c.year,
    semester: c.semester,
    grade: c.grade,
    section: c.section,
    access_mode: c.access_mode,
    has_code: String(c.access_code || '').trim() !== '',
    item_count: items.length,
    est_minutes: estMinutes_(items),
    start_label: c.start_at ? fmtLabel_(c.start_at) : '',
    end_label: c.end_at ? fmtLabel_(c.end_at) : '',
    min_responses: minResponses_(settings)
  };
}

function getAllItems_() {
  return readTable_(APP.SHEETS.ITEMS).rows
    .filter(function (r) { return String(r.item_id).trim() !== ''; })
    .map(normalizeItem_)
    .sort(function (a, b) { return a.order - b.order; });
}

function getItems_(courseId) {
  return getAllItems_().filter(function (it) { return it.course_id === courseId; });
}

function normalizeItem_(r) {
  var type = APP.ITEM_TYPES.indexOf(String(r.type)) >= 0 ? String(r.type) : 'likert5';
  return {
    item_id: String(r.item_id).trim(),
    course_id: String(r.course_id).trim(),
    domain: String(r.domain || ''),
    text: String(r.text || ''),
    type: type,
    required: toBool_(r.required),
    order: Number(r.order) || 0,
    reverse: type === 'likert5' && toBool_(r.reverse),
    options: String(r.options || '').split('|').map(function (s) { return s.trim(); }).filter(String),
    scope: APP.SCOPES.indexOf(String(r.scope || '')) >= 0 ? String(r.scope || '') : ''
  };
}

/** 문항의 표시 조건이 교과목(수업 방식·유형)에 맞는지 */
function scopeVisible_(scope, course) {
  if (!scope || !course) return true;
  if (scope === 'online') return course.delivery_mode !== '대면';
  if (scope === 'theory') return course.course_type !== '실습';
  if (scope === 'practice') return course.course_type !== '이론';
  return true;
}

/** 교과목에 맞지 않는 문항(대면의 온라인 문항, 이론 교과목의 실습실 문항 등)을 제외합니다. */
function filterScope_(items, course) {
  return items.filter(function (it) { return scopeVisible_(it.scope, course); });
}

function itemsForCourse_(course) {
  return filterScope_(getItems_(course.course_id), course);
}

function departments_(settings) {
  var list = String(settings.departments || '간호학과').split(/\n|,/).map(function (s) { return s.trim(); }).filter(String);
  return list.length ? list : ['간호학과'];
}

function publicItem_(it) {
  return {
    item_id: it.item_id, domain: it.domain, text: it.text, type: it.type,
    required: it.required, options: it.options
  };
}

function itemToRow_(it) {
  return [it.item_id, it.course_id, guardFormula_(it.domain), guardFormula_(it.text), it.type,
    !!it.required, it.order, !!it.reverse, guardFormula_(it.options.join(' | ')), APP.SCOPES.indexOf(it.scope) >= 0 ? it.scope : ''];
}

function validateItem_(d, idx) {
  var err = function (message) { return { ok: false, code: 'VALIDATION', index: idx, message: (idx + 1) + '번 문항: ' + message }; };
  d = d || {};
  var type = APP.ITEM_TYPES.indexOf(String(d.type)) >= 0 ? String(d.type) : '';
  if (!type) return err('유형을 선택하세요.');
  var domain = cleanText_(d.domain, 40);
  if (!domain) return err('영역을 입력하세요.');
  var text = cleanText_(d.text, APP.ITEM_TEXT_MAX).replace(/\n+/g, ' ');
  if (!text) return err('문항 내용을 입력하세요.');
  var options = [];
  if (type === 'single' || type === 'multi' || type === 'select') {
    var raw = Array.isArray(d.options) ? d.options : String(d.options || '').split(/\n|\|/);
    var seen = {};
    raw.forEach(function (o) {
      var s = cleanText_(o, APP.OPTION_MAX).replace(/[|;]/g, ',').replace(/\n+/g, ' ');
      if (s && !seen[s]) { seen[s] = true; options.push(s); }
    });
    if (options.length < 2 || options.length > 10) return err('선택지는 2~10개여야 합니다.');
  }
  return {
    ok: true,
    item: {
      domain: domain, text: text, type: type, required: !!d.required,
      reverse: type === 'likert5' && !!d.reverse, options: options,
      scope: APP.SCOPES.indexOf(String(d.scope || '')) >= 0 ? String(d.scope || '') : ''
    }
  };
}

function copyItems_(fromId, toId) {
  var all = readTable_(APP.SHEETS.ITEMS);
  var taken = {};
  all.rows.forEach(function (r) { taken[String(r.item_id)] = true; });
  var src = getItems_(fromId);
  if (!src.length) return 0;
  var rows = src.map(function (it, i) {
    var copy = JSON.parse(JSON.stringify(it));
    copy.item_id = newItemId_(taken);
    taken[copy.item_id] = true;
    copy.course_id = toId;
    copy.order = i + 1;
    return itemToRow_(copy);
  });
  all.sheet.getRange(all.sheet.getLastRow() + 1, 1, rows.length, HEADERS.Items.length).setValues(rows);
  return rows.length;
}

/**
 * 온라인(비대면)·혼합으로 바뀐 교과목에 온라인 문항이 하나도 없으면, 공통 문항 은행의 온라인 문항을
 * 서술형 앞에 넣습니다. 응답이 이미 있으면 설문이 중간에 바뀌므로 넣지 않습니다.
 */
function addOnlineItems_(courseId) {
  var items = getItems_(courseId);
  if (items.some(function (it) { return it.scope === 'online'; })) return 0;
  if (readResponses_(courseId).length > 0) return 0;
  var online = getItems_(APP.TEMPLATE_ID).filter(function (it) { return it.scope === 'online'; });
  if (!online.length) return 0;
  var at = items.findIndex ? items.findIndex(function (it) { return it.type === 'text' || it.type === 'select'; }) : -1;
  if (at < 0) at = items.length;
  var merged = items.slice(0, at).concat(online.map(function (it) { var c = JSON.parse(JSON.stringify(it)); c.item_id = ''; return c; }), items.slice(at));
  var all = readTable_(APP.SHEETS.ITEMS);
  var taken = {};
  all.rows.forEach(function (r) { taken[String(r.item_id)] = true; });
  var rows = merged.map(function (it, i) {
    var c = JSON.parse(JSON.stringify(it));
    if (!c.item_id) { c.item_id = newItemId_(taken); taken[c.item_id] = true; }
    c.course_id = courseId;
    c.order = i + 1;
    return itemToRow_(c);
  });
  var kept = all.rows.filter(function (r) { return String(r.course_id) !== courseId; })
    .map(function (r) { return HEADERS.Items.map(function (h) { return r[h] == null ? '' : r[h]; }); });
  rewriteBody_(all.sheet, HEADERS.Items.length, kept.concat(rows));
  return online.length;
}

function getTokenStats_() {
  var out = {};
  readTable_(APP.SHEETS.TOKENS).rows.forEach(function (r) {
    var id = String(r.course_id);
    if (!id) return;
    out[id] = out[id] || { total: 0, used: 0 };
    out[id].total++;
    if (toBool_(r.used)) out[id].used++;
  });
  return out;
}

/* ───────────────────────────── 시트 유틸 ───────────────────────────── */

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function sheet_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('SETUP_REQUIRED');
  return sh;
}

function readTable_(name) {
  var sh = sheet_(name);
  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  if (lastRow < 1 || lastCol < 1) return { sheet: sh, headers: [], rows: [] };
  var values = sh.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = values[0].map(function (h) { return String(h).trim(); });
  var rows = [];
  for (var r = 1; r < values.length; r++) {
    if (values[r].every(function (v) { return v === '' || v == null; })) continue;
    var obj = { _row: r + 1 };
    for (var c = 0; c < headers.length; c++) if (headers[c]) obj[headers[c]] = values[r][c];
    rows.push(obj);
  }
  return { sheet: sh, headers: headers, rows: rows };
}

/** 헤더 아래 본문 전체를 rows로 교체합니다. */
function rewriteBody_(sh, width, rows) {
  var last = sh.getLastRow();
  if (last >= 2) sh.getRange(2, 1, last - 1, Math.max(width, sh.getLastColumn())).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, width).setValues(rows);
}

/** keep(row)가 false인 행을 제거합니다. 제거된 행 수를 반환합니다. */
function filterTable_(name, keep) {
  var t = readTable_(name);
  var width = t.headers.length;
  var kept = t.rows.filter(keep);
  var removed = t.rows.length - kept.length;
  if (removed > 0) {
    rewriteBody_(t.sheet, width, kept.map(function (r) {
      return t.headers.map(function (h) { return r[h] == null ? '' : r[h]; });
    }));
  }
  return removed;
}

function getSettingsMap_() {
  var out = {};
  readTable_(APP.SHEETS.SETTINGS).rows.forEach(function (r) {
    if (r.key) out[String(r.key).trim()] = r.value;
  });
  return out;
}

function setSetting_(key, value, description) {
  if (typeof value === 'string') value = asTextCell_(value);
  var t = readTable_(APP.SHEETS.SETTINGS);
  var row = t.rows.filter(function (r) { return String(r.key).trim() === key; })[0];
  if (row) {
    t.sheet.getRange(row._row, 2).setValue(value);
  } else {
    t.sheet.getRange(t.sheet.getLastRow() + 1, 1, 1, 3).setValues([[key, value, description || '']]);
  }
}

/** 시트의 수업 방식 값을 현재 이름으로(이전 이름 '비대면' 포함, 알 수 없으면 '대면') */
function deliveryMode_(v) {
  var s = String(v == null ? '' : v).trim();
  s = APP.DELIVERY_RENAMED[s] || s;
  return APP.DELIVERY.indexOf(s) >= 0 ? s : '대면';
}

function minResponses_(settings) {
  var n = Math.floor(Number(settings.min_responses));
  return n >= APP.MIN_RESPONSES_FLOOR ? n : 5;
}

function webAppUrl_() {
  try { return ScriptApp.getService().getUrl() || ''; } catch (e) { return ''; }
}

function isDevUrl_(url) {
  return /\/dev(?:[?#].*)?$/.test(String(url || ''));
}

/**
 * 학생 접속 주소(공통 주소)의 기준 주소.
 * ① 설정에 저장된 /exec 주소 → ② 현재 실행 주소(테스트용 /dev 제외) → ③ 없음('')
 * getUrl()은 테스트 배포(/dev)로 실행 중이면 /dev 주소를 돌려주는데, 학생은 /dev를 열 수 없습니다.
 */
function studentBaseUrl_(settings) {
  var saved = String((settings || {}).webapp_url || '').trim();
  if (APP.EXEC_URL_RE.test(saved)) return saved;
  var current = webAppUrl_();
  return current && !isDevUrl_(current) ? current : '';
}

/**
 * 정식 배포 주소(/exec)로 실행되면, 저장된 주소가 없을 때만 그 주소를 기억합니다.
 * (교수가 [설정]에 입력한 주소가 항상 우선합니다. getUrl()이 다른 배포의 주소를 돌려주는 경우가 있어
 *  저장값을 자동으로 덮어쓰지 않습니다. 다를 때는 관리자 화면이 알려 줍니다.)
 */
function rememberExecUrl_(settings) {
  try {
    var current = webAppUrl_();
    if (!APP.EXEC_URL_RE.test(current)) return;
    settings = settings || getSettingsMap_();
    if (!settings.hasOwnProperty('webapp_url') && !settings.hasOwnProperty('token_salt')) return; // setup 이전
    if (!APP.EXEC_URL_RE.test(String(settings.webapp_url || ''))) setSetting_('webapp_url', current);
  } catch (e) { /* 기록 실패는 화면 표시에 영향 없음 */ }
}

/* ───────────────────────────── 보안 유틸 ───────────────────────────── */

function adminApi_(session, fn) {
  return safe_(function () {
    requireAdmin_(session);
    return fn();
  });
}

function isSessionFormat_(s) {
  return /^[a-f0-9]{64}$/.test(String(s || ''));
}

function requireAdmin_(session) {
  if (!isSessionFormat_(session)) throw new Error('AUTH');
  var epoch = CacheService.getScriptCache().get('sess_' + session);
  if (epoch == null || String(epoch) !== String(getSettingsMap_().session_epoch || '0')) throw new Error('AUTH');
}

/** 예외를 일관된 { ok:false, code } 응답으로 변환합니다. */
function safe_(fn) {
  try {
    return fn();
  } catch (e) {
    var msg = String(e && e.message || e);
    if (msg === 'AUTH') return { ok: false, code: 'AUTH' };
    if (msg === 'SETUP_REQUIRED') return { ok: false, code: 'SETUP_REQUIRED' };
    console.error(msg + (e && e.stack ? '\n' + e.stack : ''));
    return { ok: false, code: 'SERVER_ERROR' };
  }
}

/** 스크립트 잠금 안에서 실행합니다. 잠금을 얻지 못하면 클라이언트 재시도를 요청합니다. */
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(APP.LOCK_WAIT_MS)) return { ok: false, code: 'BUSY', retry: true };
  try {
    var result = fn();
    SpreadsheetApp.flush();
    return result;
  } finally {
    lock.releaseLock();
  }
}

/** 일시적 Sheets 서비스 오류에 대한 지수 백오프 재시도(0.5s, 1s, 2s). */
function retry_(fn) {
  var delay = 500;
  for (var attempt = 0; ; attempt++) {
    try {
      return fn();
    } catch (e) {
      if (attempt >= 3) throw e;
      Utilities.sleep(delay + Math.floor(Math.random() * 200));
      delay *= 2;
    }
  }
}

function storePin_(pin) {
  var salt = randomString_(24, APP.ID_ALPHABET);
  setSetting_('pin_salt', salt);
  setSetting_('pin_hash', hashPin_(pin, salt));
  setSetting_('session_epoch', String(Date.now())); // 기존 세션 모두 무효화
  var cache = CacheService.getScriptCache();
  cache.remove('pin_fail');
  cache.remove('pin_lock_until');
}

function hashPin_(pin, salt) {
  return sha256Hex_(String(salt || '') + ':' + String(pin));
}

function tokenSalt_() {
  var s = getSettingsMap_();
  if (!s.token_salt) throw new Error('SETUP_REQUIRED');
  return String(s.token_salt);
}

function tokenHash_(courseId, token, salt) {
  return sha256Hex_(salt + ':' + courseId + ':' + token);
}

function sha256Hex_(str) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, str, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
}

function safeEqual_(a, b) {
  a = String(a); b = String(b);
  var diff = a.length ^ b.length;
  for (var i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/** UUID(암호학적 난수)를 원천으로 거부 샘플링하여 편향 없는 문자열을 만듭니다. */
function randomString_(len, alphabet) {
  var out = '', pool = [];
  var limit = 256 - (256 % alphabet.length);
  while (out.length < len) {
    if (!pool.length) {
      var hex = Utilities.getUuid().replace(/-/g, '');
      for (var i = 0; i + 1 < hex.length; i += 2) {
        if (i === 12 || i === 16) continue; // UUID 버전·변형 비트가 있는 바이트 제외
        pool.push(parseInt(hex.substr(i, 2), 16));
      }
    }
    var b = pool.pop();
    if (b < limit) out += alphabet.charAt(b % alphabet.length);
  }
  return out;
}

function newCourseId_(rows) {
  var taken = {};
  rows.forEach(function (r) { taken[String(r.course_id)] = true; });
  var id;
  do { id = 'c' + randomString_(7, APP.ID_ALPHABET); } while (taken[id]);
  return id;
}

/** 다른 교과목과 겹치지 않는 6자리 접속코드 */
function uniqueAccessCode_(courseRows) {
  var used = {};
  courseRows.forEach(function (r) { used[String(r.access_code || '').trim().toUpperCase()] = true; });
  var code;
  do { code = randomString_(6, APP.TOKEN_ALPHABET); } while (used[code]);
  return code;
}

function newItemId_(taken) {
  var id;
  do { id = 'i' + randomString_(7, APP.ID_ALPHABET); } while (taken[id]);
  return id;
}

function sanitizeId_(v) {
  return String(v == null ? '' : v).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
}

function normalizeToken_(v) {
  return String(v == null ? '' : v).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
}

/** 제어문자 제거, 줄바꿈 정규화, 길이 제한. HTML 이스케이프는 출력(클라이언트 렌더링) 시점에 수행합니다. */
function cleanText_(v, max) {
  return String(v == null ? '' : v)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n?/g, '\n')
    .trim()
    .slice(0, max);
}

/** 수식 주입 방지: =, +, -, @(및 탭·CR)로 시작하면 앞에 ' 를 붙입니다. */
function guardFormula_(s) {
  s = String(s == null ? '' : s);
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}

/** 학생 입력 문자열은 항상 텍스트 셀로 저장합니다(수식 실행·날짜/숫자 자동 변환 모두 차단). */
function asTextCell_(s) {
  s = String(s == null ? '' : s);
  return s === '' ? '' : "'" + s;
}

/* ───────────────────────────── 일반 유틸 ───────────────────────────── */

function tz_() {
  return Session.getScriptTimeZone() || 'Asia/Seoul';
}

function isDate_(v) {
  return Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime());
}

function toDate_(v) {
  if (v === '' || v == null) return null;
  if (isDate_(v)) return v;
  return parseDT_(String(v));
}

function parseDT_(s) {
  if (isDate_(s)) return s;
  s = String(s == null ? '' : s).trim();
  var m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/.exec(s);
  if (!m) return null;
  var d = Utilities.parseDate(m[1] + '-' + m[2] + '-' + m[3] + ' ' + (m[4] || '00') + ':' + (m[5] || '00'),
    tz_(), 'yyyy-MM-dd HH:mm');
  return isDate_(d) ? d : null;
}

function fmtDT_(d) { return Utilities.formatDate(d, tz_(), "yyyy-MM-dd'T'HH:mm"); }
function fmtD_(d) { return Utilities.formatDate(d, tz_(), 'yyyy-MM-dd'); }
function fmtLabel_(d) { return Utilities.formatDate(d, tz_(), 'yyyy.MM.dd HH:mm'); }

function dateOnly_(v) {
  if (isDate_(v)) return fmtD_(v);
  return String(v == null ? '' : v).slice(0, 10);
}

function toBool_(v) {
  return v === true || /^(true|y|yes|1|o|예)$/i.test(String(v == null ? '' : v).trim());
}

function groupBy_(arr, key) {
  var out = {};
  arr.forEach(function (x) { (out[x[key]] = out[x[key]] || []).push(x); });
  return out;
}

function mean_(xs) {
  if (!xs.length) return null;
  return xs.reduce(function (a, b) { return a + b; }, 0) / xs.length;
}

function sd_(xs) {
  if (xs.length < 2) return xs.length ? 0 : null;
  var m = mean_(xs);
  return Math.sqrt(xs.reduce(function (a, x) { return a + (x - m) * (x - m); }, 0) / (xs.length - 1));
}

function round2_(x) {
  return x == null || isNaN(x) ? null : Math.round(x * 100) / 100;
}

function shuffle_(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr;
}

function semesterRank_(s) {
  var i = APP.SEMESTERS.indexOf(String(s));
  return i < 0 ? 9 : i;
}

function normName_(s) {
  return String(s || '').replace(/\s+/g, '').toLowerCase();
}

function exportName_(c, kind) {
  return [c.course_name, c.year + '-' + c.semester, c.section, kind].filter(String).join('_')
    .replace(/[\\/:*?"<>|\s]+/g, '_');
}

function toCsv_(lines) {
  return lines.map(function (cols) {
    return cols.map(function (v) {
      var s = guardFormula_(v == null ? '' : String(v));
      return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',');
  }).join('\r\n');
}
