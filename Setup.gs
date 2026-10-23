/**
 * 강의평가 Studio — 초기 설정·스프레드시트 메뉴·테스트 데이터
 */

var DEFAULT_ITEMS = [
  ['A. 강의 설계', '강의계획서에 제시된 내용과 실제 수업이 일치하였다.', 'likert5'],
  ['A. 강의 설계', '수업 목표가 명확하게 제시되었다.', 'likert5'],
  ['B. 교수 방법', '교수자의 설명은 이해하기 쉬웠다.', 'likert5'],
  ['B. 교수 방법', '수업 자료(교안·영상·실습자료 등)는 학습에 유용하였다.', 'likert5'],
  ['B. 교수 방법', '수업 중 질문하거나 참여할 기회가 충분히 주어졌다.', 'likert5'],
  ['C. 평가', '평가 기준과 방법이 사전에 공지되었다.', 'likert5'],
  ['C. 평가', '평가는 공정하게 이루어졌다.', 'likert5'],
  ['C. 평가', '과제에 대한 피드백을 적절한 시기에 받았다.', 'likert5'],
  ['E. 디지털·AI 활용', '수업에서 활용한 디지털 도구·AI는 학습에 도움이 되었다.', 'likert5'],
  ['E. 디지털·AI 활용', '이 수업에서 배운 디지털·AI 활용 역량을 간호실무에 활용할 수 있다고 느낀다.', 'likert5'],
  ['F. 종합', '이 수업에 전반적으로 만족한다.', 'likert5'],
  ['F. 종합', '이 수업을 후배에게 추천하고 싶다.', 'likert5'],
  ['서술형', '이 수업에서 가장 도움이 된 점은 무엇인가요?', 'text'],
  ['서술형', '이 수업에서 개선이 필요한 점은 무엇인가요?', 'text'],
  ['서술형', '다음 학기 수업에 바라는 점이 있다면 적어 주세요.', 'text']
];

var SAMPLE_CLOS = [
  '나는 간호정보시스템(EMR)의 구조와 기능을 설명할 수 있게 되었다.',
  '나는 생성형 AI의 결과물을 간호 근거에 비추어 비판적으로 검토할 수 있게 되었다.'
];

var CLO_DOMAIN = 'D. 학습성과(CLO)';

/* ───────────────────────────── 메뉴 ───────────────────────────── */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('강의평가 Studio')
    .addItem('① 초기 설정 실행', 'setup')
    .addItem('② 관리자 PIN 설정·재설정', 'setAdminPinFromMenu')
    .addItem('웹 앱 주소 확인', 'showWebAppUrl')
    .addSeparator()
    .addItem('[테스트] 샘플 응답 30건 생성', 'generateSampleResponses')
    .addItem('[테스트] 샘플 데이터 모두 삭제', 'deleteSampleData')
    .addToUi();
}

/* ───────────────────────────── setup ───────────────────────────── */

/**
 * 탭·헤더·기본 설정·기본 문항·샘플 교과목 1개를 생성합니다.
 * 여러 번 실행해도 기존 데이터는 지우지 않습니다(누락된 것만 추가).
 */
function setup() {
  var ss = ss_();
  var colors = { Settings: '#5B4BFF', Courses: '#5B4BFF', Items: '#5B4BFF', Tokens: '#6B6B76', Responses: '#6B6B76' };
  Object.keys(HEADERS).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    var headers = HEADERS[name];
    var current = sh.getLastColumn() > 0 ? sh.getRange(1, 1, 1, headers.length).getValues()[0] : [];
    if (String(current[0] || '') !== headers[0]) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#ECE9FF').setFontColor('#18181B');
    sh.setFrozenRows(1);
    sh.setTabColor(colors[name]);
  });

  // 기본 시트(Sheet1/시트1)가 비어 있으면 정리
  ss.getSheets().forEach(function (sh) {
    if (!HEADERS[sh.getName()] && sh.getLastRow() === 0 && ss.getSheets().length > 5) ss.deleteSheet(sh);
  });

  annotateHeaders_();
  sheet_(APP.SHEETS.RESPONSES).getRange(1, 3, sheet_(APP.SHEETS.RESPONSES).getMaxRows(), 1).setNumberFormat('@');

  // 설정 기본값(없는 키만 추가)
  var s = getSettingsMap_();
  var defaults = [
    ['professor_name', '교수명을 입력하세요', '푸터에 표시되는 교수명'],
    ['affiliation', '○○대학교 간호학과', '푸터에 표시되는 소속(학교/학과)'],
    ['min_responses', 5, '결과를 공개하는 최소 응답 수(3 이상)'],
    ['pin_hash', '', '관리자 PIN 해시(SHA-256 + salt). 메뉴 ② 로 설정하세요. 직접 수정 금지'],
    ['pin_salt', '', 'PIN 해시용 salt. 직접 수정 금지'],
    ['token_salt', randomString_(32, APP.ID_ALPHABET), '토큰 해시용 salt. 변경하면 발급된 토큰이 모두 무효가 됩니다'],
    ['session_epoch', '0', '관리자 세션 무효화 기준값. 직접 수정 금지'],
    ['app_version', APP.VERSION, '설치 버전']
  ];
  defaults.forEach(function (d) {
    if (!s.hasOwnProperty(d[0])) setSetting_(d[0], d[1], d[2]);
  });
  setSetting_('app_version', APP.VERSION);

  // 공통 기본 문항(TEMPLATE)
  if (getItems_(APP.TEMPLATE_ID).length === 0) {
    var rows = DEFAULT_ITEMS.map(function (d, i) {
      return ['t' + ('0' + (i + 1)).slice(-2), APP.TEMPLATE_ID, d[0], d[1], d[2], d[2] === 'likert5', i + 1, false, ''];
    });
    var itemSheet = sheet_(APP.SHEETS.ITEMS);
    itemSheet.getRange(itemSheet.getLastRow() + 1, 1, rows.length, HEADERS.Items.length).setValues(rows);
  }

  // 샘플 교과목 1개(교과목이 하나도 없을 때만)
  var created = false;
  if (getCourses_().length === 0) {
    createDemoCourse_();
    created = true;
  }

  protectSheets_();
  SpreadsheetApp.flush();

  notify_('초기 설정 완료',
    '탭·헤더·기본 문항' + (created ? '·샘플 교과목' : '') + '이 준비되었습니다.\n\n' +
    '다음 단계\n' +
    '1) 메뉴 [강의평가 Studio] ▸ ② 관리자 PIN 설정·재설정\n' +
    '2) Apps Script 편집기에서 [배포] ▸ [새 배포] ▸ 웹 앱\n' +
    '   (실행 사용자: 나, 액세스 권한: 모든 사용자)');
}

function annotateHeaders_() {
  var notes = {
    Courses: ['자동 생성 ID', '교과목명', '학년도(예: 2026)', '학기(1/여름/2/겨울)', '학년', '분반', '수강인원',
      '응답 시작일시', '응답 종료일시', 'code=접속코드, token=일회용 토큰', '접속코드(비우면 링크만으로 참여)',
      '준비/진행/마감(마감=수동 마감)', '결과공개일(비우면 즉시 공개)'],
    Items: ['문항 ID', "교과목 ID('TEMPLATE'=공통 기본 문항)", '영역', '문항', 'likert5|single|multi|text',
      '필수 여부', '순서', '역문항 여부(likert5만)', '선택지(| 로 구분)'],
    Tokens: ['교과목 ID', '토큰 해시(원문은 저장하지 않음)', '사용 여부'],
    Responses: ['응답 ID(UUID)', '교과목 ID', '제출 날짜(시각은 저장하지 않음)']
  };
  Object.keys(notes).forEach(function (name) {
    sheet_(name).getRange(1, 1, 1, notes[name].length).setNotes([notes[name]]);
  });
}

function protectSheets_() {
  [APP.SHEETS.RESPONSES, APP.SHEETS.TOKENS].forEach(function (name) {
    var sh = sheet_(name);
    var existing = sh.getProtections(SpreadsheetApp.ProtectionType.SHEET);
    if (existing.length) return;
    sh.protect()
      .setDescription('강의평가 Studio: 직접 편집하면 익명성·토큰 검증이 깨질 수 있습니다.')
      .setWarningOnly(true);
  });
}

function createDemoCourse_() {
  var now = new Date();
  var start = new Date(now.getTime() - 24 * 3600 * 1000);
  start.setHours(0, 0, 0, 0);
  var end = new Date(now.getTime() + 14 * 24 * 3600 * 1000);
  end.setHours(23, 59, 0, 0);
  var month = Number(Utilities.formatDate(now, tz_(), 'M'));
  var course = {
    course_id: 'demo' + randomString_(4, APP.ID_ALPHABET),
    course_name: '[샘플] AI융합 간호정보학',
    year: Number(Utilities.formatDate(now, tz_(), 'yyyy')),
    semester: month <= 7 ? '1' : '2',
    grade: 3,
    section: 'A',
    enrollment: 40,
    start_at: start,
    end_at: end,
    access_mode: 'code',
    access_code: 'NURSE' + randomString_(2, '23456789'),
    status: APP.STATUS.OPEN,
    result_open_date: ''
  };
  var sh = sheet_(APP.SHEETS.COURSES);
  var row = courseToRow_(course);
  sh.getRange(sh.getLastRow() + 1, 1, 1, row.length).setValues([row]);

  // 기본 문항 복사 후 C 영역 뒤에 CLO 문항 삽입
  var template = getItems_(APP.TEMPLATE_ID);
  var items = [];
  var inserted = false;
  template.forEach(function (it) {
    if (!inserted && it.domain.charAt(0) > 'D') {
      SAMPLE_CLOS.forEach(function (t) {
        items.push({ domain: CLO_DOMAIN, text: t, type: 'likert5', required: true, reverse: false, options: [] });
      });
      inserted = true;
    }
    items.push(it);
  });
  var all = readTable_(APP.SHEETS.ITEMS);
  var taken = {};
  all.rows.forEach(function (r) { taken[String(r.item_id)] = true; });
  var rows = items.map(function (it, i) {
    var id = newItemId_(taken);
    taken[id] = true;
    return itemToRow_({
      item_id: id, course_id: course.course_id, domain: it.domain, text: it.text, type: it.type,
      required: it.required, order: i + 1, reverse: it.reverse, options: it.options || []
    });
  });
  all.sheet.getRange(all.sheet.getLastRow() + 1, 1, rows.length, HEADERS.Items.length).setValues(rows);
  return course.course_id;
}

/* ───────────────────────────── PIN·주소 ───────────────────────────── */

/** 스프레드시트 소유자만 접근할 수 있는 메뉴에서 PIN을 설정·재설정합니다(분실 시 복구 경로). */
function setAdminPinFromMenu() {
  var ui = SpreadsheetApp.getUi();
  var first = ui.prompt('관리자 PIN 설정', '숫자 6~12자리 PIN을 입력하세요.', ui.ButtonSet.OK_CANCEL);
  if (first.getSelectedButton() !== ui.Button.OK) return;
  var pin = String(first.getResponseText()).trim();
  if (!APP.PIN_PATTERN.test(pin)) {
    ui.alert('PIN은 숫자 6~12자리여야 합니다. 다시 시도하세요.');
    return;
  }
  var second = ui.prompt('관리자 PIN 확인', '같은 PIN을 한 번 더 입력하세요.', ui.ButtonSet.OK_CANCEL);
  if (second.getSelectedButton() !== ui.Button.OK) return;
  if (String(second.getResponseText()).trim() !== pin) {
    ui.alert('두 PIN이 일치하지 않습니다. 다시 시도하세요.');
    return;
  }
  storePin_(pin);
  ui.alert('PIN이 설정되었습니다. 기존 로그인 세션과 잠금은 모두 해제되었습니다.');
}

function showWebAppUrl() {
  var url = webAppUrl_();
  var ui = SpreadsheetApp.getUi();
  if (!url) {
    ui.alert('아직 웹 앱으로 배포되지 않았습니다.\nApps Script 편집기 ▸ [배포] ▸ [새 배포] ▸ 웹 앱으로 배포하세요.');
    return;
  }
  var html = HtmlService.createHtmlOutput(
    '<div style="font-family:sans-serif;font-size:14px;line-height:1.7">' +
    '<p><b>교수 관리자 화면</b><br><a href="' + url + '?page=admin" target="_blank">' + url + '?page=admin</a></p>' +
    '<p><b>학생 응답 링크</b>는 관리자 화면 ▸ 교과목 ▸ [링크·QR]에서 교과목별로 확인하세요.</p></div>'
  ).setWidth(520).setHeight(180);
  ui.showModalDialog(html, '웹 앱 주소');
}

/* ───────────────────────────── 테스트 데이터 ───────────────────────────── */

/**
 * [테스트용] 샘플 교과목에 응답 30건을 생성합니다.
 * response_id가 'SAMPLE-'로 시작하므로 deleteSampleData()로 안전하게 지울 수 있습니다.
 * 실제 운영 전에 반드시 삭제하세요.
 */
function generateSampleResponses() {
  var course = getCourses_().filter(function (c) { return c.course_id.indexOf('demo') === 0; })[0];
  if (!course) {
    createDemoCourse_();
    course = getCourses_().filter(function (c) { return c.course_id.indexOf('demo') === 0; })[0];
  }
  var items = getItems_(course.course_id);
  var texts = {
    0: ['EMR 실습이 실제 병원 업무를 이해하는 데 도움이 되었습니다.', '생성형 AI로 간호기록 초안을 만들고 검토하는 활동이 유익했습니다.',
      '매주 퀴즈로 복습할 수 있어 좋았습니다.', '실습 자료가 단계별로 정리되어 있어 따라 하기 쉬웠습니다.', '사례 중심 수업이 흥미로웠습니다.'],
    1: ['실습 시간이 조금 더 길었으면 좋겠습니다.', '과제 마감이 다른 과목과 겹치는 주가 있었습니다.', '용어 설명을 조금 더 천천히 해 주시면 좋겠습니다.',
      '조별 활동 인원이 많아 참여가 어려웠습니다.'],
    2: ['임상 현장의 실제 사례를 더 다뤄 주세요.', 'AI 도구 활용 실습을 더 늘려 주세요.', '중간 피드백 시간이 있으면 좋겠습니다.']
  };
  var textIdx = 0;
  var textSlot = {};
  items.forEach(function (it) { if (it.type === 'text') textSlot[it.item_id] = textIdx++; });

  var start = course.start_at || new Date();
  var today = new Date();
  var span = Math.max(1, Math.floor((today.getTime() - start.getTime()) / 86400000));

  var result = withLock_(function () {
    var sh = sheet_(APP.SHEETS.RESPONSES);
    var headers = ensureResponseColumns_(sh, items);
    var rows = [];
    for (var n = 0; n < 30; n++) {
      var bias = Math.random() < 0.15 ? -1 : 0; // 일부 응답자는 전반적으로 낮게
      var rowObj = {
        response_id: 'SAMPLE-' + Utilities.getUuid(),
        course_id: course.course_id,
        submitted_date: asTextCell_(fmtD_(new Date(start.getTime() + Math.floor(Math.random() * (span + 1)) * 86400000)))
      };
      items.forEach(function (it, k) {
        if (it.type === 'likert5') {
          var r = Math.random();
          var shift = (k % 4 === 3) ? -1 : 0; // 일부 문항은 평균이 낮게
          var v = r < 0.03 ? 1 : r < 0.09 ? 2 : r < 0.27 ? 3 : r < 0.63 ? 4 : 5;
          rowObj[it.item_id] = Math.min(5, Math.max(1, v + bias + (Math.random() < 0.5 ? shift : 0)));
        } else if (it.type === 'text') {
          var pool = texts[textSlot[it.item_id] % 3];
          rowObj[it.item_id] = Math.random() < 0.6 ? asTextCell_(pool[Math.floor(Math.random() * pool.length)]) : '';
        } else if (it.type === 'single') {
          rowObj[it.item_id] = asTextCell_(it.options[Math.floor(Math.random() * it.options.length)]);
        } else if (it.type === 'multi') {
          rowObj[it.item_id] = asTextCell_(it.options.filter(function () { return Math.random() < 0.4; }).join('; '));
        }
      });
      rows.push(headers.map(function (h) { return rowObj.hasOwnProperty(h) ? rowObj[h] : ''; }));
    }
    shuffle_(rows);
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
    return { ok: true, course: course.course_name };
  });

  notify_('샘플 응답 생성', result.ok
    ? '"' + result.course + '"에 샘플 응답 30건을 만들었습니다.\n\n⚠ 실제 강의평가를 시작하기 전에 메뉴 ▸ [테스트] 샘플 데이터 모두 삭제를 실행하세요.'
    : '다른 작업이 진행 중입니다. 잠시 후 다시 실행하세요.');
  return result;
}

/** [테스트용] 샘플 응답(SAMPLE-*)과 샘플 교과목(demo*)의 문항·토큰·응답을 모두 삭제합니다. */
function deleteSampleData(skipConfirm) {
  if (skipConfirm !== true) {
    var ui = getUiOrNull_();
    if (ui) {
      var ans = ui.alert('샘플 데이터 삭제', '샘플 교과목과 SAMPLE 응답을 모두 삭제합니다. 계속할까요?', ui.ButtonSet.YES_NO);
      if (ans !== ui.Button.YES) return { ok: false, code: 'CANCELLED' };
    }
  }
  var result = withLock_(function () {
    var isDemo = function (id) { return String(id).indexOf('demo') === 0; };
    var removed = filterTable_(APP.SHEETS.RESPONSES, function (r) {
      return String(r.response_id).indexOf('SAMPLE-') !== 0 && !isDemo(r.course_id);
    });
    filterTable_(APP.SHEETS.TOKENS, function (r) { return !isDemo(r.course_id); });
    filterTable_(APP.SHEETS.ITEMS, function (r) { return !isDemo(r.course_id); });
    filterTable_(APP.SHEETS.COURSES, function (r) { return !isDemo(r.course_id); });
    pruneResponseColumns_();
    return { ok: true, removed: removed };
  });
  notify_('샘플 데이터 삭제', result.ok ? '샘플 응답 ' + result.removed + '건과 샘플 교과목을 삭제했습니다.' : '다른 작업이 진행 중입니다.');
  return result;
}

/** 더 이상 존재하지 않는 문항이면서 데이터가 비어 있는 응답 열을 정리합니다. */
function pruneResponseColumns_() {
  var t = readTable_(APP.SHEETS.RESPONSES);
  var live = {};
  getAllItems_().forEach(function (it) { live[it.item_id] = true; });
  var keep = t.headers.filter(function (h, i) {
    if (i < HEADERS.Responses.length) return true;
    if (!h) return false;
    if (live[h]) return true;
    return t.rows.some(function (r) { return r[h] !== '' && r[h] != null; });
  });
  if (keep.length === t.headers.length) return;
  var sh = t.sheet;
  var width = sh.getLastColumn();
  sh.getRange(1, 1, Math.max(1, sh.getLastRow()), width).clearContent();
  sh.getRange(1, 1, 1, width).clearNote();
  sh.getRange(1, 1, 1, keep.length).setValues([keep]).setFontWeight('bold');
  var body = t.rows.map(function (r) { return keep.map(function (h) { return r[h] == null ? '' : r[h]; }); });
  if (body.length) sh.getRange(2, 1, body.length, keep.length).setValues(body);
  var itemsById = {};
  getAllItems_().forEach(function (it) { itemsById[it.item_id] = it; });
  var notes = keep.map(function (h, i) {
    if (i < HEADERS.Responses.length) return '';
    var it = itemsById[h];
    return it ? '[' + it.domain + '] ' + it.text : '';
  });
  sh.getRange(1, 1, 1, keep.length).setNotes([notes]);
}

/* ───────────────────────────── 보조 ───────────────────────────── */

function getUiOrNull_() {
  try { return SpreadsheetApp.getUi(); } catch (e) { return null; }
}

/** 편집기에서 실행하면 로그로, 스프레드시트 메뉴에서 실행하면 알림창으로 안내합니다. */
function notify_(title, message) {
  var ui = getUiOrNull_();
  if (ui) {
    try { ui.alert(title, message, ui.ButtonSet.OK); return; } catch (e) { /* 편집기 실행 */ }
  }
  console.log(title + '\n' + message);
}
