/**
 * 강의평가 Studio — 초기 설정·스프레드시트 메뉴·테스트 데이터
 */

/**
 * 공통 기본 문항 은행: [영역, 문항, 유형, 선택지, 범위('online' = 비대면·혼합 수업 전용)]
 * D 영역(학습성과·CLO)은 교과목마다 다르므로 교과목에서 입력합니다.
 */
var DEFAULT_ITEMS = [
  ['A. 강의 설계', '강의계획서에 제시된 내용과 실제 수업이 일치하였다.', 'likert5'],
  ['A. 강의 설계', '수업 목표가 명확하게 제시되었다.', 'likert5'],
  ['B. 교수학습방법', '교수자의 설명은 이해하기 쉬웠다.', 'likert5'],
  ['B. 교수학습방법', '수업 자료(교안·영상·실습자료 등)는 학습에 유용하였다.', 'likert5'],
  ['B. 교수학습방법', '수업 중 질문하거나 참여할 기회가 충분히 주어졌다.', 'likert5'],
  ['B. 교수학습방법', '토의·사례·시뮬레이션 등 다양한 교수학습방법이 활용되었다.', 'likert5'],
  ['C. 평가 및 과제', '평가 기준과 방법이 사전에 공지되었다.', 'likert5'],
  ['C. 평가 및 과제', '평가는 공정하게 이루어졌다.', 'likert5'],
  ['C. 평가 및 과제', '과제의 양과 난이도가 적절하였다.', 'likert5'],
  ['C. 평가 및 과제', '과제·시험에 대한 피드백을 적절한 시기에 받았다.', 'likert5'],
  ['E. 학습 환경', '이론 강의실의 환경(좌석·조명·냉난방·기자재)이 학습에 적절하였다.', 'likert5'],
  ['E. 학습 환경', '실습실의 시설과 실습 기자재가 실습하기에 충분하였다.', 'likert5'],
  ['E. 학습 환경', '강의실·실습실의 유무선 인터넷(Wi-Fi) 환경이 원활하였다.', 'likert5'],
  ['F. 디지털·AI 활용', '수업에서 활용한 디지털 도구·AI는 학습에 도움이 되었다.', 'likert5'],
  ['F. 디지털·AI 활용', '이 수업에서 배운 디지털·AI 활용 역량을 간호실무에 활용할 수 있다고 느낀다.', 'likert5'],
  ['G. 종합', '이 수업에 전반적으로 만족한다.', 'likert5'],
  ['G. 종합', '이 수업을 후배에게 추천하고 싶다.', 'likert5'],
  ['H. 온라인(비대면) 강의', '온라인 강의 영상·음성의 품질이 학습하기에 적절하였다.', 'likert5', null, 'online'],
  ['H. 온라인(비대면) 강의', '온라인 학습 플랫폼(LMS) 접속과 사용이 원활하였다.', 'likert5', null, 'online'],
  ['H. 온라인(비대면) 강의', '온라인 수업에서도 질문·토론 등 상호작용 기회가 충분하였다.', 'likert5', null, 'online'],
  ['H. 온라인(비대면) 강의', '온라인 강의 자료와 공지가 제때 제공되었다.', 'likert5', null, 'online'],
  ['서술형', '이 수업에서 가장 도움이 된 점은 무엇인가요?', 'text'],
  ['서술형', '교수학습방법·평가·과제에서 개선이 필요한 점을 적어 주세요.', 'text'],
  ['서술형', '다음 학기 수업에 바라는 점이 있다면 적어 주세요.', 'text'],
  ['응답자 정보', '성별', 'select', ['남', '여']]
];

/** 이번 학기 교과목 예시(샘플). 교과목명·학년은 실제 담당 교과목, 수강인원·기간은 예시값입니다. */
var SAMPLE_COURSES = [
  {
    course_name: '디지털리터러시와 AI활용', grade: 1, section: 'A', enrollment: 40, delivery_mode: '대면',
    clos: [
      '나는 디지털 도구를 활용하여 학습 자료를 검색·정리할 수 있게 되었다.',
      '나는 생성형 AI를 학습에 윤리적이고 비판적으로 활용할 수 있게 되었다.'
    ]
  },
  {
    course_name: 'AI융합 간호정보학', grade: 3, section: 'A', enrollment: 40, delivery_mode: '혼합',
    clos: [
      '나는 간호정보시스템(EMR)의 구조와 기능을 설명할 수 있게 되었다.',
      '나는 AI 기반 임상의사결정지원 결과를 간호 근거에 비추어 검토할 수 있게 되었다.'
    ]
  }
];

var CLO_DOMAIN = 'D. 학습성과(CLO)';

/* ───────────────────────────── 메뉴 ───────────────────────────── */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('강의평가 Studio')
    .addItem('① 초기 설정 실행', 'setup')
    .addItem('② 관리자 PIN 설정·재설정', 'setAdminPinFromMenu')
    .addItem('웹 앱 주소 확인', 'showWebAppUrl')
    .addSeparator()
    .addItem('[테스트] 샘플 응답 생성(교과목별 30건)', 'generateSampleResponses')
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
    ensureHeaders_(sh, headers);
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
    ['professor_name', '정종필', '푸터에 표시되는 교수명([설정] 탭에서 변경)'],
    ['affiliation', '청암대학교 간호학과', '푸터에 표시되는 소속(학교/학과)'],
    ['min_responses', 5, '결과를 공개하는 최소 응답 수(3 이상)'],
    ['departments', '간호학과', '교과목 설정의 학과 드롭다운 목록(줄바꿈으로 구분)'],
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
      return itemToRow_({
        item_id: 't' + ('0' + (i + 1)).slice(-2), course_id: APP.TEMPLATE_ID, domain: d[0], text: d[1], type: d[2],
        required: d[2] === 'likert5', order: i + 1, reverse: false, options: d[3] || [], scope: d[4] || ''
      });
    });
    var itemSheet = sheet_(APP.SHEETS.ITEMS);
    itemSheet.getRange(itemSheet.getLastRow() + 1, 1, rows.length, HEADERS.Items.length).setValues(rows);
  }

  // 이번 학기 교과목 예시(교과목이 하나도 없을 때만)
  var created = false;
  if (getCourses_().length === 0) {
    SAMPLE_COURSES.forEach(createDemoCourse_);
    created = true;
  }

  protectSheets_();
  SpreadsheetApp.flush();

  notify_('초기 설정 완료',
    '탭·헤더·기본 문항' + (created ? '·이번 학기 교과목 예시 2개' : '') + '이 준비되었습니다.\n\n' +
    '다음 단계\n' +
    '1) 메뉴 [강의평가 Studio] ▸ ② 관리자 PIN 설정·재설정\n' +
    '2) Apps Script 편집기에서 [배포] ▸ [새 배포] ▸ 웹 앱\n' +
    '   (실행 사용자: 나, 액세스 권한: 모든 사용자)');
}

function annotateHeaders_() {
  var notes = {
    Courses: ['자동 생성 ID', '교과목명', '학년도(예: 2026)', '학기(1/여름/2/겨울)', '학년', '분반', '수강인원',
      '응답 시작일시', '응답 종료일시', 'code=접속코드, token=일회용 토큰', '접속코드(비우면 링크만으로 참여)',
      '준비/진행/마감(마감=수동 마감)', '결과공개일(비우면 즉시 공개)', '학과', '수업 방식(대면/비대면/혼합)'],
    Items: ['문항 ID', "교과목 ID('TEMPLATE'=공통 기본 문항)", '영역', '문항', 'likert5|single|multi|select|text',
      '필수 여부', '순서', '역문항 여부(likert5만)', '선택지(| 로 구분)', "범위('online'=비대면·혼합 수업 전용)"],
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

/** 헤더 행에 없는 열만 끝에 추가합니다(이전 버전 시트 자동 확장). */
function ensureHeaders_(sh, headers) {
  var lastCol = sh.getLastColumn();
  var current = lastCol > 0 ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); }) : [];
  if (!current.filter(String).length) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    return;
  }
  var missing = headers.filter(function (h) { return current.indexOf(h) < 0; });
  if (!missing.length) return;
  var start = current.filter(String).length + 1;
  if (start + missing.length - 1 > sh.getMaxColumns()) sh.insertColumnsAfter(sh.getMaxColumns(), start + missing.length - 1 - sh.getMaxColumns());
  sh.getRange(1, start, 1, missing.length).setValues([missing]);
}

/** 이번 학기 기준 예시 교과목 1개를 만듭니다(지금부터 2주간 응답 가능). */
function createDemoCourse_(spec) {
  spec = spec || SAMPLE_COURSES[0];
  var now = new Date();
  var start = new Date(now.getTime() - 24 * 3600 * 1000);
  start.setHours(0, 0, 0, 0);
  var end = new Date(now.getTime() + 14 * 24 * 3600 * 1000);
  end.setHours(23, 59, 0, 0);
  var month = Number(Utilities.formatDate(now, tz_(), 'M'));
  var depts = departments_(getSettingsMap_());
  var course = {
    course_id: 'demo' + randomString_(4, APP.ID_ALPHABET),
    course_name: spec.course_name,
    year: Number(Utilities.formatDate(now, tz_(), 'yyyy')) - (month <= 2 ? 1 : 0),
    semester: month >= 3 && month <= 8 ? '1' : '2',
    grade: spec.grade,
    section: spec.section,
    enrollment: spec.enrollment,
    start_at: start,
    end_at: end,
    access_mode: 'code',
    access_code: 'NURSE' + randomString_(2, '23456789'),
    status: APP.STATUS.OPEN,
    result_open_date: '',
    department: depts[0],
    delivery_mode: spec.delivery_mode
  };
  var sh = sheet_(APP.SHEETS.COURSES);
  var row = courseToRow_(course);
  sh.getRange(sh.getLastRow() + 1, 1, 1, row.length).setValues([row]);

  // 기본 문항 복사(대면이면 온라인 문항 제외) 후 C 영역 뒤에 CLO 문항 삽입
  var template = getItems_(APP.TEMPLATE_ID).filter(function (it) {
    return !(course.delivery_mode === '대면' && it.scope === 'online');
  });
  var items = [];
  var inserted = false;
  template.forEach(function (it) {
    if (!inserted && it.domain.charAt(0) > 'D') {
      spec.clos.forEach(function (t) {
        items.push({ domain: CLO_DOMAIN, text: t, type: 'likert5', required: true, reverse: false, options: [], scope: '' });
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
      required: it.required, order: i + 1, reverse: it.reverse, options: it.options || [], scope: it.scope || ''
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
  var demos = getCourses_().filter(function (c) { return c.course_id.indexOf('demo') === 0; });
  if (!demos.length) {
    SAMPLE_COURSES.forEach(createDemoCourse_);
    demos = getCourses_().filter(function (c) { return c.course_id.indexOf('demo') === 0; });
  }
  var made = 0, names = [];
  var result = withLock_(function () {
    demos.forEach(function (course) {
      appendSampleRows_(course, 30);
      made += 30;
      names.push(course.course_name);
    });
    return { ok: true };
  });
  if (result.ok) result.created = made;
  notify_('샘플 응답 생성', result.ok
    ? names.join(', ') + '에 교과목마다 샘플 응답 30건(총 ' + made + '건)을 만들었습니다.\n\n⚠ 실제 강의평가를 시작하기 전에 메뉴 ▸ [테스트] 샘플 데이터 모두 삭제를 실행하세요.'
    : '다른 작업이 진행 중입니다. 잠시 후 다시 실행하세요.');
  return result;
}

var SAMPLE_TEXTS = [
  ['EMR 실습이 실제 병원 업무를 이해하는 데 도움이 되었습니다.', '생성형 AI로 간호기록 초안을 만들고 검토하는 활동이 유익했습니다.',
    '매주 퀴즈로 복습할 수 있어 좋았습니다.', '실습 자료가 단계별로 정리되어 있어 따라 하기 쉬웠습니다.', '사례 중심 토의 수업이 흥미로웠습니다.',
    '시뮬레이션 실습으로 간호과정을 직접 적용해 볼 수 있었습니다.', 'AI 활용 실습과 피드백이 가장 도움이 되었습니다.', '교수님의 설명과 실습 자료가 명확했습니다.'],
  ['실습 시간이 조금 더 길었으면 좋겠습니다.', '과제 마감이 다른 과목과 겹치는 주가 있었습니다.', '실습실 Wi-Fi가 자주 끊겨서 실습이 지연되었습니다.',
    '조별 과제 인원이 많아 참여가 어려웠습니다.', '온라인 강의 영상의 음질이 고르지 않았습니다.', '과제 피드백이 조금 더 빨랐으면 합니다.',
    '강의실 냉난방이 불편했습니다.', '평가 기준을 루브릭으로 더 자세히 알려 주세요.'],
  ['임상 현장의 실제 사례를 더 다뤄 주세요.', 'AI 도구 활용 실습을 더 늘려 주세요.', '중간 피드백 시간이 있으면 좋겠습니다.',
    '실습실 인터넷 환경이 개선되면 좋겠습니다.', '시뮬레이션 실습 기회를 늘려 주세요.']
];

/** 샘플 응답 n건을 추가합니다(withLock_ 안에서 호출). */
function appendSampleRows_(course, n) {
  var items = itemsForCourse_(course);
  var sh = sheet_(APP.SHEETS.RESPONSES);
  var headers = ensureResponseColumns_(sh, items);
  var start = course.start_at || new Date();
  var span = Math.max(1, Math.floor((Date.now() - start.getTime()) / 86400000));
  var textSlot = {}, k = 0;
  items.forEach(function (it) { if (it.type === 'text') textSlot[it.item_id] = k++; });
  var rows = [];
  for (var i = 0; i < n; i++) {
    var bias = Math.random() < 0.15 ? -1 : 0; // 일부 응답자는 전반적으로 낮게
    var rowObj = {
      response_id: 'SAMPLE-' + Utilities.getUuid(),
      course_id: course.course_id,
      submitted_date: asTextCell_(fmtD_(new Date(start.getTime() + Math.floor(Math.random() * (span + 1)) * 86400000)))
    };
    items.forEach(function (it, j) {
      if (it.type === 'likert5') {
        var r = Math.random();
        var shift = /환경|인터넷|온라인/.test(it.domain + it.text) ? -1 : (j % 5 === 4 ? -1 : 0); // 환경·온라인 문항은 평균이 낮게
        var v = r < 0.03 ? 1 : r < 0.09 ? 2 : r < 0.27 ? 3 : r < 0.63 ? 4 : 5;
        rowObj[it.item_id] = Math.min(5, Math.max(1, v + bias + (Math.random() < 0.6 ? shift : 0)));
      } else if (it.type === 'text') {
        var pool = SAMPLE_TEXTS[textSlot[it.item_id] % SAMPLE_TEXTS.length];
        rowObj[it.item_id] = Math.random() < 0.7 ? asTextCell_(pool[Math.floor(Math.random() * pool.length)]) : '';
      } else if (it.type === 'select') {
        var x = Math.random();
        rowObj[it.item_id] = x < 0.08 ? '' : asTextCell_(it.options[x < 0.30 ? 0 : 1] || it.options[0]);
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
}

/** [테스트용] 샘플 응답(SAMPLE-*)과, 실제 응답이 없는 예시 교과목(demo*)의 문항·토큰을 삭제합니다. */
function deleteSampleData(skipConfirm) {
  if (skipConfirm !== true) {
    var ui = getUiOrNull_();
    if (ui) {
      var ans = ui.alert('샘플 데이터 삭제', 'SAMPLE 응답과 예시 교과목을 삭제합니다(실제 응답이 있는 교과목은 보존). 계속할까요?', ui.ButtonSet.YES_NO);
      if (ans !== ui.Button.YES) return { ok: false, code: 'CANCELLED' };
    }
  }
  var result = withLock_(function () {
    var removed = filterTable_(APP.SHEETS.RESPONSES, function (r) {
      return String(r.response_id).indexOf('SAMPLE-') !== 0;
    });
    // 예시 교과목(demo*)은 실제 응답이 하나도 없을 때만 삭제합니다(예시 교과목으로 실제 평가를 진행한 경우 보호).
    var used = {};
    readResponses_().forEach(function (r) { used[String(r.course_id)] = true; });
    var kept = getCourses_().filter(function (c) { return c.course_id.indexOf('demo') === 0 && used[c.course_id]; }).length;
    var isDemo = function (id) { return String(id).indexOf('demo') === 0 && !used[String(id)]; };
    filterTable_(APP.SHEETS.TOKENS, function (r) { return !isDemo(r.course_id); });
    filterTable_(APP.SHEETS.ITEMS, function (r) { return !isDemo(r.course_id); });
    filterTable_(APP.SHEETS.COURSES, function (r) { return !isDemo(r.course_id); });
    pruneResponseColumns_();
    return { ok: true, removed: removed, keptCourses: kept };
  });
  notify_('샘플 데이터 삭제', result.ok
    ? '샘플 응답 ' + result.removed + '건과 예시 교과목을 삭제했습니다.' + (result.keptCourses ? '\n(실제 응답이 있는 예시 교과목 ' + result.keptCourses + '개는 보존했습니다.)' : '')
    : '다른 작업이 진행 중입니다.');
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
