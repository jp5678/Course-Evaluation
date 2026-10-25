/**
 * ============================================================
 *  강의평가 Studio v1.4.12 — 정식 설치 파일(단일 파일)
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

/* ───── 화면 파일(HTML) — 원본: Student.html, Admin.html, Styles.html, Scripts.html, Manual.html ───── */
var __FILES__ = {
 "Student": "<!DOCTYPE html>\n<html lang=\"ko\">\n<head>\n  <base target=\"_top\">\n  <meta charset=\"utf-8\">\n  <meta name=\"color-scheme\" content=\"light dark\">\n  <link rel=\"preconnect\" href=\"https://cdn.jsdelivr.net\" crossorigin>\n  <link rel=\"stylesheet\" href=\"https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css\">\n  <?!= include('Styles'); ?>\n</head>\n<body class=\"page-student cesstudentpage\" data-legacy=\"<?= legacyLink ?>\" data-admin-url=\"<?= adminUrl ?>\">\n  <a class=\"skip-link\" href=\"#main\">본문 바로가기</a>\n  <div class=\"deco\" aria-hidden=\"true\"><span class=\"s1\"></span><span class=\"s2\"></span><span class=\"s3\"></span><span class=\"s4\"></span></div>\n\n  <header class=\"topbar\">\n    <div class=\"topbar-inner\">\n      <div class=\"brand\">\n        <span class=\"brand-mark\"><i data-lucide=\"clipboard-check\" aria-hidden=\"true\"></i></span>\n        <span>강의평가 Studio<small>익명 수업 설문</small></span>\n      </div>\n    </div>\n  </header>\n\n  <main id=\"main\" class=\"wrap narrow\" tabindex=\"-1\">\n    <div id=\"app\">\n      <div class=\"skeleton\" style=\"min-height:220px\" aria-hidden=\"true\"></div>\n      <p class=\"sr-only\">불러오는 중입니다.</p>\n    </div>\n  </main>\n\n  <div id=\"sr-status\" class=\"sr-only\" role=\"status\" aria-live=\"polite\"></div>\n\n  <footer class=\"footer\">\n    <div class=\"credit\">Developed by 정종필 교수 · 청암대학교 간호학과</div>\n    <p class=\"disclaimer\">이 설문은 학교 공식 강의평가를 대체하지 않는 교수자 자율형 형성평가·CQI(지속적 질 개선)용 설문입니다.</p>\n  </footer>\n\n  <script src=\"https://cdn.jsdelivr.net/npm/lucide@0.460.0/dist/umd/lucide.min.js\" defer onload=\"window.CES && CES.icons()\"></script>\n  <?!= include('Scripts'); ?>\n  <script>\n  (function () {\n    'use strict';\n    var $ = CES.$, $$ = CES.$$, esc = CES.esc, icon = CES.icon;\n    var app = document.getElementById('app');\n    var SHORT = ['전혀 아니다', '아니다', '보통', '그렇다', '매우 그렇다'];\n    var EMO = ['😞', '🙁', '😐', '🙂', '😄'];\n    // 영역 첫 글자 → 아이콘·색(배경 톤)\n    var DOMAIN_LOOK = {\n      A: ['compass', 'sky'], B: ['presentation', 'primary'], C: ['clipboard-check', 'butter'], D: ['target', 'accent'],\n      E: ['building-2', 'sky'], F: ['cpu', 'primary'], G: ['heart', 'accent'], H: ['monitor-play', 'butter'], I: ['stethoscope', 'sky']\n    };\n    function domainTag(domain) {\n      var look = DOMAIN_LOOK[String(domain).charAt(0)] || (/서술/.test(domain) ? ['message-circle', 'butter'] : ['user-round', 'plain']);\n      return '<span class=\"domain-tag tone-' + look[1] + '\"><span class=\"ic\">' + icon(look[0]) + '</span>' + esc(domain) + '</span>';\n    }\n    var CHEERS = [[0.5, '벌써 절반 왔어요! 조금만 더 힘내요 💪'], [0.8, '거의 다 왔어요! 🙌']];\n\n    var S = {\n      courseId: '',\n      tokenPrefill: '',\n      // 공통 주소에서 입력한 접속코드(또는 토큰): 인증 단계에서 자동으로 확인해 다시 입력하지 않게 합니다.\n      autoCred: '',\n      course: null,\n      items: [],\n      labels: ['전혀 그렇지 않다', '그렇지 않다', '보통이다', '그렇다', '매우 그렇다'],\n      cred: '',\n      answers: {},\n      steps: [],\n      step: 0,\n      mode: '',\n      nonce: '',\n      submitting: false,\n      dir: 1,\n      cheered: {}\n    };\n    var DRAFT_KEY, DONE_KEY;\n    var ADMIN_URL = document.body.getAttribute('data-admin-url') || '';\n    // 이전 버전 링크(?c=…&k=…)로 들어온 경우: 자동 접속 대신 안내 후 접속코드 입력\n    var LEGACY = document.body.getAttribute('data-legacy') === '1';\n    var LEGACY_MSG = '이전 방식의 링크입니다. 교수님이 안내한 접속코드를 입력해 주세요.';\n    // 같은 탭에서 새로 고쳐도 이어서 응답하도록, 접속코드로 찾은 교과목을 탭 안에만 기억합니다(탭을 닫으면 지워짐).\n    var ACTIVE_KEY = 'ces:active';\n    function setCourseId(id) {\n      S.courseId = id;\n      DRAFT_KEY = 'ces:draft:' + id;\n      DONE_KEY = 'ces:done:' + id;\n    }\n    setCourseId(S.courseId);\n\n    /* ───── 공통 렌더링 ───── */\n    function render(html, focusSel) {\n      app.innerHTML = html;\n      CES.icons();\n      var target = focusSel ? $(focusSel, app) : $('h1, h2', app);\n      if (target) {\n        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');\n        target.focus({ preventScroll: true });\n      }\n      window.scrollTo({ top: 0, behavior: CES.reducedMotion() ? 'auto' : 'smooth' });\n    }\n\n    function notice(kind, extra) {\n      var c = S.course || {};\n      var map = {\n        INVALID: ['link-2-off', 'warn', '유효하지 않은 링크입니다', '교수님이 안내한 주소에서 접속코드를 입력해 주세요.'],\n        NOT_FOUND: ['search-x', 'warn', '설문을 찾을 수 없습니다', '링크가 정확한지 확인하거나 교수님께 문의해 주세요.'],\n        NOT_STARTED: ['calendar-clock', 'warn', '아직 응답 기간이 아닙니다',\n          c.start_label ? '응답은 ' + c.start_label + '부터 할 수 있습니다. 그때 다시 접속해 주세요.' : '응답 기간이 시작되면 다시 접속해 주세요.'],\n        CLOSED: ['lock', '', '응답이 마감되었습니다',\n          '관심을 가져 주셔서 감사합니다.' + (c.end_label ? ' (응답 기간: ~ ' + c.end_label + ')' : '')],\n        TOKEN_USED: ['ticket-x', 'danger', '이미 사용된 토큰입니다',\n          '일회용 토큰은 한 번만 제출할 수 있습니다. 본인이 제출하지 않았다면 교수님께 새 토큰을 요청하세요.'],\n        SETUP_REQUIRED: ['wrench', 'warn', '설문 준비 중입니다', '교수님이 아직 설문을 준비하고 있습니다. 잠시 후 다시 접속해 주세요.'],\n        ERROR: ['cloud-off', 'danger', '연결에 문제가 있습니다', '네트워크 상태를 확인한 뒤 다시 시도해 주세요.']\n      };\n      var m = map[kind] || map.ERROR;\n      render(\n        '<section class=\"card pad-lg center stack\" aria-labelledby=\"nt\">' +\n        '<div class=\"notice-icon ' + m[1] + '\">' + icon(m[0]) + '</div>' +\n        '<h1 id=\"nt\">' + esc(m[2]) + '</h1>' +\n        (c.course_name ? '<p class=\"muted\">' + esc(c.course_name) + '</p>' : '') +\n        '<p>' + esc(m[3]) + '</p>' +\n        (extra && extra.retry ? '<div><button type=\"button\" class=\"btn primary\" data-act=\"reload\">' + icon('rotate-cw') + '다시 시도</button></div>' : '') +\n        '</section>'\n      );\n    }\n\n    function courseMeta(c) {\n      var parts = [c.year + '학년도 ' + c.semester + '학기'];\n      if (c.grade) parts.push(c.grade + '학년');\n      if (c.section) parts.push(c.section + '반');\n      if (c.delivery_mode && c.delivery_mode !== '대면') parts.push(c.delivery_mode + ' 수업');\n      return parts.map(function (p) { return '<span class=\"badge\">' + esc(p) + '</span>'; }).join('');\n    }\n\n    /* ───── 1. 진입 ───── */\n    function start() {\n      if (!S.courseId) {\n        if (LEGACY) { LEGACY = false; CES.store.remove(ACTIVE_KEY); renderCodeEntry('', LEGACY_MSG); return; }\n        var active = CES.store.get(ACTIVE_KEY);\n        if (!active) { renderCodeEntry(); return; }\n        setCourseId(String(active));\n      }\n      CES.call('getCourseForStudent', [S.courseId]).then(function (res) {\n        if (!res.ok) {\n          if (res.code === 'NOT_FOUND') return recoverNotFound();\n          if (res.code === 'SETUP_REQUIRED') return notice('SETUP_REQUIRED');\n          return notice('ERROR', { retry: true });\n        }\n        S.course = res.course;\n        if (res.state === '준비') return notice('NOT_STARTED');\n        if (res.state === '마감') return notice('CLOSED');\n        var draft = CES.store.get(DRAFT_KEY);\n        if (draft && draft.v === 1 && (draft.cred || !needsCredential())) {\n          resumeDraft(draft);\n        } else {\n          renderIntro();\n        }\n      });\n    }\n\n    /* ───── 0. 공통 주소: 접속코드만 입력 ───── */\n    function renderCodeEntry(errorMsg, infoMsg) {\n      render(\n        '<form class=\"card pad-lg stack-lg rise\" id=\"code-form\" novalidate aria-labelledby=\"ce\">' +\n        '<div class=\"notice-icon\">' + icon('key-round') + '</div>' +\n        '<div class=\"center\"><h1 id=\"ce\">접속코드 입력</h1><p class=\"muted small\" style=\"margin-top:6px\">수업 시간에 안내받은 코드만 입력하면 바로 시작합니다.</p></div>' +\n        (infoMsg ? '<div class=\"callout info\" role=\"status\" data-legacy-note>' + icon('info') + '<p class=\"small\">' + esc(infoMsg) + '</p></div>' : '') +\n        '<div class=\"field\">' +\n        '<label for=\"code\">접속코드</label>' +\n        '<input id=\"code\" class=\"input code\" name=\"code\" autocomplete=\"off\" autocapitalize=\"characters\" spellcheck=\"false\" maxlength=\"12\" inputmode=\"text\" ' +\n        'placeholder=\"예: 4JQZJA\" aria-describedby=\"code-hint' + (errorMsg ? ' code-err' : '') + '\"' + (errorMsg ? ' aria-invalid=\"true\"' : '') + '>' +\n        '<p class=\"hint\" id=\"code-hint\">영문·숫자 코드입니다. 대소문자는 구분하지 않습니다. 종이 토큰을 받았다면 토큰을 입력하세요.</p>' +\n        (errorMsg ? '<p class=\"error\" id=\"code-err\">' + icon('circle-alert') + ' ' + esc(errorMsg) + '</p>' : '') +\n        '</div>' +\n        '<button type=\"submit\" class=\"btn primary block\" id=\"code-btn\">시작하기' + icon('arrow-right') + '</button>' +\n        (ADMIN_URL ? '<p class=\"tiny muted center\"><a href=\"' + esc(ADMIN_URL) + '\" target=\"_top\">교수자 로그인</a></p>' : '') +\n        '</form>',\n        '#code'\n      );\n      $('#code-form').addEventListener('submit', function (e) {\n        e.preventDefault();\n        var v = $('#code').value.toUpperCase().replace(/[^A-Z0-9]/g, '');\n        if (!v) { renderCodeEntry('접속코드를 입력하세요.'); return; }\n        var restore = CES.busyButton($('#code-btn'), '찾는 중…');\n        CES.call('findCourseByCode', [v]).then(function (res) {\n          restore();\n          if (!res.ok) {\n            if (res.code === 'BAD_CODE') return renderCodeEntry('일치하는 설문이 없습니다. 코드를 다시 확인해 주세요.');\n            return notice('ERROR', { retry: true });\n          }\n          setCourseId(res.course_id);\n          CES.store.set(ACTIVE_KEY, res.course_id);\n          S.autoCred = v;\n          if (res.token) S.tokenPrefill = v;\n          start();\n        });\n      });\n    }\n\n    /** 교과목이 그사이 삭제된 경우: 막힌 화면 대신 접속코드 입력 화면으로 안내합니다. */\n    function recoverNotFound() {\n      S.autoCred = '';\n      S.courseId = '';\n      CES.store.remove(ACTIVE_KEY);\n      renderCodeEntry('설문을 찾을 수 없습니다. 안내받은 접속코드를 다시 확인해 주세요.');\n    }\n\n    function needsCredential() {\n      return S.course.access_mode === 'token' || S.course.has_code;\n    }\n\n    function renderIntro() {\n      var c = S.course;\n      var done = CES.store.get(DONE_KEY, window.localStorage);\n      render(\n        '<section class=\"card pad-lg stack-lg rise\" aria-labelledby=\"ct\">' +\n        '<div class=\"meta\">' + courseMeta(c) + '<span class=\"badge open\">' + icon('circle-dot') + '응답 진행 중</span></div>' +\n        '<div><p class=\"muted small\">' + esc(c.department ? c.department + ' · ' : '') + '우리 수업 이야기</p><h1 id=\"ct\">' + esc(c.course_name) + '</h1>' +\n        '<p class=\"muted small\" style=\"margin-top:6px\">여러분의 솔직한 한마디가 다음 수업을 바꿉니다.</p></div>' +\n        '<div class=\"stickers\" aria-hidden=\"true\">' +\n        '<div class=\"sticker\" style=\"--i:0\"><span class=\"emo\">🙈</span>완전 익명</div>' +\n        '<div class=\"sticker\" style=\"--i:1\"><span class=\"emo\">⚡</span>약 ' + c.est_minutes + '분</div>' +\n        '<div class=\"sticker\" style=\"--i:2\"><span class=\"emo\">💬</span>' + c.item_count + '문항</div>' +\n        '</div>' +\n        '<p class=\"sr-only\">익명 설문, ' + c.item_count + '문항, 약 ' + c.est_minutes + '분 소요</p>' +\n        (c.end_label ? '<p class=\"small muted\">' + icon('calendar') + ' 마감: <span class=\"num\">' + esc(c.end_label) + '</span></p>' : '') +\n        (done && c.access_mode !== 'token' ? '<div class=\"callout\">' + icon('info') + '<p class=\"small\">이 기기에서 이미 제출한 기록이 있습니다. 한 사람은 한 번만 응답해 주세요.</p></div>' : '') +\n        '<button type=\"button\" class=\"btn primary block\" data-act=\"to-auth\">' + '시작하기' + icon('arrow-right') + '</button>' +\n        '<p class=\"tiny muted center\"><button type=\"button\" class=\"linklike\" data-act=\"other-code\">다른 접속코드 입력</button></p>' +\n        '</section>'\n      );\n    }\n\n    /* ───── 2. 인증 ───── */\n    function renderAuth(errorMsg) {\n      if (!needsCredential()) { verify(''); return; }\n      if (S.autoCred) { var auto = S.autoCred; S.autoCred = ''; verify(auto); return; }\n      var isToken = S.course.access_mode === 'token';\n      var label = isToken ? '일회용 토큰' : '접속코드';\n      var help = isToken ? '교수님께 받은 종이 토큰의 8자리 문자(예: ABCD-EF23)를 입력하세요. 토큰은 한 번만 사용할 수 있습니다.'\n        : '수업 시간에 안내받은 접속코드를 입력하세요.';\n      render(\n        '<form class=\"card pad-lg stack-lg\" id=\"auth-form\" novalidate aria-labelledby=\"at\">' +\n        '<div class=\"notice-icon\">' + icon(isToken ? 'ticket' : 'key-round') + '</div>' +\n        '<div class=\"center\"><h1 id=\"at\">' + label + ' 입력</h1><p class=\"muted small\" style=\"margin-top:6px\">' + esc(S.course.course_name) + '</p></div>' +\n        '<div class=\"field\">' +\n        '<label for=\"cred\">' + label + '</label>' +\n        '<input id=\"cred\" class=\"input code\" name=\"cred\" autocomplete=\"off\" autocapitalize=\"characters\" spellcheck=\"false\" ' +\n        'maxlength=\"' + (isToken ? 9 : 12) + '\" inputmode=\"text\" aria-describedby=\"cred-hint' + (errorMsg ? ' cred-err' : '') + '\"' +\n        (errorMsg ? ' aria-invalid=\"true\"' : '') + ' value=\"' + esc(isToken ? formatToken(S.tokenPrefill) : '') + '\">' +\n        '<p class=\"hint\" id=\"cred-hint\">' + esc(help) + '</p>' +\n        (errorMsg ? '<p class=\"error\" id=\"cred-err\">' + icon('circle-alert') + ' ' + esc(errorMsg) + '</p>' : '') +\n        '</div>' +\n        '<button type=\"submit\" class=\"btn primary block\" id=\"auth-btn\">확인' + icon('arrow-right') + '</button>' +\n        '<button type=\"button\" class=\"btn ghost block\" data-act=\"to-intro\">' + icon('arrow-left') + '처음으로</button>' +\n        '</form>',\n        '#cred'\n      );\n      var input = $('#cred');\n      if (isToken) {\n        input.addEventListener('input', function () {\n          var pos = input.value.length;\n          input.value = formatToken(input.value);\n          if (pos >= input.value.length) input.setSelectionRange(input.value.length, input.value.length);\n        });\n      }\n      $('#auth-form').addEventListener('submit', function (e) {\n        e.preventDefault();\n        var v = input.value.trim();\n        if (!v) { renderAuth(label + '을(를) 입력하세요.'); return; }\n        verify(v, $('#auth-btn'));\n      });\n    }\n\n    function formatToken(v) {\n      var s = String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);\n      return s.length > 4 ? s.slice(0, 4) + '-' + s.slice(4) : s;\n    }\n\n    function verify(cred, btn, resumeStep) {\n      var restore = CES.busyButton(btn, '확인 중…');\n      return CES.call('verifyAccess', [S.courseId, cred]).then(function (res) {\n        restore();\n        if (!res.ok) {\n          var msgs = {\n            BAD_CODE: '접속코드가 올바르지 않습니다. 다시 확인해 주세요.',\n            TOKEN_INVALID: '유효하지 않은 토큰입니다. 8자리 문자를 다시 확인해 주세요.'\n          };\n          if (res.code === 'TOKEN_USED') { CES.store.remove(DRAFT_KEY); return notice('TOKEN_USED'); }\n          if (res.code === 'CLOSED') return notice('CLOSED');\n          if (res.code === 'NOT_STARTED') return notice('NOT_STARTED');\n          if (msgs[res.code]) { CES.store.remove(DRAFT_KEY); return renderAuth(msgs[res.code]); }\n          return notice('ERROR', { retry: true });\n        }\n        S.cred = cred;\n        S.items = res.items || [];\n        S.labels = res.likertLabels || S.labels;\n        if (resumeStep != null) {\n          buildSteps();\n          S.step = Math.min(resumeStep, S.steps.length);\n          if (S.step >= S.steps.length) renderReview(); else renderSurvey();\n          CES.toast('임시 저장된 응답을 불러왔습니다.');\n        } else {\n          renderConsent();\n        }\n      });\n    }\n\n    function resumeDraft(d) {\n      S.answers = d.answers || {};\n      S.nonce = d.nonce || '';\n      verify(d.cred || '', null, d.step || 0);\n    }\n\n    /* ───── 3. 익명성 안내 ───── */\n    function renderConsent() {\n      var minN = S.course.min_responses || 5;\n      var rows = [\n        ['user-x', '학번·이름·이메일을 수집하지 않습니다', '로그인 없이 응답하며, 응답자를 식별하는 정보는 저장하지 않습니다.'],\n        ['clock', '제출 시각을 따로 저장하지 않습니다', '제출 날짜만 기록되며 IP·기기 정보도 수집하지 않습니다.'],\n        ['users', minN + '명 이상 응답한 경우에만 결과가 집계됩니다', '교수님은 통계(평균·분포)와 무작위 순서의 서술형 의견만 볼 수 있습니다.'],\n        ['shield-check', '성적과 무관합니다', '공식 강의평가를 대체하지 않는 수업 개선(CQI)용 설문입니다.']\n      ];\n      render(\n        '<section class=\"card pad-lg stack-lg rise\" aria-labelledby=\"ct2\">' +\n        '<div><p class=\"muted small\">시작하기 전에</p><h1 id=\"ct2\">익명으로 응답합니다</h1></div>' +\n        '<ul class=\"feature-list\">' + rows.map(function (r, i) {\n          return '<li class=\"rise\" style=\"--i:' + (i + 1) + '\"><span class=\"ico\">' + icon(r[0]) + '</span><div><strong>' + esc(r[1]) + '</strong><p class=\"small muted\">' + esc(r[2]) + '</p></div></li>';\n        }).join('') + '</ul>' +\n        '<div class=\"callout info\">' + icon('smartphone') +\n        '<p class=\"small\">휴대폰에서는 한 화면에 한 문항씩 나오며, 점수를 고르면 다음 문항으로 자동 이동합니다. 키보드 숫자 <span class=\"kbd\">1</span>~<span class=\"kbd\">5</span>로도 고를 수 있습니다. 응답 중 내용은 이 브라우저 탭에 임시 저장됩니다.</p></div>' +\n        '<button type=\"button\" class=\"btn primary block\" data-act=\"begin\">동의하고 시작' + icon('arrow-right') + '</button>' +\n        '</section>'\n      );\n    }\n\n    /* ───── 4. 설문 ───── */\n    function isDesktop() {\n      return !!(window.matchMedia && window.matchMedia('(min-width: 768px)').matches);\n    }\n\n    function buildSteps() {\n      S.mode = isDesktop() ? 'desktop' : 'mobile';\n      S.steps = [];\n      if (S.mode === 'mobile') {\n        S.items.forEach(function (it) { S.steps.push([it]); });\n      } else {\n        S.items.forEach(function (it) {\n          var last = S.steps[S.steps.length - 1];\n          if (last && last[0].domain === it.domain) last.push(it); else S.steps.push([it]);\n        });\n      }\n    }\n\n    function stepOfItem(itemId) {\n      for (var i = 0; i < S.steps.length; i++) {\n        if (S.steps[i].some(function (it) { return it.item_id === itemId; })) return i;\n      }\n      return 0;\n    }\n\n    function isAnswered(it) {\n      var v = S.answers[it.item_id];\n      if (it.type === 'multi') return Array.isArray(v) && v.length > 0;\n      if (it.type === 'text') return typeof v === 'string' && v.trim() !== '';\n      if (it.type === 'select') return typeof v === 'string' && v !== '';\n      return v != null && v !== '';\n    }\n\n    function answeredCount() {\n      return S.items.filter(isAnswered).length;\n    }\n\n    function saveDraft() {\n      CES.store.set(DRAFT_KEY, { v: 1, cred: S.cred, answers: S.answers, step: S.step, nonce: S.nonce });\n    }\n\n    function questionHtml(it) {\n      var qid = 'q-' + it.item_id;\n      var req = it.required ? '<span class=\"req\" aria-hidden=\"true\">*</span><span class=\"sr-only\">(필수)</span>' : '<span class=\"small muted\"> (선택)</span>';\n      var head = domainTag(it.domain) + '<h2 class=\"q-text\" id=\"' + qid + '\" tabindex=\"-1\">' + esc(it.text) + req + '</h2>';\n      var body = '';\n      var v = S.answers[it.item_id];\n      if (it.type === 'likert5') {\n        var focusIdx = v ? Number(v) - 1 : 0;\n        body = '<div class=\"likert\" role=\"radiogroup\" aria-labelledby=\"' + qid + '\" aria-required=\"' + it.required + '\" data-kind=\"likert\">' +\n          [1, 2, 3, 4, 5].map(function (n, i) {\n            var on = Number(v) === n;\n            return '<button type=\"button\" class=\"chip has-emo\" role=\"radio\" aria-checked=\"' + on + '\" tabindex=\"' + (i === focusIdx ? 0 : -1) + '\"' +\n              ' data-val=\"' + n + '\" aria-label=\"' + n + '점, ' + esc(S.labels[i]) + '\"><span class=\"emo\" aria-hidden=\"true\">' + EMO[i] + '</span><span class=\"n\" aria-hidden=\"true\">' + n + '</span>' +\n              '<span class=\"l\" aria-hidden=\"true\">' + SHORT[i] + '</span></button>';\n          }).join('') + '</div>' +\n          '<div class=\"likert-scale\" aria-hidden=\"true\"><span>' + esc(S.labels[0]) + '</span><span>' + esc(S.labels[4]) + '</span></div>';\n      } else if (it.type === 'select') {\n        body = '<label class=\"sr-only\" for=\"s-' + it.item_id + '\">' + esc(it.text) + '</label>' +\n          '<select class=\"select lg\" id=\"s-' + it.item_id + '\" data-select=\"' + esc(it.item_id) + '\">' +\n          '<option value=\"\">' + (it.required ? '선택하세요' : '선택하지 않음') + '</option>' +\n          it.options.map(function (o) { return '<option value=\"' + esc(o) + '\"' + (v === o ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') +\n          '</select>' + (it.required ? '' : '<p class=\"hint small muted\" style=\"margin-top:8px\">응답하지 않아도 됩니다. 응답자가 적은 집단은 결과에서 자동으로 숨겨집니다.</p>');\n      } else if (it.type === 'single' || it.type === 'multi') {\n        var multi = it.type === 'multi';\n        var sel = multi ? (Array.isArray(v) ? v : []) : [v];\n        body = '<div class=\"option-list\" role=\"' + (multi ? 'group' : 'radiogroup') + '\" aria-labelledby=\"' + qid + '\" data-kind=\"' + it.type + '\">' +\n          it.options.map(function (o, i) {\n            var on = sel.indexOf(o) >= 0;\n            return '<button type=\"button\" class=\"option' + (multi ? ' multi' : '') + '\" role=\"' + (multi ? 'checkbox' : 'radio') + '\"' +\n              ' aria-checked=\"' + on + '\" data-opt=\"' + i + '\"><span class=\"mark\" aria-hidden=\"true\"></span><span>' + esc(o) + '</span></button>';\n          }).join('') + '</div>' + (multi ? '<p class=\"hint small muted\" style=\"margin-top:8px\">해당하는 것을 모두 고르세요.</p>' : '');\n      } else {\n        var len = (v || '').length;\n        body = '<label class=\"sr-only\" for=\"t-' + it.item_id + '\">' + esc(it.text) + '</label>' +\n          '<textarea class=\"textarea\" id=\"t-' + it.item_id + '\" data-text=\"' + it.item_id + '\" maxlength=\"1000\" rows=\"5\"' +\n          ' aria-describedby=\"c-' + it.item_id + '\" placeholder=\"자유롭게 적어 주세요. 이름·학번 등 개인정보는 쓰지 마세요.\">' + esc(v || '') + '</textarea>' +\n          '<div class=\"counter\" id=\"c-' + it.item_id + '\" aria-live=\"off\"><span class=\"num\">' + len + '</span> / 1,000자</div>';\n      }\n      return '<section class=\"card q-card\" data-item=\"' + esc(it.item_id) + '\" aria-labelledby=\"' + qid + '\">' + head + body +\n        '<p class=\"q-error hidden\" id=\"e-' + it.item_id + '\" role=\"alert\"></p></section>';\n    }\n\n    function renderSurvey(focusItemId) {\n      var total = S.steps.length;\n      var group = S.steps[S.step];\n      var pct = Math.round((S.step + 1) / (total + 1) * 100);\n      var label = S.mode === 'mobile' ? '문항' : '영역';\n      var isLast = S.step === total - 1;\n      var prevPct = Math.round(S.step / (total + 1) * 100);\n      var cheer = '';\n      CHEERS.forEach(function (c) {\n        if (!cheer && (S.step + 1) / total >= c[0] && !S.cheered[c[0]] && S.dir > 0) { S.cheered[c[0]] = true; cheer = c[1]; }\n      });\n      render(\n        '<div class=\"survey-head\">' +\n        '<div class=\"row-between small\" style=\"margin-bottom:8px\"><span class=\"muted\">' + esc(S.course.course_name) + '</span>' +\n        '<span class=\"num\"><strong>' + (S.step + 1) + '</strong> / ' + total + ' ' + label + '</span></div>' +\n        '<div class=\"progress-wrap\"><div class=\"progress\" role=\"progressbar\" aria-label=\"설문 진행률\" aria-valuemin=\"0\" aria-valuemax=\"100\" aria-valuenow=\"' + pct + '\"' +\n        ' aria-valuetext=\"' + total + '개 ' + label + ' 중 ' + (S.step + 1) + '번째\"><span style=\"width:' + prevPct + '%\"></span></div>' +\n        '<span class=\"progress-marker\" aria-hidden=\"true\" style=\"left:' + prevPct + '%\">' + (pct >= 80 ? '🏁' : '✏️') + '</span></div>' +\n        '</div>' +\n        (cheer ? '<p class=\"cheer\" role=\"status\">' + esc(cheer) + '</p>' : '') +\n        '<div id=\"questions\" class=\"' + (S.dir > 0 ? 'slide-in-r' : 'slide-in-l') + '\">' + group.map(questionHtml).join('') + '</div>' +\n        '<div class=\"nav-bar\">' +\n        '<button type=\"button\" class=\"btn\" data-act=\"prev\">' + icon('arrow-left') + (S.step === 0 ? '안내' : '이전') + '</button>' +\n        '<button type=\"button\" class=\"btn primary\" data-act=\"next\">' + (isLast ? '검토하기' : '다음') + icon(isLast ? 'list-checks' : 'arrow-right') + '</button>' +\n        '</div>' +\n        '<p class=\"tiny muted center\">응답 <span class=\"num\">' + answeredCount() + '/' + S.items.length + '</span> · 임시 저장됨</p>',\n        focusItemId ? '#q-' + cssEsc(focusItemId) : '.q-text'\n      );\n      // 진행 바 부드러운 이동\n      requestAnimationFrame(function () {\n        var bar = $('.progress > span');\n        if (bar) bar.style.width = pct + '%';\n        var mk = $('.progress-marker');\n        if (mk) mk.style.left = pct + '%';\n      });\n      CES.announce(total + '개 ' + label + ' 중 ' + (S.step + 1) + '번째. ' + group[0].domain);\n    }\n\n    function cssEsc(s) { return (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/[^\\w-]/g, '\\\\$&'); }\n\n    function setLikert(section, val, fromKey) {\n      var id = section.getAttribute('data-item');\n      var it = itemById(id);\n      var wasEmpty = !isAnswered(it);\n      S.answers[id] = val;\n      $$('.chip', section).forEach(function (b) {\n        var on = Number(b.getAttribute('data-val')) === val;\n        b.setAttribute('aria-checked', on);\n        b.tabIndex = on ? 0 : -1;\n        b.classList.remove('pop');\n        if (on) { void b.offsetWidth; b.classList.add('pop'); if (fromKey !== 'mouse') b.focus(); }\n      });\n      clearError(section);\n      saveDraft();\n      updateCount();\n      if (S.mode === 'mobile' && wasEmpty && S.steps[S.step].length === 1) {\n        setTimeout(function () {\n          if (S.steps[S.step] && S.steps[S.step][0].item_id === id && !S.submitting) next();\n        }, 280);\n      }\n    }\n\n    function itemById(id) {\n      return S.items.filter(function (x) { return x.item_id === id; })[0];\n    }\n\n    function updateCount() {\n      var el = $('.nav-bar + p .num');\n      if (el) el.textContent = answeredCount() + '/' + S.items.length;\n    }\n\n    function clearError(section) {\n      section.classList.remove('invalid');\n      var e = $('.q-error', section);\n      if (e) { e.classList.add('hidden'); e.textContent = ''; }\n    }\n\n    function validateStep() {\n      var firstBad = null;\n      S.steps[S.step].forEach(function (it) {\n        var sec = $('[data-item=\"' + cssEsc(it.item_id) + '\"]', app);\n        if (it.required && !isAnswered(it)) {\n          sec.classList.add('invalid');\n          var e = $('.q-error', sec);\n          e.textContent = '이 문항은 필수입니다. 응답을 선택해 주세요.';\n          e.classList.remove('hidden');\n          if (!firstBad) firstBad = sec;\n        }\n      });\n      if (firstBad) {\n        var focusEl = $('[aria-checked=\"true\"], .chip, .option, textarea, select', firstBad) || firstBad;\n        firstBad.scrollIntoView({ block: 'center', behavior: CES.reducedMotion() ? 'auto' : 'smooth' });\n        focusEl.focus({ preventScroll: true });\n        return false;\n      }\n      return true;\n    }\n\n    function next() {\n      if (!validateStep()) return;\n      S.dir = 1;\n      if (S.step < S.steps.length - 1) {\n        S.step++;\n        saveDraft();\n        renderSurvey();\n      } else {\n        S.step = S.steps.length;\n        saveDraft();\n        renderReview();\n      }\n    }\n\n    function prev() {\n      if (S.step === 0) { renderConsent(); return; }\n      S.dir = -1;\n      S.step--;\n      saveDraft();\n      renderSurvey();\n    }\n\n    /* ───── 5. 검토 ───── */\n    function answerLabel(it) {\n      var v = S.answers[it.item_id];\n      if (!isAnswered(it)) return null;\n      if (it.type === 'likert5') return v + ' · ' + S.labels[v - 1];\n      if (it.type === 'multi') return v.join(', ');\n      return String(v);\n    }\n\n    function renderReview(errorIds) {\n      var missing = S.items.filter(function (it) { return it.required && !isAnswered(it); });\n      var groups = [];\n      S.items.forEach(function (it) {\n        var g = groups[groups.length - 1];\n        if (g && g.domain === it.domain) g.items.push(it); else groups.push({ domain: it.domain, items: [it] });\n      });\n      render(\n        '<div class=\"survey-head\">' +\n        '<div class=\"row-between small\" style=\"margin-bottom:8px\"><span class=\"muted\">' + esc(S.course.course_name) + '</span><span>제출 전 검토</span></div>' +\n        '<div class=\"progress\" role=\"progressbar\" aria-label=\"설문 진행률\" aria-valuemin=\"0\" aria-valuemax=\"100\" aria-valuenow=\"100\"><span style=\"width:100%\"></span></div>' +\n        '</div>' +\n        '<div class=\"stack\">' +\n        '<div><h1 id=\"rv\">응답을 확인해 주세요</h1><p class=\"muted small\" style=\"margin-top:4px\">수정하려면 문항 옆의 [수정]을 누르세요.</p></div>' +\n        (missing.length ? '<div class=\"callout\" role=\"alert\">' + icon('circle-alert') + '<p class=\"small\"><strong>필수 문항 ' + missing.length + '개</strong>에 응답하지 않았습니다.</p></div>' : '') +\n        groups.map(function (g, gi) {\n          return '<section class=\"card rise\" style=\"--i:' + gi + '\">' + domainTag(g.domain) + '<ul class=\"review-list\">' +\n            g.items.map(function (it) {\n              var a = answerLabel(it);\n              var miss = it.required && a == null;\n              return '<li><div class=\"grow small\">' + esc(it.text) + '</div>' +\n                '<div class=\"ans small' + (miss ? ' missing' : '') + (it.type === 'text' && a ? ' text' : '') + '\">' +\n                (a == null ? (miss ? '응답 필요' : '—') : esc(a.length > 80 ? a.slice(0, 80) + '…' : a)) + '</div>' +\n                '<button type=\"button\" class=\"btn ghost sm\" data-goto=\"' + esc(it.item_id) + '\" aria-label=\"' + esc(it.text) + ' 수정\">수정</button></li>';\n            }).join('') + '</ul></section>';\n        }).join('') +\n        '</div>' +\n        '<div class=\"nav-bar\">' +\n        '<button type=\"button\" class=\"btn\" data-act=\"back-to-survey\">' + icon('arrow-left') + '이전</button>' +\n        '<button type=\"button\" class=\"btn primary\" data-act=\"submit\" id=\"submit-btn\"' + (missing.length ? ' aria-disabled=\"true\"' : '') + '>' +\n        icon('send') + '제출하기</button>' +\n        '</div>',\n        '#rv'\n      );\n      CES.announce('제출 전 검토 화면입니다.' + (missing.length ? ' 필수 문항 ' + missing.length + '개가 남아 있습니다.' : ''));\n    }\n\n    function submit() {\n      if (S.submitting) return;\n      var missing = S.items.filter(function (it) { return it.required && !isAnswered(it); });\n      if (missing.length) {\n        S.step = stepOfItem(missing[0].item_id);\n        renderSurvey(missing[0].item_id);\n        validateStep();\n        return;\n      }\n      if (!S.nonce) { S.nonce = CES.uuid(); saveDraft(); }\n      S.submitting = true;\n      var btn = $('#submit-btn');\n      var restore = CES.busyButton(btn, '제출 중…');\n      CES.call('submitResponse', [S.courseId, S.cred, S.answers, S.nonce], {\n        retries: 4,\n        onRetry: function (n, max) {\n          var span = btn && btn.querySelector('span:last-child');\n          if (span) span.textContent = '요청이 많아 다시 시도 중… (' + n + '/' + max + ')';\n        }\n      }).then(function (res) {\n        S.submitting = false;\n        if (res.ok) {\n          CES.store.remove(DRAFT_KEY);\n          CES.store.set(DONE_KEY, new Date().toISOString().slice(0, 10), window.localStorage);\n          return renderThanks();\n        }\n        restore();\n        if (res.code === 'TOKEN_USED') { CES.store.remove(DRAFT_KEY); return notice('TOKEN_USED'); }\n        if (res.code === 'CLOSED') return notice('CLOSED');\n        if (res.code === 'MISSING') {\n          var id = (res.missing || [])[0];\n          S.step = stepOfItem(id);\n          renderSurvey(id);\n          validateStep();\n          return;\n        }\n        if (res.code === 'BAD_CODE' || res.code === 'TOKEN_INVALID') {\n          CES.store.remove(DRAFT_KEY);\n          return renderAuth('접속 정보가 유효하지 않습니다. 다시 입력해 주세요.');\n        }\n        CES.toast(CES.errorText(res) + ' 응답 내용은 임시 저장되어 있습니다.', 'error');\n      });\n    }\n\n    /* ───── 6. 감사 ───── */\n    function renderThanks() {\n      render(\n        '<section class=\"card pad-lg center stack-lg rise\" aria-labelledby=\"th\">' +\n        '<svg class=\"check-draw\" viewBox=\"0 0 100 100\" aria-hidden=\"true\"><circle cx=\"50\" cy=\"50\" r=\"45\"/><path d=\"M30 52 l14 14 l27 -30\"/></svg>' +\n        '<div><h1 id=\"th\">응답이 제출되었습니다</h1><p class=\"muted\" style=\"margin-top:8px\">소중한 의견 감사합니다 🙏<br>여러분의 목소리로 다음 수업이 더 좋아집니다.</p></div>' +\n        '<div class=\"stickers\" aria-hidden=\"true\"><div class=\"sticker\" style=\"--i:0\"><span class=\"emo\">📚</span>더 나은 수업</div>' +\n        '<div class=\"sticker\" style=\"--i:1\"><span class=\"emo\">🩺</span>좋은 간호사</div><div class=\"sticker\" style=\"--i:2\"><span class=\"emo\">💜</span>고마워요</div></div>' +\n        '<div class=\"callout info\" style=\"text-align:left\">' + icon('shield-check') + '<p class=\"small\">응답은 익명으로 저장되었습니다. 이제 이 창을 닫으셔도 됩니다.</p></div>' +\n        '</section>'\n      );\n      CES.announce('응답이 제출되었습니다. 감사합니다.');\n      setTimeout(CES.confetti, 150);\n      setTimeout(CES.confetti, 900);\n    }\n\n    /* ───── 이벤트 ───── */\n    app.addEventListener('click', function (e) {\n      var t = e.target.closest('button');\n      if (!t) return;\n      var act = t.getAttribute('data-act');\n      if (act === 'reload') return start();\n      if (act === 'to-auth') return renderAuth();\n      if (act === 'other-code') { CES.store.remove(ACTIVE_KEY); S.courseId = ''; S.course = null; S.autoCred = ''; S.tokenPrefill = ''; renderCodeEntry(); return; }\n      if (act === 'to-intro') return renderIntro();\n      if (act === 'begin') { buildSteps(); S.step = 0; saveDraft(); return renderSurvey(); }\n      if (act === 'next') return next();\n      if (act === 'prev') return prev();\n      if (act === 'back-to-survey') { S.step = S.steps.length - 1; return renderSurvey(); }\n      if (act === 'submit') return submit();\n      var go = t.getAttribute('data-goto');\n      if (go) { S.step = stepOfItem(go); return renderSurvey(go); }\n\n      var section = t.closest('.q-card');\n      if (!section) return;\n      if (t.classList.contains('chip')) return setLikert(section, Number(t.getAttribute('data-val')), e.detail === 0 ? 'key' : 'mouse');\n      if (t.classList.contains('option')) {\n        var it = itemById(section.getAttribute('data-item'));\n        var opt = it.options[Number(t.getAttribute('data-opt'))];\n        if (it.type === 'single') {\n          S.answers[it.item_id] = opt;\n          $$('.option', section).forEach(function (b) { b.setAttribute('aria-checked', b === t); });\n        } else {\n          var cur = Array.isArray(S.answers[it.item_id]) ? S.answers[it.item_id].slice() : [];\n          var i = cur.indexOf(opt);\n          if (i >= 0) cur.splice(i, 1); else cur.push(opt);\n          S.answers[it.item_id] = cur;\n          t.setAttribute('aria-checked', i < 0);\n        }\n        clearError(section);\n        saveDraft();\n        updateCount();\n      }\n    });\n\n    app.addEventListener('change', function (e) {\n      var sel = e.target.closest('select[data-select]');\n      if (!sel) return;\n      S.answers[sel.getAttribute('data-select')] = sel.value;\n      clearError(sel.closest('.q-card'));\n      saveDraft();\n      updateCount();\n    });\n\n    app.addEventListener('input', function (e) {\n      var ta = e.target.closest('textarea[data-text]');\n      if (!ta) return;\n      var id = ta.getAttribute('data-text');\n      S.answers[id] = ta.value.slice(0, 1000);\n      var c = $('#c-' + cssEsc(id) + ' .num');\n      if (c) c.textContent = ta.value.length.toLocaleString('ko-KR');\n      clearError(ta.closest('.q-card'));\n      saveDraft();\n      updateCount();\n    });\n\n    document.addEventListener('keydown', function (e) {\n      if (e.altKey || e.ctrlKey || e.metaKey) return;\n      var tag = (e.target.tagName || '').toLowerCase();\n      if (tag === 'textarea' || tag === 'input' || tag === 'select') return;\n      if (!$('#questions')) return;\n\n      // 리커트 그룹 내 화살표 이동(라디오 그룹 표준 동작)\n      var chip = e.target.closest && e.target.closest('.chip');\n      if (chip && /^Arrow(Left|Right|Up|Down)$/.test(e.key)) {\n        e.preventDefault();\n        var cur = Number(chip.getAttribute('data-val'));\n        var nv = /Left|Up/.test(e.key) ? Math.max(1, cur - 1) : Math.min(5, cur + 1);\n        setLikert(chip.closest('.q-card'), nv, 'key');\n        return;\n      }\n      // 숫자 1~5: 포커스된 문항, 없으면 현재 화면의 첫 미응답 리커트 문항\n      if (/^[1-5]$/.test(e.key)) {\n        var section = e.target.closest && e.target.closest('.q-card');\n        if (!section || !$('.likert', section)) {\n          var cards = $$('#questions .q-card').filter(function (c) { return $('.likert', c); });\n          section = cards.filter(function (c) { return !isAnswered(itemById(c.getAttribute('data-item'))); })[0] || cards[0];\n        }\n        if (section) { e.preventDefault(); setLikert(section, Number(e.key), 'key'); }\n      }\n    });\n\n    var resizeTimer;\n    window.addEventListener('resize', function () {\n      clearTimeout(resizeTimer);\n      resizeTimer = setTimeout(function () {\n        if (!$('#questions') || !S.items.length) return;\n        var mode = isDesktop() ? 'desktop' : 'mobile';\n        if (mode === S.mode) return;\n        var anchor = S.steps[S.step][0].item_id;\n        buildSteps();\n        S.step = stepOfItem(anchor);\n        saveDraft();\n        renderSurvey();\n      }, 200);\n    });\n\n    start();\n  })();\n  </script>\n</body>\n</html>\n",
 "Admin": "<!DOCTYPE html>\n<html lang=\"ko\">\n<head>\n  <base target=\"_top\">\n  <meta charset=\"utf-8\">\n  <meta name=\"color-scheme\" content=\"light dark\">\n  <link rel=\"preconnect\" href=\"https://cdn.jsdelivr.net\" crossorigin>\n  <link rel=\"stylesheet\" href=\"https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css\">\n  <?!= include('Styles'); ?>\n</head>\n<body class=\"page-admin\">\n  <a class=\"skip-link\" href=\"#main\">본문 바로가기</a>\n  <div class=\"deco\" aria-hidden=\"true\"><span class=\"s1\"></span><span class=\"s2\"></span><span class=\"s3\"></span><span class=\"s4\"></span></div>\n\n  <header class=\"topbar\">\n    <div class=\"topbar-inner\">\n      <div class=\"brand\">\n        <span class=\"brand-mark\"><i data-lucide=\"clipboard-check\" aria-hidden=\"true\"></i></span>\n        <span>강의평가 Studio<small>교수자 관리</small></span>\n      </div>\n      <div class=\"grow\"></div>\n      <button type=\"button\" class=\"btn ghost sm hidden\" id=\"logout-btn\"><i data-lucide=\"log-out\" aria-hidden=\"true\"></i><span>로그아웃</span></button>\n    </div>\n  </header>\n\n  <main id=\"main\" class=\"wrap\" tabindex=\"-1\">\n    <nav class=\"tabs hidden\" id=\"tabs\" role=\"tablist\" aria-label=\"관리 메뉴\" style=\"margin-bottom:20px\"></nav>\n    <div id=\"view\" role=\"tabpanel\" aria-live=\"off\">\n      <div class=\"skeleton\" aria-hidden=\"true\"></div>\n    </div>\n  </main>\n\n  <div id=\"sr-status\" class=\"sr-only\" role=\"status\" aria-live=\"polite\"></div>\n  <div id=\"print-area\" aria-hidden=\"true\"></div>\n\n  <footer class=\"footer\">\n    <div class=\"credit\">Developed by 정종필 교수 · 청암대학교 간호학과</div>\n    <p class=\"disclaimer\">강의평가 Studio는 학교 공식 강의평가를 대체하지 않는 교수자 자율형 형성평가·CQI(지속적 질 개선)용 설문 도구입니다.</p>\n  </footer>\n\n  <script src=\"https://cdn.jsdelivr.net/npm/lucide@0.460.0/dist/umd/lucide.min.js\" defer onload=\"window.CES && CES.icons()\"></script>\n  <script src=\"https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js\" defer></script>\n  <?!= include('Manual'); ?>\n  <?!= include('Scripts'); ?>\n  <script>\n  (function () {\n    'use strict';\n    const { $, $$, esc, icon } = CES;\n    const view = document.getElementById('view');\n    const tabsEl = document.getElementById('tabs');\n    const SESSION_KEY = 'ces:admin';\n    const DOMAINS = ['A. 강의 설계', 'B. 교수학습방법', 'C. 평가 및 과제', 'D. 학습성과(CLO)', 'E. 학습 환경', 'F. 디지털·AI 활용', 'G. 종합', 'H. 온라인(비대면) 강의', 'I. 실무 적용', '서술형'];\n    const TYPES = { likert5: '5점 리커트', single: '단일 선택', multi: '복수 선택', select: '드롭다운', text: '서술형' };\n    const SEMS = ['1', '2'];\n    const GRADES = [1, 2, 3, 4];\n    const DELIVERY = ['대면', '온라인(비대면)', '혼합'];\n    const COURSE_TYPES = ['이론', '실습', '이론+실습'];\n    const SCOPES = { '': '항상 표시', online: '온라인(비대면)·혼합 수업만', theory: '이론 있는 교과목만', practice: '실습 있는 교과목만' };\n    /** 서버 scopeVisible_과 같은 규칙: 문항이 이 교과목에서 보이는지 */\n    const scopeVisible = (scope, c) => !scope || !c ||\n      (scope === 'online' ? c.delivery_mode !== '대면' : scope === 'theory' ? c.course_type !== '실습' : scope === 'practice' ? c.course_type !== '이론' : true);\n    const TABS = [\n      ['dashboard', 'layout-dashboard', '대시보드'],\n      ['courses', 'book-open', '교과목'],\n      ['items', 'list-checks', '문항'],\n      ['results', 'chart-column', '결과'],\n      ['settings', 'settings', '설정'],\n      ['manual', 'book-open-text', '사용 매뉴얼']\n    ];\n\n    const A = {\n      session: (CES.store.get(SESSION_KEY) || {}).s || '',\n      data: null,\n      tab: 'dashboard',\n      itemsCourse: '',\n      items: [],\n      itemsLocked: false,\n      itemsDirty: false,\n      resultsCourse: '',\n      results: null,\n      charts: [],\n      wcKey: 'all',\n      wcWord: null\n    };\n\n    /* ───── 서버 호출(세션 자동 첨부, 만료 시 로그인 화면) ───── */\n    async function api(fn, args, opts) {\n      const res = await CES.call(fn, [A.session].concat(args || []), opts);\n      if (!res.ok && res.code === 'AUTH') {\n        CES.toast('로그인이 만료되었습니다. 다시 로그인하세요.', 'error');\n        signOut(true);\n      }\n      return res;\n    }\n\n    function fail(res) {\n      if (res.code === 'AUTH') return;\n      CES.toast(CES.errorText(res), 'error');\n    }\n\n    /* ───── 공통 표시 도우미 ───── */\n    const courseById = (id) => (A.data ? A.data.courses.find((c) => c.course_id === id) : null);\n    const dt = (s) => (s ? s.replace('T', ' ').replace(/-/g, '.') : '');\n    const term = (c) => `${c.year}-${c.semester}학기`;\n    const termFull = (c) => [term(c), c.grade ? c.grade + '학년' : '', c.section ? c.section + '반' : '', c.delivery_mode && c.delivery_mode !== '대면' ? c.delivery_mode : ''].filter(Boolean).join(' · ');\n    const selectHtml = (name, id, list, value, fmtLabel) => `<select class=\"select\" id=\"${id}\" name=\"${name}\">${list.map((v) =>\n      `<option value=\"${esc(v)}\"${String(v) === String(value) ? ' selected' : ''}>${esc(fmtLabel ? fmtLabel(v) : v)}</option>`).join('')}</select>`;\n    const fmt = (n, d) => CES.fmt(n, d);\n\n    function statusBadge(c) {\n      if (c.status === '진행') return `<span class=\"badge open\">${icon('circle-dot')}진행 중</span>`;\n      if (c.status === '준비') return `<span class=\"badge ready\">${icon('clock')}시작 전</span>`;\n      return `<span class=\"badge closed\">${icon('lock')}${c.manual_close ? '수동 마감' : '마감'}</span>`;\n    }\n\n    function estMinutes(items) {\n      let sec = 0;\n      items.forEach((it) => { sec += it.type === 'text' ? 35 : it.type === 'likert5' ? 7 : 10; });\n      return Math.max(1, Math.round(sec / 60));\n    }\n\n    function setView(html, focusHeading) {\n      destroyCharts();\n      view.innerHTML = html;\n      // 화면 전환 등장 효과(모션 최소화 설정이면 CSS에서 끔)\n      view.classList.remove('view-enter');\n      void view.offsetWidth;\n      view.classList.add('view-enter');\n      CES.icons();\n      if (focusHeading) {\n        const h = $('h1', view);\n        if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }\n      }\n    }\n\n    function destroyCharts() {\n      A.charts.forEach((c) => { try { c.destroy(); } catch (e) { /* 무시 */ } });\n      A.charts = [];\n    }\n\n    function cssVar(name) {\n      return getComputedStyle(document.documentElement).getPropertyValue(name).trim();\n    }\n\n    /* ───── 로그인 ───── */\n    function renderLogin(message, lockedSec) {\n      tabsEl.classList.add('hidden');\n      $('#logout-btn').classList.add('hidden');\n      setView(`\n        <div style=\"max-width:420px;margin:24px auto 0\">\n          <form class=\"card pad-lg stack-lg\" id=\"login-form\" novalidate aria-labelledby=\"lt\">\n            <div class=\"notice-icon\">${icon('lock-keyhole')}</div>\n            <div class=\"center\"><h1 id=\"lt\">교수자 로그인</h1>\n              <p class=\"muted small\" style=\"margin-top:6px\">관리자 PIN을 입력하세요.</p></div>\n            <div class=\"field\">\n              <label for=\"pin\">관리자 PIN</label>\n              <input id=\"pin\" class=\"input code\" type=\"password\" inputmode=\"numeric\" autocomplete=\"current-password\"\n                maxlength=\"12\" aria-describedby=\"pin-hint${message ? ' pin-err' : ''}\" ${message ? 'aria-invalid=\"true\"' : ''} ${lockedSec ? 'disabled' : ''}>\n              <p class=\"hint\" id=\"pin-hint\">숫자 6~12자리 · 5회 틀리면 10분간 잠깁니다.</p>\n              ${message ? `<p class=\"error\" id=\"pin-err\" role=\"alert\">${icon('circle-alert')} ${esc(message)}</p>` : ''}\n            </div>\n            <button type=\"submit\" class=\"btn primary block\" id=\"login-btn\" ${lockedSec ? 'disabled' : ''}>로그인${icon('arrow-right')}</button>\n            <p class=\"tiny muted center\">PIN을 잊었다면 스프레드시트 메뉴 [강의평가 Studio] ▸ ② 관리자 PIN 설정·재설정에서 다시 설정하세요.</p>\n          </form>\n        </div>`);\n      const pin = $('#pin');\n      if (!lockedSec) pin.focus();\n      if (lockedSec) {\n        let left = lockedSec;\n        const tick = setInterval(() => {\n          left--;\n          const err = $('#pin-err');\n          if (!err) { clearInterval(tick); return; }\n          if (left <= 0) { clearInterval(tick); renderLogin(); return; }\n          err.textContent = `PIN 입력이 잠겼습니다. ${Math.floor(left / 60)}분 ${left % 60}초 후 다시 시도하세요.`;\n        }, 1000);\n      }\n      $('#login-form').addEventListener('submit', async (e) => {\n        e.preventDefault();\n        const v = pin.value.trim();\n        if (!/^\\d{6,12}$/.test(v)) { renderLogin('PIN은 숫자 6~12자리입니다.'); return; }\n        const restore = CES.busyButton($('#login-btn'), '확인 중…');\n        const res = await CES.call('adminLogin', [v]);\n        restore();\n        if (res.ok) {\n          A.session = res.session;\n          CES.store.set(SESSION_KEY, { s: res.session });\n          return boot();\n        }\n        if (res.code === 'WRONG') return renderLogin(`PIN이 올바르지 않습니다. (남은 시도 ${res.left}회)`);\n        if (res.code === 'LOCKED') return renderLogin(`PIN 입력이 잠겼습니다. ${Math.ceil(res.remainSec / 60)}분 후 다시 시도하세요.`, res.remainSec);\n        if (res.code === 'NO_PIN') return renderLogin('아직 PIN이 설정되지 않았습니다. 스프레드시트 메뉴 ② 관리자 PIN 설정·재설정을 먼저 실행하세요.');\n        if (res.code === 'SETUP_REQUIRED') return renderLogin('초기 설정이 필요합니다. 스프레드시트 메뉴 ① 초기 설정 실행을 먼저 하세요.');\n        renderLogin(CES.errorText(res));\n      });\n    }\n\n    async function signOut(expired) {\n      if (!expired && A.session) CES.call('adminLogout', [A.session], { silent: true });\n      A.session = '';\n      A.data = null;\n      CES.store.remove(SESSION_KEY);\n      renderLogin();\n    }\n\n    /* ───── 부트스트랩·탭 ───── */\n    async function boot(tab) {\n      if (!A.session) return renderLogin();\n      const res = await api('getAdminBootstrap');\n      if (!res.ok) {\n        if (res.code !== 'AUTH') {\n          setView(`<div class=\"card pad-lg center stack\"><div class=\"notice-icon danger\">${icon('cloud-off')}</div>\n            <h1>불러오지 못했습니다</h1><p>${esc(CES.errorText(res))}</p>\n            <div><button class=\"btn primary\" type=\"button\" data-act=\"retry-boot\">${icon('rotate-cw')}다시 시도</button></div></div>`);\n        }\n        return;\n      }\n      A.data = res;\n      $('#logout-btn').classList.remove('hidden');\n      renderTabs();\n      go(tab || A.tab || 'dashboard');\n    }\n\n    async function refresh() {\n      const res = await api('getAdminBootstrap', [], { silent: true });\n      if (res.ok) A.data = res;\n      return res.ok;\n    }\n\n    function renderTabs() {\n      tabsEl.classList.remove('hidden');\n      tabsEl.innerHTML = TABS.map(([id, ic, label]) =>\n        `<button type=\"button\" class=\"tab\" role=\"tab\" id=\"tab-${id}\" aria-controls=\"view\" data-tab=\"${id}\"\n          aria-selected=\"${A.tab === id}\" tabindex=\"${A.tab === id ? 0 : -1}\">${icon(ic)}${label}</button>`).join('');\n      CES.icons();\n    }\n\n    async function go(tab) {\n      if (A.tab === 'items' && tab !== 'items' && A.itemsDirty) {\n        const ok = await CES.confirm('저장하지 않은 변경', '문항 편집 내용이 저장되지 않았습니다. 이동하면 변경 내용이 사라집니다.', '이동', true);\n        if (!ok) return;\n        A.itemsDirty = false;\n      }\n      A.tab = tab;\n      $$('.tab', tabsEl).forEach((b) => {\n        const on = b.dataset.tab === tab;\n        b.setAttribute('aria-selected', on);\n        b.tabIndex = on ? 0 : -1;\n      });\n      view.setAttribute('aria-labelledby', 'tab-' + tab);\n      ({ dashboard: renderDashboard, courses: renderCourses, items: renderItems, results: renderResults, settings: renderSettings, manual: renderManual })[tab]();\n    }\n\n    tabsEl.addEventListener('click', (e) => {\n      const b = e.target.closest('[data-tab]');\n      if (b) go(b.dataset.tab);\n    });\n    tabsEl.addEventListener('keydown', (e) => {\n      if (!/^Arrow(Left|Right)$/.test(e.key)) return;\n      const tabs = $$('.tab', tabsEl);\n      const i = tabs.indexOf(document.activeElement);\n      const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];\n      n.focus();\n      go(n.dataset.tab);\n    });\n\n    /* ───── 대시보드 ───── */\n    function renderDashboard() {\n      const cs = A.data.courses;\n      const open = cs.filter((c) => c.status === '진행');\n      const basis = open.length ? open : cs;\n      const resp = basis.reduce((a, c) => a + c.response_count, 0);\n      // 응답률은 대상 교과목 모두에 수강인원이 있을 때만(일부만 있으면 응답이 빠진 왜곡된 비율이 되므로 응답 수로 표시)\n      const allEnrolled = basis.length > 0 && basis.every((c) => c.enrollment > 0);\n      const enroll = allEnrolled ? basis.reduce((a, c) => a + c.enrollment, 0) : 0;\n      const respE = resp;\n      const rate = enroll ? Math.round(respE / enroll * 1000) / 10 : null;\n      const withMean = cs.filter((c) => c.mean != null);\n      const wN = withMean.reduce((a, c) => a + c.response_count, 0);\n      const overall = wN ? withMean.reduce((a, c) => a + c.mean * c.response_count, 0) / wN : null;\n      const pos = wN ? withMean.reduce((a, c) => a + (c.pos_pct || 0) * c.response_count, 0) / wN : null;\n      // 평균·긍정 응답률의 기준(결과가 열린 교과목만)과 빠진 교과목을 함께 밝힘\n      const lockedWithResp = cs.filter((c) => c.mean == null && c.response_count > 0).length;\n      const basisNote = withMean.length\n        ? `결과가 열린 ${withMean.length}개 교과목(${wN}명) 기준${lockedWithResp ? ` · ${lockedWithResp}개는 잠김(공개일 전·응답 부족)이라 제외` : ''}`\n        : '결과가 열린 교과목 없음';\n      const soon = open.filter((c) => c.hours_left != null && c.hours_left <= 72).sort((a, b) => a.hours_left - b.hours_left);\n\n      setView(`\n        ${heroBanner(open, soon, cs)}\n        ${A.data.webAppUrl ? '' : `<div style=\"margin-bottom:16px\">${urlNotice()}</div>`}\n        <div class=\"bento\">\n          <section class=\"card soft rise\" style=\"--i:0\" aria-labelledby=\"d1\">\n            <div class=\"card-title\" id=\"d1\">${icon('radio')}진행 중 교과목</div>\n            <div class=\"big-num\" style=\"margin-top:12px\">${CES.count(open.length, 0)}<span class=\"unit\">개</span></div>\n            <p class=\"small muted\" style=\"margin-top:8px\">전체 ${cs.length}개 · 누적 응답 <span class=\"num\">${cs.reduce((a, c) => a + c.response_count, 0)}</span>건</p>\n          </section>\n          <section class=\"card rise kpi-ring\" style=\"--i:1\" aria-labelledby=\"d2\">\n            <div class=\"card-title\" id=\"d2\">${icon('users')}${rate == null ? '응답 수' : '응답률'}${open.length ? '' : ' (전체)'}</div>\n            ${rate == null\n              ? `<div class=\"big-num\" style=\"margin-top:12px\">${CES.count(resp, 0)}<span class=\"unit\">명</span></div><p class=\"sub\">${open.length ? '진행 중 교과목' : '전체 교과목'} 응답 합계</p>`\n              : CES.ring(rate / 100, CES.count(rate, 1) + '<small style=\"font-size:.5em\">%</small>', `${respE}/${enroll}명`, { label: `응답률 ${rate}%` })}\n          </section>\n          <section class=\"card rise kpi-ring\" style=\"--i:2\" aria-labelledby=\"d3\">\n            <div class=\"card-title\" id=\"d3\">${icon('gauge')}전체 평균</div>\n            ${CES.ring(overall == null ? 0 : (overall - 1) / 4, overall == null ? '—' : CES.count(overall, 2), '5점 만점', { label: `전체 평균 ${overall == null ? '없음' : fmt(overall)}`, tone: 'ink' })}\n            <p class=\"sub\">${esc(basisNote)}</p>\n          </section>\n          <section class=\"card rise kpi-ring\" style=\"--i:3\" aria-labelledby=\"d4\">\n            <div class=\"card-title\" id=\"d4\">${icon('smile')}긍정 응답률</div>\n            ${CES.ring(pos == null ? 0 : pos / 100, pos == null ? '—' : CES.count(pos, 0) + '<small style=\"font-size:.5em\">%</small>', '4·5점 비율', { label: `긍정 응답률 ${pos == null ? '없음' : Math.round(pos) + '%'}` })}\n            <p class=\"sub\">${esc(basisNote)}</p>\n          </section>\n\n          <section class=\"card span-4 rise\" style=\"--i:4\" aria-labelledby=\"d5\">\n            <div class=\"row-between\"><div class=\"card-title\" id=\"d5\">${icon('layout-grid')}교과목 한눈에</div><span class=\"small muted\">카드를 누르면 결과로 이동</span></div>\n            ${cs.length ? `<div class=\"bento\" style=\"grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));margin-top:12px\">${cs.map(pulseCard).join('')}</div>`\n              : `<div class=\"empty\">${icon('book-open')}<p>교과목이 없습니다.</p></div>`}\n          </section>\n\n          <section class=\"card ${soon.length ? 'butter' : ''} span-2 rise\" style=\"--i:5\" aria-labelledby=\"d6\">\n            <div class=\"card-title\" id=\"d6\" style=\"color:var(--ink)\">${icon('alarm-clock')}마감 임박 (72시간 이내)</div>\n            ${soon.length ? `<ul class=\"feature-list\" style=\"margin-top:12px\">${soon.map((c) => `\n              <li><span class=\"badge hot\"><span class=\"dot\" aria-hidden=\"true\"></span>${c.hours_left < 24 ? Math.max(0, Math.round(c.hours_left)) + '시간' : Math.round(c.hours_left / 24) + '일'} 남음</span>\n              <div class=\"grow\"><strong>${esc(c.course_name)}</strong> <span class=\"small\">${esc(termFull(c))}</span>\n              <div class=\"small num\">응답 ${c.response_count}${c.enrollment ? '/' + c.enrollment : ''}명 · 마감 ${esc(dt(c.end_at))}</div></div></li>`).join('')}</ul>`\n              : '<p class=\"small muted\" style=\"margin-top:12px\">곧 마감되는 교과목이 없습니다.</p>'}\n          </section>\n          <section class=\"card span-2 rise\" style=\"--i:6\" aria-labelledby=\"d7\">\n            <div class=\"card-title\" id=\"d7\">${icon('zap')}빠른 작업</div>\n            <div class=\"row\" style=\"margin-top:12px\">\n              <button type=\"button\" class=\"btn primary sm\" data-act=\"new-course\">${icon('plus')}새 교과목</button>\n              <button type=\"button\" class=\"btn sm\" data-go=\"items\">${icon('list-checks')}문항 편집</button>\n              <button type=\"button\" class=\"btn sm\" data-go=\"results\">${icon('chart-column')}결과 보기</button>\n            </div>\n          </section>\n        </div>`);\n      CES.animateIn(view);\n      celebrateMilestones(cs);\n    }\n\n    /** 탭 제목 앞 이모지 타일(장식) */\n    const tile = (emo) => `<span class=\"ptile\" aria-hidden=\"true\">${emo}</span>`;\n\n    /** 대시보드 환영 배너: 시간대 인사·오늘 날짜·상태 스티커·바로가기 */\n    function heroBanner(open, soon, cs) {\n      const h = Number(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Seoul' }));\n      const greet = h >= 5 && h < 11 ? '좋은 아침입니다' : h >= 11 && h < 17 ? '좋은 오후입니다' : '좋은 저녁입니다';\n      const name = (A.data.settings && A.data.settings.professor_name) || '';\n      const today = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });\n      const total = cs.reduce((a, c) => a + c.response_count, 0);\n      const todayN = cs.reduce((a, c) => a + (c.today_count || 0), 0);\n      const sub = todayN ? `오늘 새 응답 ${todayN}건이 들어왔어요. 학생들의 목소리를 확인해 보세요.`\n        : open.length ? `진행 중인 설문 ${open.length}개에서 학생들의 목소리가 모이고 있어요.` : '새 설문을 준비해 볼까요? 교과목을 만들고 접속 주소·코드를 안내하면 됩니다.';\n      return `<section class=\"hero rise\" aria-labelledby=\"hero-h\">\n          <div class=\"hero-text\">\n            <p class=\"hero-date\">${esc(today)}</p>\n            <h1 id=\"hero-h\">${greet}${name ? `, ${esc(name)} 교수님` : ''} <span class=\"wave\" aria-hidden=\"true\">👋</span></h1>\n            <p class=\"hero-sub\">${esc(sub)}</p>\n            <div class=\"row hero-actions\">\n              <button type=\"button\" class=\"btn primary sm\" data-go=\"courses\">${icon('link')}교과목·접속 주소</button>\n              <button type=\"button\" class=\"btn sm\" data-go=\"results\">${icon('chart-column')}결과 보기</button>\n            </div>\n          </div>\n          <div class=\"stickers hero-stickers\" aria-hidden=\"true\">\n            <div class=\"sticker\" style=\"--i:0\"><span class=\"emo\">📡</span><b>${open.length}</b>개 진행 중</div>\n            <div class=\"sticker${todayN ? ' is-new' : ''}\" style=\"--i:1\" data-today><span class=\"emo\">✨</span><b>${todayN}</b>건 오늘 응답</div>\n            <div class=\"sticker\" style=\"--i:2\"><span class=\"emo\">💬</span><b>${total}</b>건 누적 응답</div>\n            <div class=\"sticker\" style=\"--i:3\"><span class=\"emo\">⏰</span><b>${soon.length}</b>개 마감 임박</div>\n          </div>\n          <p class=\"sr-only\">진행 중 ${open.length}개, 오늘 새 응답 ${todayN}건, 누적 응답 ${total}건, 72시간 이내 마감 ${soon.length}개</p>\n        </section>`;\n    }\n\n    /**\n     * 목표 도달 축하: 결과 공개 기준(최소 응답 수) 도달, 수강인원이 있으면 80% 응답 도달.\n     * 교과목·목표마다 이 브라우저에서 한 번만 confetti와 알림을 보여 줍니다(모션 최소화 설정이면 confetti 생략).\n     */\n    function celebrateMilestones(cs) {\n      const minN = Number((A.data.settings || {}).min_responses) || 5;\n      const byGoal = {}; // 목표 이름 → 달성한 교과목 이름(학기·분반 포함)\n      cs.forEach((c) => {\n        const goals = [['open', minN, `결과 공개 기준(${minN}명)`]];\n        if (c.enrollment > 0) goals.push(['80', Math.ceil(c.enrollment * 0.8), '응답률 80%']);\n        goals.forEach(([id, target, label]) => {\n          if (c.response_count < target) return;\n          const key = `ces:cele:${c.course_id}:${id}`;\n          if (CES.store.get(key, window.localStorage)) return;\n          CES.store.set(key, 1, window.localStorage);\n          (byGoal[label] = byGoal[label] || []).push(`${c.course_name}(${term(c)}${c.section ? ' ' + c.section + '반' : ''})`);\n        });\n      });\n      const labels = Object.keys(byGoal);\n      if (!labels.length) return;\n      CES.confetti();\n      CES.toast('🎉 ' + labels.map((l) => {\n        const names = byGoal[l];\n        return `${l} 달성: ${names.slice(0, 2).join(', ')}${names.length > 2 ? ` 외 ${names.length - 2}개` : ''}`;\n      }).join(' / '));\n    }\n\n    function pulseCard(c) {\n      const doms = (c.domains || []);\n      const lock = c.locked_reason === 'MIN_RESPONSES' ? `응답 ${c.response_count}/${A.data.settings.min_responses}명 — 결과 잠김`\n        : c.locked_reason === 'BEFORE_OPEN_DATE' ? `결과 공개일 ${esc(c.result_open_date)} 전 — 전체 평균에서 제외` : '';\n      return `<button type=\"button\" class=\"card interactive course-pulse\" style=\"text-align:left;box-shadow:none\" data-results=\"${esc(c.course_id)}\"\n          aria-label=\"${esc(c.course_name)} ${esc(termFull(c))} 결과 보기\">\n        ${c.response_rate == null\n          ? `<span class=\"count-chip\" role=\"img\" aria-label=\"응답 ${c.response_count}명\"><strong>${c.response_count}</strong><span>명 응답</span></span>`\n          : CES.ring(c.response_rate / 100, Math.round(c.response_rate) + '%', '응답률', { small: true, label: `응답률 ${c.response_rate}%` })}\n        <span style=\"min-width:0;display:block\">\n          <span class=\"meta\" style=\"margin-bottom:4px;display:flex\">${statusBadge(c)}</span>\n          <strong style=\"display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap\">${esc(c.course_name)}${c.today_count ? ` <span class=\"today-chip\">오늘 +${c.today_count}</span>` : ''}</strong>\n          <span class=\"tiny muted\" style=\"display:block\">${esc(termFull(c))}</span>\n          ${c.mean != null ? `<span class=\"row\" style=\"gap:6px;margin-top:4px;display:flex\"><span class=\"mid-num\" style=\"font-size:1.5rem\">${fmt(c.mean)}</span><span class=\"tiny muted\">/ 5 · 긍정 ${Math.round(c.pos_pct)}%</span></span>` : `<span class=\"tiny muted\" style=\"margin-top:6px;display:block\">${icon('lock')} ${lock}</span>`}\n        </span>\n        ${doms.length ? `<span class=\"sparkbars\" style=\"grid-column:1/-1;display:grid\">${doms.map((d) => `<span class=\"sb\" style=\"display:grid\" title=\"${esc(d.domain)} ${fmt(d.mean)}\"><span aria-hidden=\"true\">${esc(d.domain.charAt(0))}</span><span class=\"sr-only\">${esc(d.domain)} ${fmt(d.mean)}점</span>\n          <span class=\"t\"><i data-w=\"${Math.max(0, (d.mean - 1) / 4 * 100)}%\"></i></span><b>${fmt(d.mean, 1)}</b></span>`).join('')}</span>` : ''}\n      </button>`;\n    }\n\n    /* ───── 교과목 ───── */\n    function renderCourses() {\n      const cs = A.data.courses;\n      setView(`\n        <div class=\"row-between\" style=\"margin-bottom:16px\">\n          <h1 class=\"page-title\">${tile('📚')}교과목</h1>\n          <div class=\"row wrap\" style=\"gap:8px\">\n            ${cs.length ? `<button type=\"button\" class=\"btn\" data-act=\"new-term\">${icon('calendar-plus')}새 학기 준비</button>` : ''}\n            <button type=\"button\" class=\"btn primary\" data-act=\"new-course\">${icon('plus')}새 교과목</button>\n          </div>\n        </div>\n        ${cs.length ? `<div class=\"bento\" style=\"grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr))\">${cs.map(courseCard).join('')}</div>`\n          : `<div class=\"card empty\">${icon('book-open')}<p>아직 교과목이 없습니다. [새 교과목]으로 시작하세요.</p></div>`}`, true);\n    }\n\n    function courseCard(c) {\n      const id = esc(c.course_id);\n      const access = c.access_mode === 'token'\n        ? `${icon('ticket')} 일회용 토큰 <span class=\"num\">${c.tokens_used}/${c.tokens_total}</span> 사용`\n        : c.access_code ? `${icon('key-round')} 접속코드 <strong class=\"num\">${esc(c.access_code)}</strong>` : `${icon('key-round')} 접속코드 자동 생성 예정`;\n      return `\n        <article class=\"card stack\" aria-labelledby=\"cn-${id}\">\n          <div class=\"row-between\"><div class=\"meta\">${statusBadge(c)}<span class=\"badge\">${esc(term(c))}</span></div>\n            ${c.result_open_date ? `<span class=\"badge warn\" title=\"결과공개일\">${icon('calendar-clock')}${esc(c.result_open_date)}</span>` : ''}</div>\n          <div><h2 id=\"cn-${id}\">${esc(c.course_name)}</h2>\n            <p class=\"small muted\">${esc([c.department, c.grade ? c.grade + '학년' : '', c.section ? c.section + '반' : '', c.course_type, c.delivery_mode, c.enrollment ? '수강 ' + c.enrollment + '명' : '', c.item_count + '문항'].filter(Boolean).join(' · '))}</p></div>\n          <p class=\"small num muted\">${icon('calendar')} ${esc(dt(c.start_at))} ~ ${esc(dt(c.end_at))}</p>\n          <div>\n            <div class=\"row-between small\"><span>응답</span><span class=\"num\"><strong>${c.response_count}</strong>${c.response_rate == null ? '명' : ` / ${c.enrollment}명 (${c.response_rate}%)`}</span></div>\n            ${c.response_rate == null ? '' : `<div class=\"meter\" role=\"img\" aria-label=\"응답률 ${c.response_rate}%\"><span style=\"width:${Math.min(100, c.response_rate)}%\"></span></div>`}\n          </div>\n          <p class=\"small\">${access}</p>\n          <div class=\"row\">\n            <button type=\"button\" class=\"btn sm primary\" data-act=\"access\" data-id=\"${id}\">${icon('link')}접속 주소</button>\n            ${c.access_mode === 'token' ? `<button type=\"button\" class=\"btn sm\" data-act=\"tokens\" data-id=\"${id}\">${icon('ticket')}토큰</button>` : ''}\n            <button type=\"button\" class=\"btn sm\" data-items=\"${id}\">${icon('list-checks')}문항</button>\n            <button type=\"button\" class=\"btn sm\" data-results=\"${id}\">${icon('chart-column')}결과</button>\n            <button type=\"button\" class=\"btn sm\" data-act=\"edit-course\" data-id=\"${id}\">${icon('pencil')}편집</button>\n            <button type=\"button\" class=\"btn sm\" data-act=\"dup-course\" data-id=\"${id}\">${icon('copy-plus')}복제</button>\n            ${c.response_count === 0 ? `<button type=\"button\" class=\"btn sm ghost\" data-act=\"del-course\" data-id=\"${id}\" aria-label=\"${esc(c.course_name)} 삭제\">${icon('trash-2')}</button>` : ''}\n          </div>\n        </article>`;\n    }\n\n    function pad(n) { return String(n).padStart(2, '0'); }\n    function localDT(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; }\n\n    function courseFormHtml(c, isEdit) {\n      const now = new Date();\n      const start = new Date(now); start.setMinutes(0, 0, 0); start.setHours(start.getHours() + 1);\n      const end = new Date(now); end.setDate(end.getDate() + 7); end.setHours(23, 59, 0, 0);\n      const depts = A.data.settings.departments || ['간호학과'];\n      c = Object.assign({\n        course_name: '', year: now.getMonth() < 2 ? now.getFullYear() - 1 : now.getFullYear(), semester: now.getMonth() >= 2 && now.getMonth() <= 7 ? '1' : '2',\n        grade: 1, department: depts[0], delivery_mode: '대면', course_type: '이론+실습',\n        start_at: localDT(start), end_at: localDT(end), access_mode: 'code', access_code: randCode(), result_open_date: ''\n      }, c || {});\n      const deptList = depts.indexOf(c.department) < 0 && c.department ? depts.concat([c.department]) : depts;\n      const sel = (v, x) => (String(v) === String(x) ? ' selected' : '');\n      return `\n        <form id=\"course-form\" class=\"form-grid two\" novalidate>\n          <div class=\"field full\"><label for=\"f-name\">교과목명 <span class=\"req\" aria-hidden=\"true\">*</span></label>\n            <input class=\"input\" id=\"f-name\" name=\"course_name\" maxlength=\"100\" required value=\"${esc(c.course_name)}\" autocomplete=\"off\"></div>\n          <div class=\"field\"><label for=\"f-year\">학년도</label><input class=\"input num\" id=\"f-year\" name=\"year\" type=\"number\" min=\"2000\" max=\"2100\" value=\"${esc(c.year)}\"></div>\n          <div class=\"field\"><label for=\"f-sem\">학기</label><select class=\"select\" id=\"f-sem\" name=\"semester\">${SEMS.map((s) => `<option value=\"${s}\"${sel(c.semester, s)}>${s}학기</option>`).join('')}</select></div>\n          <div class=\"field\"><label for=\"f-dept\">학과</label>${selectHtml('department', 'f-dept', deptList, c.department)}</div>\n          <div class=\"field\"><label for=\"f-mode\">수업 방식</label>${selectHtml('delivery_mode', 'f-mode', DELIVERY, c.delivery_mode)}\n            <p class=\"hint\">온라인(비대면)·혼합이면 온라인 강의 문항(H 영역)이 함께 표시됩니다.</p></div>\n          <div class=\"field\"><label for=\"f-type\">교과목 유형</label>${selectHtml('course_type', 'f-type', COURSE_TYPES, c.course_type)}\n            <p class=\"hint\">이론: 실습실 문항 제외 · 실습: 이론 강의실 문항 제외 · 이론+실습: 모두 표시</p></div>\n          <div class=\"field\"><label for=\"f-grade\">학년</label>${selectHtml('grade', 'f-grade', GRADES, c.grade, (g) => g + '학년')}</div>\n          <div class=\"field\"><label for=\"f-start\">응답 시작일시</label><input class=\"input\" id=\"f-start\" name=\"start_at\" type=\"datetime-local\" value=\"${esc(c.start_at)}\"></div>\n          <div class=\"field\"><label for=\"f-end\">응답 종료일시</label><input class=\"input\" id=\"f-end\" name=\"end_at\" type=\"datetime-local\" value=\"${esc(c.end_at)}\"></div>\n          <div class=\"field\"><label for=\"f-open\">결과공개일 <span class=\"muted small\">(선택)</span></label>\n            <input class=\"input\" id=\"f-open\" name=\"result_open_date\" type=\"date\" value=\"${esc(c.result_open_date)}\" aria-describedby=\"f-open-h\">\n            <p class=\"hint\" id=\"f-open-h\">이 날짜 전에는 결과를 잠급니다(성적 처리 전 열람 방지).</p></div>\n          <fieldset class=\"field full\" style=\"border:0;padding:0;margin:0\">\n            <legend class=\"field-label\">참여 방식</legend>\n            <label class=\"check\"><input type=\"radio\" name=\"access_mode\" value=\"code\"${c.access_mode !== 'token' ? ' checked' : ''}> 접속코드 — 수업 중 코드를 알려 주는 방식(간편)</label>\n            <label class=\"check\"><input type=\"radio\" name=\"access_mode\" value=\"token\"${c.access_mode === 'token' ? ' checked' : ''}> 일회용 토큰 — 1인 1회 응답 보장(종이 토큰 배부)</label>\n          </fieldset>\n          <div class=\"field full\" id=\"code-field\">\n            <label for=\"f-code\">접속코드</label>\n            <div class=\"row\"><input class=\"input code grow\" id=\"f-code\" name=\"access_code\" maxlength=\"12\" value=\"${esc(c.access_code)}\" style=\"flex:1\" aria-describedby=\"f-code-h\">\n              <button type=\"button\" class=\"btn sm\" data-act=\"gen-code\">${icon('refresh-cw')}자동 생성</button></div>\n            <p class=\"hint\" id=\"f-code-h\">영문·숫자 12자 이내. 학생이 공통 주소에서 입력합니다. 비우면 저장할 때 자동으로 만듭니다.</p>\n          </div>\n          ${isEdit ? `<label class=\"check full\"><input type=\"checkbox\" name=\"manual_close\"${c.manual_close ? ' checked' : ''}> 지금 수동으로 마감(기간과 관계없이 응답 차단)</label>` : ''}\n          <p class=\"error full hidden\" id=\"course-err\" role=\"alert\"></p>\n        </form>`;\n    }\n\n    function randCode() {\n      const al = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';\n      const b = new Uint8Array(6);\n      crypto.getRandomValues(b);\n      return Array.from(b, (x) => al[x % al.length]).join('');\n    }\n\n    function readForm(form) {\n      const fd = new FormData(form);\n      const o = {};\n      fd.forEach((v, k) => { o[k] = v; });\n      o.manual_close = !!form.querySelector('[name=\"manual_close\"]:checked');\n      return o;\n    }\n\n    function bindCourseForm(m) {\n      const form = $('#course-form', m.el);\n      const sync = () => {\n        const token = form.querySelector('[name=\"access_mode\"]:checked').value === 'token';\n        $('#code-field', form).classList.toggle('hidden', token);\n      };\n      form.addEventListener('change', sync);\n      sync();\n      form.addEventListener('click', (e) => {\n        if (e.target.closest('[data-act=\"gen-code\"]')) $('#f-code', form).value = randCode();\n      });\n      return form;\n    }\n\n    function showFormError(m, res) {\n      const err = $('#course-err', m.el);\n      err.textContent = res.message || CES.errorText(res);\n      err.classList.remove('hidden');\n      if (res.field) {\n        const f = m.el.querySelector(`[name=\"${res.field}\"]`);\n        if (f) { f.setAttribute('aria-invalid', 'true'); f.focus(); }\n      }\n    }\n\n    function openCourseForm(existing) {\n      const m = CES.modal({\n        title: existing ? '교과목 편집' : '새 교과목',\n        wide: true,\n        html: courseFormHtml(existing, !!existing) + (existing ? '' : '<p class=\"small muted\" style=\"margin-top:12px\">공통 기본 문항이 자동으로 복사됩니다. CLO 문항은 [문항] 탭에서 추가하세요.</p>'),\n        footer: `<button type=\"button\" class=\"btn\" data-close>취소</button><button type=\"button\" class=\"btn primary\" data-save>${icon('check')}저장</button>`\n      });\n      const form = bindCourseForm(m);\n      $('[data-save]', m.el).addEventListener('click', async (e) => {\n        const data = readForm(form);\n        if (existing) data.course_id = existing.course_id;\n        const restore = CES.busyButton(e.currentTarget, '저장 중…');\n        const res = await api('saveCourse', [data]);\n        restore();\n        if (!res.ok) return res.code === 'VALIDATION' ? showFormError(m, res) : fail(res);\n        m.close();\n        CES.toast(existing ? '교과목을 수정했습니다.' : '교과목을 만들었습니다.');\n        await refresh();\n        go(A.tab === 'dashboard' ? 'courses' : A.tab);\n      });\n    }\n\n    function openDuplicate(c) {\n      const now = new Date();\n      const start = new Date(now); start.setMinutes(0, 0, 0); start.setHours(start.getHours() + 1);\n      const end = new Date(now); end.setDate(end.getDate() + 7); end.setHours(23, 59, 0, 0);\n      const nextSem = c.semester === '1' ? { y: c.year, s: '2' } : { y: Number(c.year) + 1, s: '1' };\n      const m = CES.modal({\n        title: '새 학기로 복제',\n        html: `<p class=\"small muted\" style=\"margin-bottom:14px\"><strong>${esc(c.course_name)}</strong> (${esc(termFull(c))})의 문항·참여 방식을 복사합니다. 응답과 토큰은 복사하지 않습니다.</p>\n          <form id=\"dup-form\" class=\"form-grid two\" novalidate>\n            <div class=\"field\"><label for=\"d-year\">학년도</label><input class=\"input num\" id=\"d-year\" name=\"year\" type=\"number\" value=\"${nextSem.y}\"></div>\n            <div class=\"field\"><label for=\"d-sem\">학기</label><select class=\"select\" id=\"d-sem\" name=\"semester\">${SEMS.map((s) => `<option value=\"${s}\"${s === nextSem.s ? ' selected' : ''}>${s}학기</option>`).join('')}</select></div>\n            <div class=\"field\"><label for=\"d-mode\">수업 방식</label>${selectHtml('delivery_mode', 'd-mode', DELIVERY, c.delivery_mode)}</div>\n            <div class=\"field\"><label for=\"d-type\">교과목 유형</label>${selectHtml('course_type', 'd-type', COURSE_TYPES, c.course_type)}</div>\n            <div class=\"field\"><label for=\"d-start\">응답 시작일시</label><input class=\"input\" id=\"d-start\" name=\"start_at\" type=\"datetime-local\" value=\"${localDT(start)}\"></div>\n            <div class=\"field\"><label for=\"d-end\">응답 종료일시</label><input class=\"input\" id=\"d-end\" name=\"end_at\" type=\"datetime-local\" value=\"${localDT(end)}\"></div>\n            <div class=\"field\"><label for=\"d-open\">결과공개일 <span class=\"muted small\">(선택)</span></label><input class=\"input\" id=\"d-open\" name=\"result_open_date\" type=\"date\"></div>\n            <p class=\"error full hidden\" id=\"course-err\" role=\"alert\"></p>\n          </form>`,\n        footer: `<button type=\"button\" class=\"btn\" data-close>취소</button><button type=\"button\" class=\"btn primary\" data-save>${icon('copy-plus')}복제</button>`\n      });\n      $('[data-save]', m.el).addEventListener('click', async (e) => {\n        const data = readForm($('#dup-form', m.el));\n        const restore = CES.busyButton(e.currentTarget, '복제 중…');\n        const res = await api('duplicateCourse', [c.course_id, data]);\n        restore();\n        if (!res.ok) return res.code === 'VALIDATION' ? showFormError(m, res) : fail(res);\n        m.close();\n        CES.toast('새 학기 교과목을 만들었습니다. 접속코드는 새로 생성되었습니다.');\n        await refresh();\n        go('courses');\n      });\n    }\n\n    /** 새 학기 준비: 한 학기의 교과목을 모두 새 학기로 복제(새 접속코드), 이전 학기 마감 */\n    function openNewTerm() {\n      const terms = [];\n      A.data.courses.forEach((c) => { const k = c.year + '-' + c.semester; if (!terms.includes(k)) terms.push(k); });\n      terms.sort((a, b) => (a < b ? 1 : -1)); // 최근 학기 먼저\n      const [fy, fs] = terms[0].split('-');\n      const next = fs === '1' ? { y: Number(fy), s: '2' } : { y: Number(fy) + 1, s: '1' };\n      const now = new Date();\n      const start = new Date(now); start.setMinutes(0, 0, 0); start.setHours(start.getHours() + 1);\n      const end = new Date(now); end.setDate(end.getDate() + 14); end.setHours(23, 59, 0, 0);\n      const listOf = (k) => A.data.courses.filter((c) => c.year + '-' + c.semester === k);\n      const m = CES.modal({\n        title: '새 학기 준비',\n        html: `<p class=\"small muted\" style=\"margin-bottom:14px\">선택한 학기의 교과목을 문항째 새 학기로 복제하고 <strong>새 접속코드</strong>를 만듭니다. 응답·토큰은 복사하지 않으며, 새 학기에 같은 교과목이 이미 있으면 건너뜁니다. 학생 접속 주소(공통 주소)는 그대로입니다.</p>\n          <form id=\"term-form\" class=\"form-grid two\" novalidate>\n            <div class=\"field full\"><label for=\"t-from\">복제할 학기</label>\n              <select class=\"select\" id=\"t-from\" name=\"from\">${terms.map((k) => { const [y, s] = k.split('-'); return `<option value=\"${k}\">${y}학년도 ${s}학기 (${listOf(k).length}개)</option>`; }).join('')}</select></div>\n            <div class=\"field\"><label for=\"t-year\">새 학년도</label><input class=\"input num\" id=\"t-year\" name=\"year\" type=\"number\" value=\"${next.y}\"></div>\n            <div class=\"field\"><label for=\"t-sem\">새 학기</label><select class=\"select\" id=\"t-sem\" name=\"semester\">${SEMS.map((s) => `<option value=\"${s}\"${s === next.s ? ' selected' : ''}>${s}학기</option>`).join('')}</select></div>\n            <div class=\"field\"><label for=\"t-start\">응답 시작일시</label><input class=\"input\" id=\"t-start\" name=\"start_at\" type=\"datetime-local\" value=\"${localDT(start)}\"></div>\n            <div class=\"field\"><label for=\"t-end\">응답 종료일시</label><input class=\"input\" id=\"t-end\" name=\"end_at\" type=\"datetime-local\" value=\"${localDT(end)}\"></div>\n            <label class=\"check full\"><input type=\"checkbox\" name=\"close_old\" checked> 복제한 학기의 교과목을 지금 마감(이전 접속코드로는 응답 불가)</label>\n            <div class=\"full small muted\" id=\"t-list\"></div>\n            <p class=\"error full hidden\" id=\"course-err\" role=\"alert\"></p>\n          </form>`,\n        footer: `<button type=\"button\" class=\"btn\" data-close>취소</button><button type=\"button\" class=\"btn primary\" data-save>${icon('calendar-plus')}준비하기</button>`\n      });\n      const drawList = () => { $('#t-list', m.el).textContent = '대상: ' + listOf($('#t-from', m.el).value).map((c) => c.course_name).join(', '); };\n      $('#t-from', m.el).addEventListener('change', drawList);\n      drawList();\n      $('[data-save]', m.el).addEventListener('click', async (e) => {\n        const f = readForm($('#term-form', m.el));\n        const [from_year, from_semester] = String(f.from).split('-');\n        const data = { from_year, from_semester, year: f.year, semester: f.semester, start_at: f.start_at, end_at: f.end_at, close_old: !!f.close_old };\n        const restore = CES.busyButton(e.currentTarget, '준비 중…');\n        const res = await api('prepareNewTerm', [data]);\n        restore();\n        if (!res.ok) return res.code === 'VALIDATION' ? showFormError(m, res) : fail(res);\n        m.close();\n        await refresh();\n        go('courses');\n        const rows = res.made.map((x) => `<tr><th>${esc(x.course_name)}</th><td class=\"num\">${x.access_mode === 'token' ? '토큰 방식' : esc(x.access_code)}</td></tr>`).join('');\n        CES.modal({\n          title: `새 학기 교과목 ${res.made.length}개 준비 완료`,\n          html: `<div class=\"stack\">\n              ${rows ? `<table class=\"table\"><tr><th>교과목</th><th>새 접속코드</th></tr>${rows}</table>` : '<p class=\"small\">새로 만든 교과목이 없습니다.</p>'}\n              ${res.skipped.length ? `<p class=\"small muted\">이미 있어 건너뜀: ${esc(res.skipped.join(', '))}</p>` : ''}\n              ${res.closed ? `<p class=\"small muted\">이전 학기 교과목 ${res.closed}개를 마감했습니다.</p>` : ''}\n              <p class=\"small\">각 교과목의 [접속 주소] ▸ <strong>안내문 복사</strong>로 새 접속코드를 안내하세요.</p></div>`,\n          footer: '<button type=\"button\" class=\"btn primary\" data-close>확인</button>'\n        });\n      });\n    }\n\n    async function deleteCourse(c) {\n      const ok = await CES.confirm('교과목 삭제', `\"${c.course_name}\" (${termFull(c)})과 문항·토큰을 삭제합니다. 되돌릴 수 없습니다.`, '삭제', true);\n      if (!ok) return;\n      const res = await api('deleteCourse', [c.course_id]);\n      if (!res.ok) return res.code === 'HAS_RESPONSES' ? CES.toast('응답이 있는 교과목은 삭제할 수 없습니다.', 'error') : fail(res);\n      CES.toast('삭제했습니다.');\n      await refresh();\n      go('courses');\n    }\n\n    /* ───── 학생 접속 주소 ───── */\n    /** 학생용 주소(/exec)를 못 찾았을 때의 원인·해결 안내 */\n    function urlNotice() {\n      const dev = A.data.devMode;\n      return `<div class=\"callout\" role=\"alert\">${icon('triangle-alert')}<div class=\"small stack\" style=\"margin:0\">\n        <p><strong>${dev ? '지금 관리자 화면을 테스트용(/dev) 주소로 열었습니다.' : '학생용 웹 앱 주소(/exec)를 아직 찾지 못했습니다.'}</strong>\n        ${dev ? '테스트 주소(/dev)는 편집 권한이 없는 학생이 열 수 없어서, 학생 접속 주소를 만들지 않았습니다.' : ''}</p>\n        <p>해결: Apps Script 편집기 ▸ <strong>[배포] ▸ [배포 관리]</strong>에 있는 <strong>웹 앱 URL(…/exec)</strong>을 복사해\n        ① 그 주소 뒤에 <code>?page=admin</code>을 붙여 관리자 화면에 다시 접속하거나(주소가 자동 저장됨),\n        ② [설정] 탭의 「학생용 웹 앱 주소」에 붙여 넣고 저장하세요.</p></div></div>`;\n    }\n\n    /** 접속 안내는 항상 최신 교과목 정보로(다른 곳에서 교과목·접속코드가 바뀌었을 수 있음) */\n    async function openAccessFresh(id, btn) {\n      const restore = CES.busyButton(btn, '불러오는 중…');\n      await refresh();\n      restore();\n      const c = courseById(id);\n      if (!c) {\n        CES.toast('교과목 정보가 바뀌었습니다. 목록을 새로 불러왔습니다.', 'error');\n        if (A.tab === 'courses') renderCourses();\n        return;\n      }\n      openAccess(c);\n    }\n\n    /** 학생 접속 안내: 공통 주소 + 접속코드(토큰)로 접속 */\n    /** 학생에게 안내하는 주소(공통 주소) */\n    const studentAddr = (c) => c.base_url;\n\n    function accessNotice(c) {\n      const addr = `주소: ${c.base_url}`; // 안내문은 항상 원래 주소\n      return c.access_mode === 'token'\n        ? `[${c.course_name} 강의평가]\\n${addr}\\n받은 일회용 토큰을 입력하세요. (익명)`\n        : `[${c.course_name} 강의평가]\\n${addr}\\n접속코드: ${c.access_code}\\n주소를 열고 접속코드를 입력하세요. (익명${c.est_minutes ? ', 약 ' + c.est_minutes + '분' : ''})`;\n    }\n\n    function openAccess(c) {\n      if (!c.base_url) {\n        CES.modal({ title: '학생 접속 주소', html: urlNotice(),\n          footer: `<button type=\"button\" class=\"btn primary\" data-close data-go=\"settings\">${icon('settings')}설정으로 이동</button>` });\n        return;\n      }\n      const isCode = c.access_mode !== 'token';\n      const m = CES.modal({\n        title: '학생 접속 주소',\n        html: `<div class=\"stack-lg\">\n            <p class=\"small muted\">${esc(c.course_name)} · ${esc(termFull(c))}</p>\n            <div class=\"addr-box\" data-access-addr><div class=\"small muted\">접속 주소</div><code class=\"addr-main\">${esc(c.base_url)}</code>\n              <p class=\"tiny muted\" style=\"margin-top:6px\">Apps Script [배포] ▸ [배포 관리]의 <b>웹 앱 URL</b>과 같은지 확인하세요. 다르면 <button type=\"button\" class=\"linklike\" data-close data-go=\"settings\">[설정]</button>에서 고치세요.</p>\n            </div>\n            ${isCode && c.access_code ? `<div class=\"center\"><div class=\"small muted\">접속코드</div><div class=\"mid-num\" style=\"letter-spacing:.12em\">${esc(c.access_code)}</div></div>` : ''}\n            <div class=\"callout info\">${icon('smartphone')}<div class=\"small\">\n              <p><strong>학생 접속</strong> 주소 열기 → ${isCode ? '접속코드 입력' : '받은 일회용 토큰 입력'}</p>\n              <div class=\"row wrap\" style=\"gap:8px;margin-top:8px\">\n                <button type=\"button\" class=\"btn sm\" data-copy-base>${icon('copy')}주소 복사</button>\n                <button type=\"button\" class=\"btn sm\" data-copy-notice>${icon('clipboard-list')}안내문 복사(LMS 공지용)</button>\n              </div>\n            </div></div>\n          </div>`,\n        footer: `<button type=\"button\" class=\"btn primary\" data-present>${icon('presentation')}수업 화면에 띄우기</button>`\n      });\n      $('[data-copy-base]', m.el).addEventListener('click', () => CES.copy(c.base_url));\n      $('[data-copy-notice]', m.el).addEventListener('click', () => CES.copy(accessNotice(c)));\n      $('[data-present]', m.el).addEventListener('click', () => { m.close(); present(c); });\n    }\n\n    function present(c) {\n      const el = document.createElement('div');\n      el.className = 'present';\n      el.setAttribute('role', 'dialog');\n      el.setAttribute('aria-modal', 'true');\n      el.setAttribute('aria-label', '수업 화면용 접속 안내');\n      el.innerHTML = `<h1>${esc(c.course_name)} 강의평가</h1>\n        <div><div class=\"muted\">접속 주소</div><div class=\"addr-big\">${esc(studentAddr(c))}</div></div>\n        ${c.access_mode !== 'token' && c.access_code ? `<div><div class=\"muted\">접속코드</div><div class=\"code-big\">${esc(c.access_code)}</div></div>` : '<p class=\"muted\">받은 일회용 토큰을 입력하세요</p>'}\n        <p class=\"muted\">LMS 공지의 주소를 열고 코드를 입력하세요 · 익명${c.est_minutes ? ' · 약 ' + c.est_minutes + '분' : ''}</p>\n        <button type=\"button\" class=\"btn\" data-x>${icon('x')}닫기 (Esc)</button>`;\n      document.body.appendChild(el);\n      CES.icons();\n      const close = () => { el.remove(); document.removeEventListener('keydown', onKey); };\n      const onKey = (e) => { if (e.key === 'Escape') close(); };\n      document.addEventListener('keydown', onKey);\n      $('[data-x]', el).addEventListener('click', close);\n      $('[data-x]', el).focus();\n    }\n\n    /* ───── 토큰 생성·인쇄 ───── */\n    function openTokens(c) {\n      const m = CES.modal({\n        title: '일회용 토큰 생성',\n        html: `<div class=\"stack\">\n            <p class=\"small muted\">${esc(c.course_name)} · ${esc(termFull(c))} · 발급 ${c.tokens_total}개 (사용 ${c.tokens_used}개)</p>\n            <div class=\"field\"><label for=\"tk-n\">생성할 토큰 수</label>\n              <input class=\"input num\" id=\"tk-n\" type=\"number\" min=\"1\" max=\"300\" value=\"${Math.max(1, c.enrollment || 40)}\" aria-describedby=\"tk-h\">\n              <p class=\"hint\" id=\"tk-h\">1~300개. 수강생 수보다 2~3개 여유 있게 만들면 분실에 대비할 수 있습니다.</p></div>\n            <div class=\"callout\">${icon('shield-alert')}<p class=\"small\">토큰 원문은 <strong>이 화면에서 한 번만</strong> 보여 줍니다. 서버에는 해시만 저장되므로 창을 닫기 전에 인쇄하거나 내려받으세요. 토큰은 학생 명단 순서가 아닌 <strong>무작위로 섞어</strong> 나눠 주세요.</p></div>\n          </div>`,\n        footer: `<button type=\"button\" class=\"btn\" data-close>취소</button><button type=\"button\" class=\"btn primary\" data-gen>${icon('ticket')}생성</button>`\n      });\n      $('[data-gen]', m.el).addEventListener('click', async (e) => {\n        const n = Number($('#tk-n', m.el).value);\n        if (!(n >= 1 && n <= 300)) { CES.toast('토큰 수는 1~300개입니다.', 'error'); return; }\n        const restore = CES.busyButton(e.currentTarget, '생성 중…');\n        const res = await api('generateTokens', [c.course_id, n]);\n        restore();\n        if (!res.ok) return fail(res);\n        m.close();\n        showTokenSheet(c, res.tokens, res.course.base_url || c.base_url);\n        refresh().then(() => { if (A.tab === 'courses') renderCourses(); });\n      });\n    }\n\n    function slipsHtml(c, tokens, base) {\n      return `<div class=\"slips\">${tokens.map((t) => `<div class=\"slip\"><div>\n          <div class=\"c\"><strong>강의평가 일회용 토큰</strong><br>${esc(c.course_name)} (${esc(term(c))}${c.section ? ' ' + esc(c.section) + '반' : ''})</div>\n          <div class=\"t\">${esc(t)}</div>\n          <div class=\"g\">아래 주소에 접속해 토큰 입력 · 1회용 · 익명</div>\n          ${base ? `<div class=\"u\">${esc(base)}</div>` : ''}</div></div>`).join('')}</div>`;\n    }\n\n    function showTokenSheet(c, tokens, base) {\n      const sheet = slipsHtml(c, tokens, base);\n      const m = CES.modal({\n        title: `토큰 ${tokens.length}개 생성됨`,\n        wide: true,\n        persistent: true,\n        onRequestClose: (api) => confirmClose(api),\n        html: `<div class=\"stack\">\n            <div class=\"callout\" role=\"alert\">${icon('triangle-alert')}<p class=\"small\"><strong>지금 인쇄하거나 내려받으세요.</strong> 이 창을 닫으면 토큰 원문을 다시 볼 수 없습니다.</p></div>\n            <div style=\"max-height:46vh;overflow:auto;border:1px solid var(--line);border-radius:16px;padding:12px;background:#fff\">${sheet}</div>\n          </div>`,\n        footer: `<button type=\"button\" class=\"btn\" data-csv>${icon('file-spreadsheet')}CSV</button>\n          <button type=\"button\" class=\"btn\" data-html>${icon('file-down')}인쇄용 파일(HTML)</button>\n          <button type=\"button\" class=\"btn primary\" data-print>${icon('printer')}A4 인쇄</button>\n          <button type=\"button\" class=\"btn ghost\" data-done>닫기</button>`\n      });\n      $('[data-print]', m.el).addEventListener('click', () => printSheet(sheet));\n      $('[data-csv]', m.el).addEventListener('click', () => {\n        const rows = [['번호', '토큰', '접속 주소']].concat(tokens.map((t, i) => [i + 1, t, base || '']));\n        CES.download(`토큰_${c.course_name}_${term(c)}.csv`.replace(/\\s+/g, '_'), rows.map((r) => r.join(',')).join('\\r\\n'), 'text/csv');\n      });\n      $('[data-html]', m.el).addEventListener('click', () => {\n        const css = `body{font-family:\"Pretendard Variable\",Pretendard,\"Apple SD Gothic Neo\",\"Malgun Gothic\",sans-serif;margin:0}\n          @page{size:A4;margin:10mm}.slips{display:grid;grid-template-columns:repeat(3,1fr)}\n          .slip{border:1px dashed #9a9a9a;padding:4mm;height:33mm;display:flex;gap:3mm;align-items:center;break-inside:avoid}\n          .u{font-size:6pt;color:#444;word-break:break-all;margin-top:.6mm}\n          .t{font-size:15pt;font-weight:700;letter-spacing:.06em}.c{font-size:7.5pt;line-height:1.3}.g{font-size:6.5pt;color:#444;margin-top:1mm}`;\n        CES.download(`토큰_${c.course_name}_${term(c)}.html`.replace(/\\s+/g, '_'),\n          `<!DOCTYPE html><html lang=\"ko\"><head><meta charset=\"utf-8\"><title>강의평가 토큰</title><style>${css}</style></head><body>${sheet}<script>window.onload=function(){window.print()}<\\/script></body></html>`, 'text/html');\n      });\n      $('[data-done]', m.el).addEventListener('click', () => confirmClose(m));\n    }\n\n    async function confirmClose(m) {\n      const ok = await CES.confirm('토큰 창 닫기', '인쇄 또는 내려받기를 마쳤나요? 닫으면 토큰 원문을 다시 볼 수 없습니다.', '닫기', true);\n      if (ok) m.close();\n    }\n\n    function printSheet(html) {\n      const area = $('#print-area');\n      area.innerHTML = html;\n      document.body.classList.add('printing');\n      const cleanup = () => { document.body.classList.remove('printing'); area.innerHTML = ''; window.removeEventListener('afterprint', cleanup); };\n      window.addEventListener('afterprint', cleanup);\n      try { window.print(); } catch (e) { CES.toast('이 환경에서는 인쇄가 차단되었습니다. [인쇄용 파일]을 내려받아 인쇄하세요.', 'error'); }\n      setTimeout(() => { if (document.body.classList.contains('printing')) cleanup(); }, 60000);\n    }\n\n    /* ───── 문항 편집 ───── */\n    function courseOptions(selected, includeTemplate) {\n      const cs = A.data.courses;\n      return (includeTemplate ? `<option value=\"TEMPLATE\"${selected === 'TEMPLATE' ? ' selected' : ''}>공통 기본 문항 은행(TEMPLATE)</option>` : '') +\n        cs.map((c) => `<option value=\"${esc(c.course_id)}\"${selected === c.course_id ? ' selected' : ''}>${esc(c.course_name)} · ${esc(termFull(c))}</option>`).join('');\n    }\n\n    async function renderItems() {\n      const cs = A.data.courses;\n      if (!A.itemsCourse || (A.itemsCourse !== 'TEMPLATE' && !courseById(A.itemsCourse))) {\n        const open = cs.find((c) => c.status !== '마감' && c.response_count === 0) || cs[0];\n        A.itemsCourse = open ? open.course_id : 'TEMPLATE';\n      }\n      setView(`\n        <div class=\"row-between\" style=\"margin-bottom:16px\">\n          <h1 class=\"page-title\">${tile('📝')}문항 편집</h1>\n          <div class=\"field\" style=\"min-width:min(100%,360px)\"><label class=\"sr-only\" for=\"items-course\">교과목 선택</label>\n            <select class=\"select\" id=\"items-course\">${courseOptions(A.itemsCourse, true)}</select></div>\n        </div>\n        <div id=\"items-body\"><div class=\"skeleton\" aria-hidden=\"true\"></div></div>`, true);\n      $('#items-course').addEventListener('change', async (e) => {\n        if (A.itemsDirty) {\n          const ok = await CES.confirm('저장하지 않은 변경', '변경 내용을 버리고 다른 교과목을 열까요?', '버리고 열기', true);\n          if (!ok) { e.target.value = A.itemsCourse; return; }\n        }\n        A.itemsCourse = e.target.value;\n        A.itemsDirty = false;\n        loadItems();\n      });\n      loadItems();\n    }\n\n    async function loadItems() {\n      const res = await api('getItemsAdmin', [A.itemsCourse]);\n      if (!res.ok) { fail(res); return; }\n      A.items = res.items.map((it) => Object.assign({}, it, { options: it.options || [] }));\n      A.itemsLocked = res.locked;\n      A.itemsDirty = false;\n      drawItems();\n    }\n\n    function drawItems() {\n      const body = $('#items-body');\n      if (!body) return;\n      const locked = A.itemsLocked;\n      const isTemplate = A.itemsCourse === 'TEMPLATE';\n      const course = isTemplate ? null : courseById(A.itemsCourse);\n      const visible = A.items.filter((it) => scopeVisible(it.scope, course));\n      const hidden = A.items.length - visible.length;\n      const min = estMinutes(visible);\n      body.innerHTML = `\n        ${locked ? `<div class=\"callout\" style=\"margin-bottom:16px\">${icon('lock')}<p class=\"small\"><strong>응답이 이미 수집되어 문항을 수정할 수 없습니다.</strong> 문항이 바뀌면 기존 응답과 의미가 달라지기 때문입니다. 다음 학기에는 [교과목 ▸ 복제] 후 수정하세요.</p></div>` : ''}\n        ${isTemplate ? `<div class=\"callout info\" style=\"margin-bottom:16px\">${icon('info')}<p class=\"small\">공통 기본 문항 은행입니다. 여기서 수정한 내용은 <strong>앞으로 새로 만드는 교과목</strong>에 복사됩니다(기존 교과목은 바뀌지 않음).</p></div>` : ''}\n        ${locked ? '' : `<div class=\"row\" style=\"margin-bottom:16px\">\n          ${isTemplate ? '' : `<button type=\"button\" class=\"btn sm\" data-act=\"load-template\">${icon('library')}기본 문항 불러오기</button>`}\n          <button type=\"button\" class=\"btn sm\" data-act=\"add-item\">${icon('plus')}문항 추가</button>\n          <button type=\"button\" class=\"btn sm\" data-act=\"clo\">${icon('target')}CLO 일괄 입력</button>\n          <div class=\"grow\"></div>\n          <button type=\"button\" class=\"btn primary sm\" data-act=\"save-items\" id=\"save-items\">${icon('save')}저장${A.itemsDirty ? ' •' : ''}</button>\n        </div>`}\n        <div class=\"row-between small\" style=\"margin-bottom:8px\">\n          <span>학생에게 보이는 문항 <strong class=\"num\">${visible.length}</strong>개 · 예상 <strong class=\"num\">${min}</strong>분${hidden ? ` <span class=\"muted\">(이 교과목의 ${esc(course.delivery_mode)}·${esc(course.course_type)} 설정으로 ${hidden}개 숨김)</span>` : ''}</span>\n          ${min > 3 ? `<span class=\"badge warn\">${icon('timer')}3분 목표를 넘습니다</span>` : `<span class=\"badge open\">${icon('timer')}3분 이내</span>`}\n        </div>\n        <div id=\"item-list\">${A.items.map((it, i) => itemRow(it, i, locked, !scopeVisible(it.scope, course))).join('') || `<div class=\"card empty\">${icon('list')}<p>문항이 없습니다.</p></div>`}</div>`;\n      CES.icons();\n    }\n\n    function itemRow(it, i, locked, isHidden) {\n      const dis = locked ? ' disabled' : '';\n      const choice = it.type === 'single' || it.type === 'multi' || it.type === 'select';\n      return `\n        <div class=\"item-row${isHidden ? ' is-hidden' : ''}\" data-idx=\"${i}\">\n          <div class=\"stack\" style=\"margin:0\">\n            ${locked ? '' : `<button type=\"button\" class=\"drag-handle\" aria-label=\"${i + 1}번 문항 끌어서 순서 변경\" data-handle>${icon('grip-vertical')}</button>`}\n            <div class=\"item-index\" aria-hidden=\"true\">${i + 1}</div>\n          </div>\n          <div class=\"item-fields\">\n            <div class=\"line\">\n              <div class=\"field\"><label class=\"sr-only\" for=\"dom-${i}\">${i + 1}번 영역</label>\n                ${A.domainEdit === i\n                  ? `<input class=\"input\" id=\"dom-${i}\" data-f=\"domain\" data-domain-edit value=\"${esc(it.domain)}\" maxlength=\"40\" placeholder=\"새 영역 이름(예: I. 임상실습)\"${dis}>`\n                  : `<select class=\"select\" id=\"dom-${i}\" data-f=\"domain\"${dis}>${domainOptions().map((d) => `<option value=\"${esc(d)}\"${it.domain === d ? ' selected' : ''}>${esc(d)}</option>`).join('')}\n                      <option value=\"${DOMAIN_CUSTOM}\">직접 입력…</option></select>`}</div>\n              <div class=\"field\"><label class=\"sr-only\" for=\"txt-${i}\">${i + 1}번 문항 내용</label>\n                <textarea class=\"textarea\" id=\"txt-${i}\" data-f=\"text\" rows=\"2\" maxlength=\"300\" style=\"min-height:48px\" placeholder=\"문항 내용\"${dis}>${esc(it.text)}</textarea></div>\n              <div class=\"field\"><label class=\"sr-only\" for=\"typ-${i}\">${i + 1}번 유형</label>\n                <select class=\"select\" id=\"typ-${i}\" data-f=\"type\"${dis}>${Object.keys(TYPES).map((t) => `<option value=\"${t}\"${it.type === t ? ' selected' : ''}>${TYPES[t]}</option>`).join('')}</select></div>\n            </div>\n            ${choice ? `<div class=\"field\"><label for=\"opt-${i}\" class=\"small\">선택지 (한 줄에 하나, 2~10개)</label>\n              <textarea class=\"textarea\" id=\"opt-${i}\" data-f=\"options\" rows=\"3\" style=\"min-height:80px\"${dis}>${esc((it.options || []).join('\\n'))}</textarea></div>` : ''}\n            <div class=\"item-tools\">\n              <label class=\"check small\"><input type=\"checkbox\" data-f=\"required\"${it.required ? ' checked' : ''}${dis}> 필수</label>\n              ${it.type === 'likert5' ? `<label class=\"check small\"><input type=\"checkbox\" data-f=\"reverse\"${it.reverse ? ' checked' : ''}${dis}> 역문항(점수 역환산)</label>` : ''}\n              <label class=\"check small\" for=\"scp-${i}\">표시 조건</label>\n              <select class=\"select\" id=\"scp-${i}\" data-f=\"scope\" style=\"min-height:40px;width:auto;font-size:.875rem\"${dis}>${Object.keys(SCOPES).map((k) =>\n                `<option value=\"${k}\"${(it.scope || '') === k ? ' selected' : ''}>${SCOPES[k]}</option>`).join('')}</select>\n              ${isHidden ? `<span class=\"badge closed\">${icon('eye-off')}이 교과목에서 숨김</span>` : ''}\n              <div class=\"grow\"></div>\n              ${locked ? '' : `\n              <button type=\"button\" class=\"btn ghost sm icon\" data-move=\"-1\" aria-label=\"${i + 1}번 문항 위로\"${i === 0 ? ' disabled' : ''}>${icon('arrow-up')}</button>\n              <button type=\"button\" class=\"btn ghost sm icon\" data-move=\"1\" aria-label=\"${i + 1}번 문항 아래로\"${i === A.items.length - 1 ? ' disabled' : ''}>${icon('arrow-down')}</button>\n              <button type=\"button\" class=\"btn ghost sm icon\" data-del aria-label=\"${i + 1}번 문항 삭제\">${icon('trash-2')}</button>`}\n            </div>\n          </div>\n        </div>`;\n    }\n\n    function markDirty() {\n      if (!A.itemsDirty) {\n        A.itemsDirty = true;\n        const b = $('#save-items');\n        if (b && !/•/.test(b.textContent)) b.insertAdjacentHTML('beforeend', ' •');\n      }\n    }\n\n    function moveItem(from, to, focusSel) {\n      if (to < 0 || to >= A.items.length || from === to) return;\n      const [x] = A.items.splice(from, 1);\n      A.items.splice(to, 0, x);\n      markDirty();\n      drawItems();\n      CES.announce(`${from + 1}번 문항을 ${to + 1}번으로 옮겼습니다.`);\n      if (focusSel) { const el = $(`.item-row[data-idx=\"${to}\"] ${focusSel}`); if (el && !el.disabled) el.focus(); }\n    }\n\n    function cloSentence(line) {\n      let s = line.trim().replace(/^[-*•\\d.)\\s]+/, '').replace(/[.。]\\s*$/, '');\n      if (!s) return '';\n      if (/되었다$/.test(s)) return (s.startsWith('나는') ? s : '나는 ' + s) + '.';\n      s = s.replace(/(할 수 있다|할 수 있음|한다|하기|함)$/, '');\n      if (!s.startsWith('나는')) s = '나는 ' + s;\n      return s + (/[을를]$/.test(s) ? ' 할 수 있게 되었다.' : '할 수 있게 되었다.');\n    }\n\n    function openClo() {\n      const m = CES.modal({\n        title: 'CLO 문항 일괄 입력',\n        wide: true,\n        html: `<div class=\"stack\">\n            <p class=\"small muted\">교과목 학습성과(CLO)를 한 줄에 하나씩 입력하세요. \"나는 ~할 수 있게 되었다.\" 형식의 자기평가 문항으로 바뀌어 영역 D에 추가됩니다.</p>\n            <div class=\"field\"><label for=\"clo-in\">CLO 목록</label>\n              <textarea class=\"textarea\" id=\"clo-in\" rows=\"6\" placeholder=\"간호정보시스템의 구조와 기능을 설명&#10;임상의사결정지원시스템의 원리를 이해하고 적용\"></textarea></div>\n            <div><div class=\"field-label\">미리보기 (추가 후에도 수정할 수 있습니다)</div><ol id=\"clo-prev\" class=\"small\" style=\"padding-left:20px;margin:8px 0 0\"></ol></div>\n          </div>`,\n        footer: `<button type=\"button\" class=\"btn\" data-close>취소</button><button type=\"button\" class=\"btn primary\" data-add>${icon('plus')}추가</button>`\n      });\n      const input = $('#clo-in', m.el), prev = $('#clo-prev', m.el);\n      const lines = () => input.value.split('\\n').map(cloSentence).filter(Boolean);\n      input.addEventListener('input', () => { prev.innerHTML = lines().map((s) => `<li>${esc(s)}</li>`).join(''); });\n      $('[data-add]', m.el).addEventListener('click', () => {\n        const ls = lines();\n        if (!ls.length) { CES.toast('CLO를 1개 이상 입력하세요.', 'error'); return; }\n        let at = A.items.findIndex((it) => /^[E-Z]\\./.test(it.domain) || it.domain === '서술형' || it.type === 'select');\n        if (at < 0) at = A.items.length;\n        A.items.splice(at, 0, ...ls.map((t) => ({ domain: DOMAINS[3], text: t, type: 'likert5', required: true, reverse: false, options: [] })));\n        markDirty();\n        m.close();\n        drawItems();\n        CES.toast(`CLO 문항 ${ls.length}개를 추가했습니다. [저장]을 눌러 반영하세요.`);\n      });\n    }\n\n    async function loadTemplate() {\n      const res = await api('getItemsAdmin', ['TEMPLATE']);\n      if (!res.ok) return fail(res);\n      const tpl = res.items.map((it) => Object.assign({}, it, { item_id: '' }));\n      const m = CES.modal({\n        title: '기본 문항 불러오기',\n        html: `<p>공통 기본 문항 ${tpl.length}개를 불러옵니다. 현재 문항을 어떻게 할까요?</p>`,\n        footer: `<button type=\"button\" class=\"btn\" data-close>취소</button>\n          <button type=\"button\" class=\"btn\" data-mode=\"append\">${icon('list-plus')}뒤에 추가</button>\n          <button type=\"button\" class=\"btn primary\" data-mode=\"replace\">${icon('replace')}모두 교체</button>`\n      });\n      m.el.addEventListener('click', (e) => {\n        const b = e.target.closest('[data-mode]');\n        if (!b) return;\n        A.items = b.dataset.mode === 'replace' ? tpl : A.items.concat(tpl);\n        markDirty();\n        m.close();\n        drawItems();\n        CES.toast('불러왔습니다. [저장]을 눌러 반영하세요.');\n      });\n    }\n\n    async function saveItems(btn) {\n      const empty = A.items.findIndex((it) => !String(it.text).trim() || !String(it.domain).trim());\n      if (empty >= 0) {\n        CES.toast(`${empty + 1}번 문항의 영역과 내용을 입력하세요.`, 'error');\n        const el = $(`#txt-${empty}`); if (el) el.focus();\n        return;\n      }\n      const restore = CES.busyButton(btn, '저장 중…');\n      const res = await api('saveItems', [A.itemsCourse, A.items]);\n      restore();\n      if (!res.ok) {\n        if (res.code === 'LOCKED_ITEMS') { CES.toast('응답이 수집되어 문항을 저장할 수 없습니다.', 'error'); return loadItems(); }\n        if (res.code === 'VALIDATION' && res.index != null) { const el = $(`#txt-${res.index}`); if (el) el.focus(); }\n        return fail(res);\n      }\n      A.items = res.items;\n      A.itemsDirty = false;\n      drawItems();\n      CES.toast('문항을 저장했습니다.');\n      refresh();\n    }\n\n    /** 영역 드롭다운 목록: 기본 영역 + 이 문항 목록에서 쓰는 사용자 영역(입력값으로 거르지 않고 항상 전체 표시) */\n    const DOMAIN_CUSTOM = '__custom__';\n    function domainOptions() {\n      const out = DOMAINS.slice();\n      (A.items || []).forEach((x) => { const d = String(x.domain || '').trim(); if (d && out.indexOf(d) < 0) out.push(d); });\n      return out;\n    }\n\n    view.addEventListener('input', (e) => {\n      const row = e.target.closest('.item-row');\n      if (!row) return;\n      const it = A.items[Number(row.dataset.idx)];\n      const f = e.target.dataset.f;\n      if (!it || !f) return;\n      if (f === 'domain' && e.target.value === DOMAIN_CUSTOM) return; // '직접 입력…'은 change에서 처리\n      if (f === 'required' || f === 'reverse') it[f] = e.target.checked;\n      else if (f === 'scope') it.scope = e.target.value;\n      else if (f === 'options') it.options = e.target.value.split('\\n').map((s) => s.trim()).filter(Boolean);\n      else if (f !== 'type') it[f] = e.target.value;\n      markDirty();\n    });\n    view.addEventListener('change', (e) => {\n      const row = e.target.closest('.item-row');\n      if (row && e.target.dataset.f === 'domain' && e.target.tagName === 'SELECT') {\n        const idx = Number(row.dataset.idx);\n        if (e.target.value === DOMAIN_CUSTOM) {\n          // 같은 자리에 입력란을 열어 새 영역 이름을 받음(입력을 마치면 다시 드롭다운)\n          A.domainEdit = idx;\n          drawItems();\n          const inp = $(`#dom-${idx}`);\n          if (inp) { inp.focus(); inp.select(); }\n          return;\n        }\n        A.items[idx].domain = e.target.value;\n        markDirty();\n        return;\n      }\n      if (row && e.target.dataset.f === 'scope') { A.items[Number(row.dataset.idx)].scope = e.target.value; markDirty(); drawItems(); const sc = $(`#scp-${row.dataset.idx}`); if (sc) sc.focus(); return; }\n      if (!row || e.target.dataset.f !== 'type') return;\n      const it = A.items[Number(row.dataset.idx)];\n      it.type = e.target.value;\n      if ((it.type === 'single' || it.type === 'multi' || it.type === 'select') && (!it.options || it.options.length < 2)) it.options = ['예', '아니요'];\n      if (it.type !== 'likert5') it.reverse = false;\n      markDirty();\n      drawItems();\n      const sel = $(`#typ-${row.dataset.idx}`); if (sel) sel.focus();\n    });\n\n    // 새 영역 입력을 마치면(포커스 이동·Enter) 드롭다운으로 되돌림. 비워 두면 원래 영역 유지\n    view.addEventListener('focusout', (e) => {\n      if (!e.target.matches || !e.target.matches('[data-domain-edit]')) return;\n      const idx = A.domainEdit;\n      A.domainEdit = null;\n      const it = A.items[idx];\n      if (it && !String(it.domain || '').trim()) it.domain = DOMAINS[0];\n      setTimeout(() => { drawItems(); const sel = $(`#dom-${idx}`); if (sel && document.activeElement === document.body) sel.focus(); }, 0);\n    });\n    view.addEventListener('keydown', (e) => {\n      if (e.key === 'Enter' && e.target.matches && e.target.matches('[data-domain-edit]')) { e.preventDefault(); e.target.blur(); }\n    });\n\n    // 드래그 정렬(HTML5 DnD, 손잡이로만 시작) — 키보드·터치는 ↑↓ 버튼 사용\n    let dragFrom = null;\n    view.addEventListener('pointerdown', (e) => {\n      const h = e.target.closest('[data-handle]');\n      if (h) h.closest('.item-row').draggable = true;\n    });\n    view.addEventListener('dragstart', (e) => {\n      const row = e.target.closest && e.target.closest('.item-row');\n      if (!row) return;\n      dragFrom = Number(row.dataset.idx);\n      row.classList.add('dragging');\n      e.dataTransfer.effectAllowed = 'move';\n      try { e.dataTransfer.setData('text/plain', String(dragFrom)); } catch (err) { /* 무시 */ }\n    });\n    view.addEventListener('dragover', (e) => {\n      const row = e.target.closest('.item-row');\n      if (dragFrom == null || !row) return;\n      e.preventDefault();\n      const r = row.getBoundingClientRect();\n      const after = e.clientY > r.top + r.height / 2;\n      $$('.item-row').forEach((x) => x.classList.remove('drop-before', 'drop-after'));\n      row.classList.add(after ? 'drop-after' : 'drop-before');\n    });\n    view.addEventListener('drop', (e) => {\n      const row = e.target.closest('.item-row');\n      if (dragFrom == null || !row) return;\n      e.preventDefault();\n      let to = Number(row.dataset.idx);\n      if (row.classList.contains('drop-after')) to++;\n      if (to > dragFrom) to--;\n      const from = dragFrom;\n      dragFrom = null;\n      moveItem(from, to);\n    });\n    view.addEventListener('dragend', () => {\n      dragFrom = null;\n      $$('.item-row').forEach((x) => { x.draggable = false; x.classList.remove('dragging', 'drop-before', 'drop-after'); });\n    });\n\n    /* ───── 결과 ───── */\n    async function renderResults() {\n      const cs = A.data.courses;\n      if (!cs.length) {\n        setView(`<h1 style=\"margin-bottom:16px\">결과 분석</h1><div class=\"card empty\">${icon('chart-column')}<p>교과목이 없습니다.</p></div>`, true);\n        return;\n      }\n      if (!courseById(A.resultsCourse)) {\n        const best = cs.filter((c) => c.response_count > 0).sort((a, b) => b.response_count - a.response_count)[0] || cs[0];\n        A.resultsCourse = best.course_id;\n      }\n      setView(`\n        <div class=\"row-between\" style=\"margin-bottom:16px\">\n          <h1 class=\"page-title\">${tile('📊')}결과 분석</h1>\n          <div class=\"row wrap\" style=\"gap:8px;align-items:center\">\n            <div class=\"field\" style=\"min-width:min(100%,360px)\"><label class=\"sr-only\" for=\"res-course\">교과목 선택</label>\n              <select class=\"select\" id=\"res-course\">${courseOptions(A.resultsCourse, false)}</select></div>\n            <button type=\"button\" class=\"btn primary\" data-act=\"report-pdf\">${icon('file-down')}결과 보고서 PDF</button>\n          </div>\n        </div>\n        <div id=\"res-body\"><div class=\"bento\"><div class=\"skeleton span-2\"></div><div class=\"skeleton span-2\"></div></div></div>`, true);\n      $('#res-course').addEventListener('change', (e) => { A.resultsCourse = e.target.value; A.wcWord = null; A.wcKey = 'all'; loadResults(); });\n      loadResults();\n    }\n\n    async function loadResults() {\n      const res = await api('getResults', [A.resultsCourse]);\n      if (!res.ok) { fail(res); return; }\n      A.results = res;\n      destroyCharts();\n      const body = $('#res-body');\n      if (!body) return;\n      body.innerHTML = res.locked ? lockedHtml(res) : resultsHtml(res);\n      CES.icons();\n      if (!res.locked) {\n        if (A.wcKey !== 'all' && !res.texts.some((t) => t.item_id === A.wcKey)) A.wcKey = 'all';\n        drawCharts(res);\n        drawWordCloud();\n        bindAiPanel(res);\n        CES.animateIn(body);\n      }\n    }\n\n    function lockedHtml(r) {\n      const c = r.course;\n      if (r.reason === 'MIN_RESPONSES') {\n        const pct = Math.min(100, Math.round(r.n / r.min_responses * 100));\n        return `<section class=\"card pad-lg center stack-lg\" style=\"max-width:640px;margin:0 auto\">\n          <div class=\"notice-icon warn\">${icon('lock')}</div>\n          <div><h2>응답이 ${r.min_responses}명 이상 모이면 결과가 열립니다</h2>\n            <p class=\"muted small\" style=\"margin-top:8px\">학생 익명성 보호를 위해 최소 공개 응답 수 미만의 결과는 표시하지 않습니다(분반·학기 비교와 서술형 포함).</p></div>\n          <div><div class=\"big-num\">${r.n}<span class=\"unit\">/ ${r.min_responses}명</span></div>\n            <div class=\"progress\" style=\"margin-top:12px\" role=\"progressbar\" aria-label=\"최소 응답 수 대비\" aria-valuenow=\"${pct}\" aria-valuemin=\"0\" aria-valuemax=\"100\"><span style=\"width:${pct}%\"></span></div></div>\n          <p class=\"small muted\">${esc(c.course_name)} · ${esc(termFull(c))} · 마감 ${esc(dt(c.end_at))}</p>\n        </section>`;\n      }\n      return `<section class=\"card pad-lg center stack-lg\" style=\"max-width:640px;margin:0 auto\">\n          <div class=\"notice-icon\">${icon('calendar-clock')}</div>\n          <div><h2>${esc(r.open_date)}부터 결과를 볼 수 있습니다</h2>\n            <p class=\"muted small\" style=\"margin-top:8px\">성적 처리 전 열람을 막기 위해 결과공개일을 설정했습니다. [교과목 ▸ 편집]에서 바꿀 수 있습니다.</p></div>\n          <p class=\"small\">현재 응답 <strong class=\"num\">${r.n}</strong>명</p>\n        </section>`;\n    }\n\n    function distBar(s, labels) {\n      const total = s.dist.reduce((a, b) => a + b, 0) || 1;\n      return `<div class=\"dist\" role=\"img\" aria-label=\"${s.dist.map((n, i) => `${i + 1}점 ${n}명`).join(', ')}\">${s.dist.map((n, i) => n\n        ? `<span class=\"d${i + 1}\" style=\"flex:${n}\" title=\"${i + 1}점 ${esc(labels[i])}: ${n}명 (${Math.round(n / total * 100)}%)\"></span>` : '').join('')}</div>`;\n    }\n\n    function resultsHtml(r) {\n      const c = r.course, st = r.stats;\n      const doms = st.domains.slice().sort((a, b) => b.mean - a.mean);\n      const best = doms[0], worst = doms[doms.length - 1];\n      const likert = st.items.filter((s) => s.type === 'likert5');\n      const choices = st.items.filter((s) => s.type === 'single' || s.type === 'multi');\n      void best; void worst;\n      const legend = `<div class=\"legend\" aria-hidden=\"true\">${r.likertLabels.map((l, i) => `<span><i style=\"background:var(--lk${i + 1})\"></i>${i + 1} ${esc(l)}</span>`).join('')}</div>`;\n      const sem = r.semester_compare, sec = r.section_compare;\n\n      const k = st.kpis || {};\n      const sorted = st.domains.slice().sort((x, y) => y.mean - x.mean);\n      const textItems = r.texts.filter((t) => t.answers.length);\n      const kpiRing = (i, ic, title, frac, center, cap, sub, label, tone) => `\n        <section class=\"card kpi-ring rise\" style=\"--i:${i}\" aria-label=\"${esc(title)}\">\n          <div class=\"card-title\">${icon(ic)}${esc(title)}</div>\n          ${CES.ring(frac, center, cap, { label: label, tone: tone })}\n          <p class=\"sub\">${sub}</p>\n        </section>`;\n      const pctRing = (i, ic, title, kp, fallback) => kp\n        ? kpiRing(i, ic, title, kp.pos_pct / 100, CES.count(kp.pos_pct, 0) + '<small style=\"font-size:.5em\">%</small>', '긍정(4·5점)',\n          `평균 ${fmt(kp.mean)} · ${esc(kp.text)}`, `${title} 긍정 응답 ${kp.pos_pct}%, 평균 ${fmt(kp.mean)}`)\n        : kpiRing(i, ic, title, 0, '—', '', fallback, title + ' 문항 없음');\n\n      return `<div class=\"section-head\"><h2>${icon('sparkles')} 한눈에 보기</h2></div>\n      <div class=\"bento\">\n        ${c.response_rate == null\n          ? `<section class=\"card kpi-ring rise\" style=\"--i:0\" aria-label=\"응답 수\"><div class=\"card-title\">${icon('users')}응답 수</div>\n              <div class=\"big-num\" style=\"margin:18px 0 6px\">${CES.count(r.n, 0)}<span class=\"unit\">명</span></div>\n              <p class=\"sub\">${esc(c.course_name)} · ${esc(termFull(c))}</p></section>`\n          : kpiRing(0, 'users', '응답률', c.response_rate / 100, CES.count(c.response_rate, 0) + '<small style=\"font-size:.5em\">%</small>', `${r.n}/${c.enrollment}명`,\n            `${esc(c.course_name)} · ${esc(termFull(c))}`, `응답률 ${c.response_rate}%, ${r.n}명 응답`)}\n        ${kpiRing(1, 'gauge', '전체 평균', (st.overall - 1) / 4, CES.count(st.overall, 2), '5점 만점',\n          `${esc(interpret(st.overall))} · 긍정 ${st.overall_pos_pct}%`, `전체 평균 ${fmt(st.overall)}점`, 'ink')}\n        ${pctRing(2, 'smile', '전반적 만족도', k.satisfaction, '만족도 문항이 없습니다')}\n        ${pctRing(3, 'thumbs-up', '추천 의향', k.recommend, '추천 문항이 없습니다')}\n\n        <section class=\"card span-2 rise\" style=\"--i:4\" aria-labelledby=\"h1\">\n          <div class=\"row-between\"><div class=\"card-title\" id=\"h1\">${icon('chart-bar-decreasing')}영역별 평균</div>\n            <span class=\"tiny muted\">세로선 = 전체 평균 ${fmt(st.overall)}</span></div>\n          <div class=\"hbars\" style=\"margin-top:14px\">${sorted.map((d) => `\n            <div class=\"r\"><span class=\"lab\" title=\"${esc(d.domain)}\">${esc(d.domain)}</span>\n              <div class=\"track\" role=\"img\" aria-label=\"${esc(d.domain)} 평균 ${fmt(d.mean)}점\">\n                <div class=\"fill${d.mean < 3.5 ? ' low' : ''}\" data-w=\"${((d.mean - 1) / 4 * 100).toFixed(1)}%\"></div>\n                <span class=\"ref\" style=\"left:${((st.overall - 1) / 4 * 100).toFixed(1)}%\" aria-hidden=\"true\"></span></div>\n              <span class=\"val\">${fmt(d.mean)}</span></div>`).join('')}</div>\n          <p class=\"tiny muted\" style=\"margin-top:10px\">${icon('info')} 3.5 미만 영역은 코랄색으로 표시해 개선이 필요함을 알려 줍니다.</p>\n        </section>\n        <section class=\"card span-2 rise\" style=\"--i:5\" aria-labelledby=\"h2\">\n          <div class=\"row-between\"><div class=\"card-title\" id=\"h2\">${icon('chart-bar-stacked')}영역별 응답 분포</div>\n            <div class=\"legend\" aria-hidden=\"true\"><span><i style=\"background:var(--lk1)\"></i>부정</span><span><i style=\"background:var(--lk3)\"></i>보통</span><span><i style=\"background:var(--lk5)\"></i>긍정</span></div></div>\n          <div class=\"hbars\" style=\"margin-top:14px\">${st.domains.map((d) => `\n            <div class=\"r\"><span class=\"lab\" title=\"${esc(d.domain)}\">${esc(d.domain)}</span>\n              <div class=\"dist\" role=\"img\" aria-label=\"${esc(d.domain)}: 부정 ${d.neg_pct}%, 보통 ${d.neu_pct}%, 긍정 ${d.pos_pct}%\">${d.dist.map((n, i) => n\n                ? `<span class=\"d${i + 1}\" data-grow=\"${n}\" style=\"flex:0 1 0\" title=\"${i + 1}점 ${n}건\"></span>` : '').join('')}</div>\n              <span class=\"val\">${Math.round(d.pos_pct)}%</span></div>`).join('')}</div>\n          <p class=\"tiny muted\" style=\"margin-top:10px\">오른쪽 숫자는 긍정(4·5점) 응답 비율입니다. 역문항은 환산 점수 기준입니다.</p>\n        </section>\n\n        <section class=\"card span-4 rise\" style=\"--i:6\" aria-labelledby=\"h3\">\n          <div class=\"row-between\"><div class=\"card-title\" id=\"h3\">${icon('cloud')}서술형 워드 클라우드</div>\n            ${textItems.length ? `<div class=\"seg\" role=\"group\" aria-label=\"워드 클라우드 대상 문항\">\n              <button type=\"button\" data-wc=\"all\" aria-pressed=\"${A.wcKey === 'all'}\">전체</button>\n              ${textItems.map((t, i) => `<button type=\"button\" data-wc=\"${esc(t.item_id)}\" aria-pressed=\"${A.wcKey === t.item_id}\" title=\"${esc(t.text)}\">${esc(shortQ(t.text, i))}</button>`).join('')}\n            </div>` : ''}</div>\n          ${textItems.length ? `<div class=\"wc-box\" id=\"wc\" style=\"margin-top:8px\"></div>\n            <div id=\"wc-hits\" aria-live=\"polite\"></div>\n            <p class=\"tiny muted\">${icon('mouse-pointer-click')} 단어를 누르면 그 단어가 들어간 응답만 아래에 모아 보여 줍니다. 단어 크기는 언급 횟수입니다(형태소 분석기 없이 조사·서술어를 걸러 낸 근사치).</p>`\n            : '<p class=\"small muted\" style=\"margin-top:12px\">서술형 응답이 없습니다.</p>'}\n        </section>\n\n        ${(r.groups || []).map((g) => groupCard(g, st)).join('')}\n      </div>\n\n      <div class=\"section-head\"><h2>${icon('microscope')} 상세 분석</h2></div>\n      <div class=\"bento\">\n        <section class=\"card span-2 row-2\" aria-labelledby=\"k4\"><div class=\"card-title\" id=\"k4\">${icon('radar')}영역별 평균</div>\n          <div class=\"chart-box\" style=\"margin-top:8px\"><canvas id=\"radar\" role=\"img\" aria-label=\"영역별 평균 레이더 차트. 아래 표에 같은 값이 있습니다.\"></canvas></div>\n          <div class=\"table-wrap\"><table class=\"data\"><caption class=\"sr-only\">영역별 평균과 표준편차</caption>\n            <thead><tr><th scope=\"col\">영역</th><th scope=\"col\" class=\"num\">문항</th><th scope=\"col\" class=\"num\">평균</th><th scope=\"col\" class=\"num\">SD</th><th scope=\"col\">해석</th></tr></thead>\n            <tbody>${st.domains.map((d) => `<tr><th scope=\"row\" style=\"font-weight:600\">${esc(d.domain)}</th><td class=\"num\">${d.item_count}</td><td class=\"num\"><strong>${fmt(d.mean)}</strong></td><td class=\"num\">${fmt(d.sd)}</td><td class=\"small\">${esc(interpret(d.mean))}</td></tr>`).join('')}</tbody></table></div>\n        </section>\n\n        <section class=\"card span-2\" aria-labelledby=\"k5\"><div class=\"row-between\"><div class=\"card-title\" id=\"k5\">${icon('history')}학기 간 비교</div><span class=\"small muted\">같은 교과목명·분반</span></div>\n          ${sem.groups.length >= 2 ? `<div class=\"chart-box\" style=\"min-height:220px;margin-top:8px\"><canvas id=\"semChart\" role=\"img\" aria-label=\"학기별 전체 평균 추이. 아래 표에 같은 값이 있습니다.\"></canvas></div>\n            ${compareTable(sem.groups, st.domains)}` : `<p class=\"small muted\" style=\"margin-top:12px\">비교할 이전 학기 자료가 없습니다.</p>`}\n          ${sem.excluded ? `<p class=\"tiny muted\">응답 수가 공개 기준 미만이거나 공개일 전인 ${sem.excluded}개 학기는 제외했습니다.</p>` : ''}\n        </section>\n        ${sec.groups.length >= 2 ? `<section class=\"card span-2\" aria-labelledby=\"k6\"><div class=\"row-between\"><div class=\"card-title\" id=\"k6\">${icon('columns-3')}분반 간 비교</div><span class=\"small muted\">같은 교과목·학년도·학기</span></div>\n          <div class=\"chart-box\" style=\"min-height:220px;margin-top:8px\"><canvas id=\"secChart\" role=\"img\" aria-label=\"분반별 전체 평균 막대 차트. 아래 표에 같은 값이 있습니다.\"></canvas></div>\n          ${compareTable(sec.groups, st.domains)}\n          ${sec.excluded ? `<p class=\"tiny muted\">응답 수가 공개 기준 미만인 ${sec.excluded}개 분반은 제외했습니다.</p>` : ''}\n        </section>` : ''}\n\n        <section class=\"card span-4\" aria-labelledby=\"k7\"><div class=\"row-between\"><div class=\"card-title\" id=\"k7\">${icon('list-ordered')}문항별 결과</div>${legend}</div>\n          <div class=\"table-wrap\" style=\"margin-top:8px\"><table class=\"data\"><caption class=\"sr-only\">문항별 응답 수, 평균, 표준편차, 분포</caption>\n            <thead><tr><th scope=\"col\" class=\"num\">#</th><th scope=\"col\">영역</th><th scope=\"col\">문항</th><th scope=\"col\" class=\"num\">n</th><th scope=\"col\" class=\"num\">평균</th><th scope=\"col\" class=\"num\">SD</th><th scope=\"col\" style=\"min-width:140px\">분포 (1→5)</th></tr></thead>\n            <tbody>${likert.map((s, i) => `<tr><td class=\"num\">${i + 1}</td><td class=\"small\">${esc(s.domain)}</td>\n              <td>${esc(s.text)}${s.reverse ? ' <span class=\"badge\">역문항</span>' : ''}</td><td class=\"num\">${s.n}</td><td class=\"num\"><strong>${fmt(s.mean)}</strong></td><td class=\"num\">${fmt(s.sd)}</td>\n              <td>${distBar(s, r.likertLabels)}<div class=\"tiny muted num\" style=\"margin-top:2px\">${s.dist.join(' · ')}</div></td></tr>`).join('')}</tbody></table></div>\n        </section>\n\n        ${choices.map((s) => `<section class=\"card span-2\" aria-label=\"${esc(s.text)}\"><div class=\"card-title\">${icon('list')}${esc(s.domain)}</div>\n          <h3 style=\"margin:8px 0 12px\">${esc(s.text)}</h3><div class=\"stack\">${s.options.map((o) => {\n            const p = s.n ? Math.round(o.count / s.n * 100) : 0;\n            return `<div><div class=\"row-between small\"><span>${esc(o.label)}</span><span class=\"num\">${o.count}명 (${p}%)</span></div>\n              <div class=\"hbar\"><div class=\"track\"><div class=\"fill\" style=\"width:${p}%\"></div></div></div></div>`;\n          }).join('')}</div><p class=\"tiny muted\" style=\"margin-top:8px\">응답 ${s.n}명${s.type === 'multi' ? ' · 복수 선택' : ''}</p></section>`).join('')}\n\n        <section class=\"card span-4\" aria-labelledby=\"k8\"><div class=\"row-between\"><div class=\"card-title\" id=\"k8\">${icon('message-square-quote')}서술형 응답</div>\n          <span class=\"small muted\">무작위 순서로 표시(응답자 추적 방지)</span></div>\n          <div class=\"stack-lg\" style=\"margin-top:12px\">${r.texts.map((t) => `<div><h3>${esc(t.text)} <span class=\"small muted num\">${t.answers.length}건</span></h3>\n            ${t.answers.length ? quoteList(t.answers) : '<p class=\"small muted\">응답 없음</p>'}</div>`).join('') || '<p class=\"small muted\">서술형 문항이 없습니다.</p>'}</div>\n        </section>\n\n        <section class=\"card span-4\" aria-labelledby=\"k9\"><div class=\"row-between\"><div class=\"card-title\" id=\"k9\">${icon('clipboard-list')}CQI 요약표</div>\n</div>\n          <div class=\"row\" style=\"margin-top:8px;justify-content:flex-end\" aria-label=\"보고서 PDF\">\n            <button type=\"button\" class=\"btn sm\" data-pdf=\"raw\">${icon('file-text')}원자료 PDF</button>\n            <button type=\"button\" class=\"btn sm\" data-pdf=\"cqi\">${icon('file-text')}CQI 요약표 PDF</button>\n          </div>\n          ${aiPanel(r)}\n          <div class=\"bento\" style=\"margin-top:12px\">\n            <div class=\"card mint span-2\" data-strengths><h3>${icon('thumbs-up')} 강점</h3><ol class=\"small\" style=\"padding-left:20px;margin:8px 0 0\">\n              ${r.cqi.strengths.map((s) => `<li>${esc(s.text)} <span class=\"num\">(${fmt(s.mean)})</span></li>`).join('') || '<li>—</li>'}</ol></div>\n            <div class=\"card butter span-2\"><h3>${icon('wrench')} 개선점</h3><ol class=\"small\" style=\"padding-left:20px;margin:8px 0 0\">\n              ${r.cqi.improvements.map((s) => `<li>${esc(s.text)} <span class=\"num\">(${fmt(s.mean)})</span></li>`).join('') || '<li>—</li>'}</ol></div>\n          </div>\n          <p class=\"tiny muted\" style=\"margin-top:12px\">강점·개선점은 문항 평균 상위·하위 3개입니다. 서술형 텍스트는 AI에 넣기 전에 개인 식별 정보가 없는지 확인하세요.</p>\n        </section>\n      </div>`;\n    }\n\n    function quoteList(answers) {\n      const li = (a) => `<li>${esc(a)}</li>`;\n      const head = answers.slice(0, 8), rest = answers.slice(8);\n      return `<ul class=\"quote-list\" style=\"margin-top:8px\">${head.map(li).join('')}</ul>` +\n        (rest.length ? `<details style=\"margin-top:8px\"><summary class=\"btn ghost sm\" style=\"display:inline-flex\">나머지 ${rest.length}건 더 보기</summary>\n          <ul class=\"quote-list\" style=\"margin-top:8px\">${rest.map(li).join('')}</ul></details>` : '');\n    }\n\n    function shortQ(text, i) {\n      if (/도움/.test(text)) return '도움이 된 점';\n      if (/개선/.test(text)) return '개선할 점';\n      if (/바라/.test(text)) return '바라는 점';\n      return '문항 ' + (i + 1);\n    }\n\n    /** 드롭다운(성별 등) 집단 비교 카드. 소규모 집단이 있으면 수치 없이 사유만 표시합니다. */\n    function groupCard(g, st) {\n      if (g.suppressed) {\n        return `<section class=\"card span-2 rise\" style=\"--i:7\" aria-label=\"${esc(g.text)} 비교\">\n          <div class=\"card-title\">${icon('users-round')}${esc(g.text.replace(/\\s*\\(.*\\)$/, ''))}별 비교</div>\n          <div class=\"callout info\" style=\"margin-top:12px\">${icon('shield-check')}<p class=\"small\">어느 한 집단이라도 응답이 ${g.min_responses}명 미만이면 개인 응답이 드러날 수 있어\n          <strong>집단별 수치와 인원을 표시하지 않습니다.</strong> (원자료 CSV에서도 이 열은 제외됩니다.)</p></div></section>`;\n      }\n      return `<section class=\"card span-2 rise\" style=\"--i:7\" aria-label=\"${esc(g.text)} 비교\">\n        <div class=\"card-title\">${icon('users-round')}${esc(g.text.replace(/\\s*\\(.*\\)$/, ''))}별 비교</div>\n        <div class=\"row\" style=\"gap:28px;margin-top:12px;justify-content:center\">${g.groups.map((x) => `<div class=\"kpi-ring\">\n          ${CES.ring((x.overall - 1) / 4, fmt(x.overall), `${esc(x.label)} · ${x.n}명`, { small: false, label: `${x.label} 평균 ${fmt(x.overall)}점, ${x.n}명` })}\n          <span class=\"sub\">긍정 ${Math.round(x.pos_pct)}%</span></div>`).join('')}</div>\n        ${compareTable(g.groups.map((x) => Object.assign({ label: x.label, n: x.n, overall: x.overall, domains: x.domains }, {})), st.domains)}\n      </section>`;\n    }\n\n    function drawWordCloud() {\n      const r = A.results;\n      const host = $('#wc');\n      if (!r || !host) return;\n      const words = A.wcKey === 'all' ? r.wordcloud.all : (r.wordcloud.items[A.wcKey] || []);\n      const pool = A.wcKey === 'all' ? r.texts.flatMap((t) => t.answers.map((a) => ({ q: t.text, a }))) :\n        (r.texts.find((t) => t.item_id === A.wcKey) || { answers: [] }).answers.map((a) => ({ q: '', a }));\n      const hits = $('#wc-hits');\n      const showHits = (w) => {\n        if (!w) { hits.innerHTML = ''; return; }\n        const re = new RegExp(w.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&'), 'i'); // g 플래그 금지: test()가 lastIndex를 이어 써서 일부 응답을 놓침\n        const found = pool.filter((x) => re.test(x.a.replace(/wi-?fi/gi, '와이파이')));\n        hits.innerHTML = `<div class=\"row-between\" style=\"margin:8px 0\"><strong>‘${esc(w)}’이(가) 들어간 응답 <span class=\"num\">${found.length}</span>건</strong>\n          <button type=\"button\" class=\"btn ghost sm\" data-wc-clear>${icon('x')}선택 해제</button></div>\n          <ul class=\"quote-list\">${found.slice(0, 30).map((x) => `<li>${esc(x.a).replace(new RegExp(esc(w).replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&'), 'gi'), (m) => `<mark>${m}</mark>`)}${x.q ? `<div class=\"tiny muted\" style=\"margin-top:4px\">${esc(x.q)}</div>` : ''}</li>`).join('')}</ul>`;\n        CES.icons();\n      };\n      const keep = A.wcWord;\n      A.wc = CES.wordCloud(host, words, { label: '서술형 응답 워드 클라우드', onSelect: (w) => { A.wcWord = w; showHits(w); } });\n      // 창 크기 변경으로 다시 그릴 때 선택한 단어 유지\n      if (!(keep && A.wc && A.wc.select(keep))) { A.wcWord = null; showHits(null); }\n    }\n\n    function compareTable(groups, domains) {\n      return `<div class=\"table-wrap\" style=\"margin-top:8px\"><table class=\"data\"><caption class=\"sr-only\">비교 표</caption>\n        <thead><tr><th scope=\"col\">구분</th><th scope=\"col\" class=\"num\">n</th><th scope=\"col\" class=\"num\">전체</th>${domains.map((d) => `<th scope=\"col\" class=\"num\" title=\"${esc(d.domain)}\">${esc(d.domain.split('.')[0])}</th>`).join('')}</tr></thead>\n        <tbody>${groups.map((g) => `<tr${g.current ? ' style=\"background:var(--primary-soft)\"' : ''}><th scope=\"row\" style=\"font-weight:600\">${esc(g.label)}${g.current ? ' <span class=\"sr-only\">(현재)</span>' : ''}</th>\n          <td class=\"num\">${g.n}</td><td class=\"num\"><strong>${fmt(g.overall)}</strong></td>\n          ${domains.map((d) => { const x = g.domains.find((y) => y.domain === d.domain); return `<td class=\"num\">${x ? fmt(x.mean) : '—'}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`;\n    }\n\n    function interpret(m) {\n      if (m == null) return '';\n      if (m >= 4.5) return '매우 우수';\n      if (m >= 4.0) return '우수';\n      if (m >= 3.5) return '보통 이상';\n      if (m >= 3.0) return '보통';\n      return '개선 필요';\n    }\n\n    function drawCharts(r) {\n      if (!window.Chart) {\n        $$('.chart-box', view).forEach((b) => { b.innerHTML = '<p class=\"small muted\">차트 라이브러리를 불러오지 못해 표로만 표시합니다.</p>'; b.style.minHeight = '0'; });\n        return;\n      }\n      const ink = cssVar('--ink'), muted = cssVar('--muted'), line = cssVar('--line'), primary = cssVar('--primary'), surface = cssVar('--surface'), gray = cssVar('--chart-muted');\n      Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;\n      Chart.defaults.color = muted;\n      const anim = CES.reducedMotion() ? false : { duration: 500 };\n      const tooltip = { backgroundColor: ink, titleColor: surface, bodyColor: surface, padding: 10, cornerRadius: 10, displayColors: true };\n\n      const doms = r.stats.domains;\n      const radarEl = $('#radar');\n      if (radarEl && doms.length >= 3) {\n        const gs = r.semester_compare.groups;\n        const cur = gs.findIndex((g) => g.current);\n        const prev = cur > 0 ? gs[cur - 1] : null; // 직전 학기만 겹쳐 표시\n        const sets = [{\n          label: '이번 학기', data: doms.map((d) => d.mean), borderColor: primary, backgroundColor: primary + '22',\n          borderWidth: 2, pointRadius: 4, pointBackgroundColor: primary, pointBorderColor: surface, pointBorderWidth: 2\n        }];\n        if (prev) {\n          sets.push({\n            label: prev.label, data: doms.map((d) => { const x = prev.domains.find((y) => y.domain === d.domain); return x ? x.mean : null; }),\n            borderColor: gray, backgroundColor: 'transparent', borderDash: [5, 4], borderWidth: 2, pointRadius: 4,\n            pointBackgroundColor: gray, pointBorderColor: surface, pointBorderWidth: 2\n          });\n        }\n        A.charts.push(new Chart(radarEl, {\n          type: 'radar',\n          data: { labels: doms.map((d) => d.domain), datasets: sets },\n          options: {\n            maintainAspectRatio: false, animation: anim,\n            scales: { r: { min: 1, max: 5, ticks: { stepSize: 1, backdropColor: 'transparent', color: muted }, grid: { color: line }, angleLines: { color: line }, pointLabels: { color: ink, font: { size: 12, weight: 600 } } } },\n            plugins: { legend: { display: sets.length > 1, labels: { color: ink, usePointStyle: true } }, tooltip: tooltip }\n          }\n        }));\n      } else if (radarEl) {\n        radarEl.parentElement.innerHTML = '<p class=\"small muted\">레이더 차트는 영역이 3개 이상일 때 표시됩니다.</p>';\n      }\n\n      const lineOpts = (min) => ({\n        maintainAspectRatio: false, animation: anim,\n        scales: { y: { min: min, max: 5, ticks: { stepSize: 0.5 }, grid: { color: line } }, x: { grid: { display: false }, ticks: { color: ink } } },\n        plugins: { legend: { display: false }, tooltip: tooltip }\n      });\n      const semEl = $('#semChart');\n      if (semEl) {\n        const g = r.semester_compare.groups;\n        A.charts.push(new Chart(semEl, {\n          type: 'line',\n          data: { labels: g.map((x) => x.label), datasets: [{ label: '전체 평균', data: g.map((x) => x.overall), borderColor: primary, backgroundColor: primary, borderWidth: 2, pointRadius: g.map((x) => (x.current ? 6 : 4)), pointBorderColor: surface, pointBorderWidth: 2, tension: 0.25 }] },\n          options: lineOpts(1)\n        }));\n      }\n      const secEl = $('#secChart');\n      if (secEl) {\n        const g = r.section_compare.groups;\n        A.charts.push(new Chart(secEl, {\n          type: 'bar',\n          data: { labels: g.map((x) => x.label), datasets: [{ label: '전체 평균', data: g.map((x) => x.overall), backgroundColor: g.map((x) => (x.current ? primary : gray)), borderRadius: 4, borderSkipped: 'bottom', maxBarThickness: 48 }] },\n          options: lineOpts(1)\n        }));\n      }\n    }\n\n    /** 서술형 응답 AI 분석: 범위 선택 → AI용 복사·TXT → AI 요약 붙여넣기 → PDF(보고·인쇄용) */\n    const AI_LONG = 8000; // 이 글자 수를 넘으면 문항별로 나눠 넣기를 권함(무료 AI 서비스의 한 번 입력 한도를 고려한 대략값)\n    function aiScope() { const el = $('#ai-scope'); return el ? el.value : ''; }\n    function aiSummaryKey() { return 'ces:aisum:' + A.resultsCourse; }\n    function aiText(r, scope) {\n      const c = r.course;\n      const texts = (r.texts || []).filter((t) => !scope || t.item_id === scope);\n      const out = [`[강의평가 Studio] 서술형 응답 — ${c.course_name} (${c.year}학년도 ${c.semester}학기${c.section ? ', ' + c.section + '반' : ''}) / 응답 ${r.n}명${scope ? ' / 문항 1개만' : ''}`,\n        '※ 응답 순서는 무작위입니다. 이름·학번 등 개인을 식별할 수 있는 내용이 있으면 AI에 입력하기 전에 삭제하세요.', ''];\n      texts.forEach((t) => { out.push(`■ ${t.text} (${t.answers.length}건)`); t.answers.forEach((a) => out.push('- ' + String(a).replace(/\\n+/g, ' '))); out.push(''); });\n      out.push('---', '[AI 요약 요청]', r.ai_prompt || '');\n      return out.join('\\n');\n    }\n    function aiPanel(r) {\n      const texts = r.texts || [];\n      if (!texts.length) return '';\n      const saved = CES.store.get(aiSummaryKey()) || '';\n      return `<div class=\"card ai-panel\" style=\"box-shadow:none;margin-top:12px\" aria-labelledby=\"ai-h\">\n          <h3 id=\"ai-h\">${icon('sparkles')} 서술형 응답 AI 분석</h3>\n          <ol class=\"small muted\" style=\"margin:6px 0 10px;padding-left:20px\"><li>범위를 고르고 <b>AI용으로 복사</b>(또는 TXT 내려받기)</li><li>생성형 AI에 붙여 넣어 요약 받기</li><li>요약을 아래 칸에 붙여 넣고 <b>서술형 응답 PDF</b> 저장</li></ol>\n          <div class=\"row\" style=\"align-items:center\">\n            <label class=\"small\" for=\"ai-scope\">범위</label>\n            <select class=\"select\" id=\"ai-scope\" style=\"width:auto;max-width:100%;min-width:0;min-height:40px;font-size:.875rem\">\n              <option value=\"\">전체(서술형 ${texts.length}문항)</option>\n              ${texts.map((t, i) => `<option value=\"${esc(t.item_id)}\">서술형 ${i + 1}: ${esc(t.text.length > 28 ? t.text.slice(0, 28) + '…' : t.text)}</option>`).join('')}\n            </select>\n            <span class=\"small muted\" id=\"ai-len\" aria-live=\"polite\"></span>\n          </div>\n          <div class=\"row\" style=\"margin-top:8px\">\n            <button type=\"button\" class=\"btn sm primary\" data-ai-copy>${icon('clipboard-copy')}AI용으로 복사</button>\n            <button type=\"button\" class=\"btn sm\" data-export=\"exportText\">${icon('file-down')}서술형 텍스트(AI 붙여넣기용 TXT)</button>\n          </div>\n          <div class=\"field\" style=\"margin-top:12px\"><label for=\"ai-summary\" class=\"small\">AI 요약 붙여넣기(선택 · PDF에 함께 저장, 최대 5,000자)</label>\n            <textarea class=\"textarea\" id=\"ai-summary\" rows=\"5\" maxlength=\"5000\" placeholder=\"AI가 만든 요약을 검토한 뒤 붙여 넣으세요. 비워 두면 PDF에 작성란이 인쇄됩니다.\">${esc(saved)}</textarea></div>\n          <div class=\"row\" style=\"margin-top:8px;justify-content:flex-end\">\n            <button type=\"button\" class=\"btn sm primary\" data-pdf=\"text\">${icon('file-text')}서술형 응답 PDF(보고·인쇄용)</button>\n          </div>\n        </div>`;\n    }\n    function bindAiPanel(r) {\n      const sel = $('#ai-scope');\n      if (!sel) return;\n      const len = $('#ai-len');\n      const update = () => {\n        const n = aiText(r, sel.value).length;\n        len.textContent = `약 ${n.toLocaleString()}자` + (n > AI_LONG && !sel.value ? ' · 길어서 AI에 한 번에 넣기 어려울 수 있습니다. 문항별로 나눠 보세요.' : '');\n        len.classList.toggle('warn-text', n > AI_LONG && !sel.value);\n      };\n      sel.addEventListener('change', update);\n      update();\n      // 클릭 즉시(사용자 동작 안에서) 복사 — 서버 응답을 기다리지 않아 브라우저가 클립보드를 막지 않음\n      $('[data-ai-copy]').addEventListener('click', () => CES.copy(aiText(r, sel.value)));\n      const sum = $('#ai-summary');\n      sum.addEventListener('input', () => CES.store.set(aiSummaryKey(), sum.value));\n    }\n\n    async function doPdf(kind, btn) {\n      const restore = CES.busyButton(btn, 'PDF 만드는 중…');\n      const opts = kind === 'text' ? { itemId: aiScope(), aiSummary: ($('#ai-summary') || {}).value || '' } : undefined;\n      const res = await api('exportPdf', opts ? [A.resultsCourse, kind, opts] : [A.resultsCourse, kind]);\n      restore();\n      if (!res.ok) return fail(res);\n      CES.downloadBase64(res.filename, res.base64, res.mime || 'application/pdf');\n      if (res.omitted) CES.toast(`익명성 보호를 위해 소규모 집단이 있는 드롭다운 문항 ${res.omitted}개를 제외했습니다.`);\n    }\n\n    /* ───── 결과 보고서 PDF(매뉴얼처럼 인쇄용으로 설계, 서버에서 생성 — 글자 검색 가능) ───── */\n    /** 차트 캔버스 → 카드 배경을 깐 PNG(투명 배경이 PDF에서 어색하지 않게) */\n    function canvasPng(el) {\n      if (!el || !el.width) return '';\n      const c = document.createElement('canvas');\n      c.width = el.width; c.height = el.height;\n      const g = c.getContext('2d');\n      g.fillStyle = getComputedStyle(el.closest('.card') || document.body).backgroundColor || '#fff';\n      g.fillRect(0, 0, c.width, c.height);\n      g.drawImage(el, 0, 0);\n      try { return c.toDataURL('image/png'); } catch (e) { return ''; }\n    }\n    /** 워드 클라우드 SVG → PNG(글자 색을 인라인으로 옮겨 CSS 없이도 같은 색) */\n    function svgPng(svg) {\n      return new Promise((done) => {\n        if (!svg) return done('');\n        const box = svg.getBoundingClientRect();\n        const w = Math.max(1, Math.round(box.width)), h = Math.max(1, Math.round(box.height));\n        const clone = svg.cloneNode(true);\n        const src = svg.querySelectorAll('text'), dst = clone.querySelectorAll('text');\n        src.forEach((t, i) => {\n          const cs = getComputedStyle(t);\n          dst[i].setAttribute('fill', cs.fill);\n          dst[i].setAttribute('font-family', cs.fontFamily);\n          dst[i].setAttribute('font-weight', cs.fontWeight);\n        });\n        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');\n        clone.setAttribute('width', w); clone.setAttribute('height', h);\n        const im = new Image();\n        im.onload = () => {\n          const c = document.createElement('canvas');\n          c.width = w * 2; c.height = h * 2;\n          const g = c.getContext('2d');\n          g.fillStyle = getComputedStyle(svg.closest('.card') || document.body).backgroundColor || '#fff';\n          g.fillRect(0, 0, c.width, c.height);\n          g.drawImage(im, 0, 0, c.width, c.height);\n          try { done(c.toDataURL('image/png')); } catch (e) { done(''); }\n        };\n        im.onerror = () => done('');\n        im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));\n      });\n    }\n    async function reportPdf(btn) {\n      if (!$('#res-body .section-head')) return CES.toast('결과가 열린 교과목에서 저장할 수 있습니다(응답 수가 최소 공개 수 이상).', 'error');\n      const restore = CES.busyButton(btn, '보고서 만드는 중…');\n      try {\n        const images = { radar: canvasPng($('#radar')), semester: canvasPng($('#semChart')), section: canvasPng($('#secChart')), wordcloud: await svgPng($('#wc svg')) };\n        Object.keys(images).forEach((k) => { if (!images[k]) delete images[k]; });\n        const res = await api('exportPdf', [A.resultsCourse, 'report', { images, aiSummary: ($('#ai-summary') || {}).value || '' }]);\n        if (!res.ok) return fail(res);\n        CES.downloadBase64(res.filename, res.base64, 'application/pdf');\n        CES.toast('결과 보고서 PDF를 저장했습니다.');\n      } finally {\n        restore();\n      }\n    }\n\n    async function doExport(fn, btn) {\n      const restore = CES.busyButton(btn, '준비 중…');\n      const res = await api(fn, fn === 'exportText' ? [A.resultsCourse, aiScope()] : [A.resultsCourse]);\n      restore();\n      if (!res.ok) return fail(res);\n      CES.download(res.filename, res.content, fn === 'exportText' ? 'text/plain' : 'text/csv');\n      if (res.omitted) CES.toast(`익명성 보호를 위해 소규모 집단이 있는 드롭다운 문항 ${res.omitted}개 열을 제외했습니다.`);\n    }\n\n    /* ───── 사용 매뉴얼(Manual.html의 템플릿) ───── */\n    function renderManual() {\n      const tpl = document.getElementById('manual-tpl');\n      setView(tpl ? tpl.innerHTML : '<p class=\"muted\">매뉴얼을 불러오지 못했습니다.</p>');\n      const all = () => $$('details', view);\n      const toggle = $('[data-manual-toggle]', view);\n      const sync = () => { if (toggle) toggle.textContent = all().every((d) => d.open) ? '모두 접기' : '모두 펼치기'; };\n      if (toggle) toggle.addEventListener('click', () => { const open = !all().every((d) => d.open); all().forEach((d) => { d.open = open; }); sync(); });\n      all().forEach((d) => d.addEventListener('toggle', sync));\n      // 차례: 웹 앱 iframe에서는 #이동 대신 해당 장을 펼치고 스크롤\n      $$('.manual-toc a', view).forEach((a) => a.addEventListener('click', (e) => {\n        e.preventDefault();\n        const d = $(a.getAttribute('href'), view);\n        if (!d) return;\n        d.open = true;\n        sync();\n        d.scrollIntoView({ behavior: CES.reducedMotion() ? 'auto' : 'smooth', block: 'start' });\n        const s = $('summary', d);\n        if (s) s.focus({ preventScroll: true });\n      }));\n    }\n\n    /* ───── 설정 ───── */\n    function renderSettings() {\n      const s = A.data.settings;\n      const url = A.data.webAppUrl;\n      setView(`\n        <h1 class=\"page-title\" style=\"margin-bottom:16px\">${tile('⚙️')}설정</h1>\n        <div class=\"bento\">\n          <section class=\"card span-2\" aria-labelledby=\"s1\"><h2 id=\"s1\" style=\"margin-bottom:16px\">기본 정보</h2>\n            <form id=\"set-form\" class=\"form-grid\" novalidate>\n              <div class=\"field\"><label for=\"s-name\">교수명</label><input class=\"input\" id=\"s-name\" name=\"professor_name\" maxlength=\"40\" value=\"${esc(s.professor_name)}\"></div>\n              <div class=\"field\"><label for=\"s-aff\">소속(학교/학과)</label><input class=\"input\" id=\"s-aff\" name=\"affiliation\" maxlength=\"80\" value=\"${esc(s.affiliation)}\"></div>\n              <div class=\"field\"><label for=\"s-dept\">학과 목록 (교과목 설정의 드롭다운)</label>\n                <textarea class=\"textarea\" id=\"s-dept\" name=\"departments\" rows=\"3\" style=\"min-height:90px\" aria-describedby=\"s-dept-h\">${esc((s.departments || []).join('\\n'))}</textarea>\n                <p class=\"hint\" id=\"s-dept-h\">한 줄에 하나씩 입력하세요. 예: 간호학과</p></div>\n              <div class=\"field\"><label for=\"s-url\">학생용 웹 앱 주소 (/exec)</label>\n                <input class=\"input\" id=\"s-url\" name=\"webapp_url\" type=\"url\" inputmode=\"url\" spellcheck=\"false\" placeholder=\"https://script.google.com/macros/s/…/exec\"\n                  value=\"${esc(s.webapp_url || '')}\" aria-describedby=\"s-url-h\">\n                <p class=\"hint\" id=\"s-url-h\">학생 접속 주소로 쓰는 주소입니다. [배포] ▸ [배포 관리]의 웹 앱 URL을 붙여 넣으세요. 비어 있으면 /exec 주소로 관리자 화면에 접속할 때 자동으로 채워지고, 입력한 주소는 자동으로 바뀌지 않습니다. 테스트용 /dev 주소는 학생이 열 수 없어 저장되지 않습니다.</p>\n                ${A.data.currentUrl && s.webapp_url && A.data.currentUrl !== s.webapp_url ? `<p class=\"hint\" style=\"color:var(--danger-ink)\">${icon('info')} 지금 관리자 화면은 다른 주소(<code>${esc(A.data.currentUrl)}</code>)로 실행 중입니다. 학생 링크가 열리지 않으면 [배포 관리]의 현재 주소로 바꾸세요.</p>` : ''}</div>\n              <div class=\"field\"><label for=\"s-min\">최소 공개 응답 수</label>\n                <input class=\"input num\" id=\"s-min\" name=\"min_responses\" type=\"number\" min=\"3\" max=\"50\" value=\"${s.min_responses}\" aria-describedby=\"s-min-h\">\n                <p class=\"hint\" id=\"s-min-h\">응답이 이 수보다 적으면 결과·비교·서술형을 숨깁니다(3~50, 권장 5 이상).</p></div>\n              <div><button type=\"submit\" class=\"btn primary\">${icon('save')}저장</button></div>\n            </form></section>\n          <section class=\"card span-2\" aria-labelledby=\"s2\"><h2 id=\"s2\" style=\"margin-bottom:16px\">PIN 변경</h2>\n            <form id=\"pin-form\" class=\"form-grid\" novalidate>\n              <div class=\"field\"><label for=\"p-cur\">현재 PIN</label><input class=\"input\" id=\"p-cur\" type=\"password\" inputmode=\"numeric\" autocomplete=\"current-password\" maxlength=\"12\"></div>\n              <div class=\"field\"><label for=\"p-new\">새 PIN (숫자 6~12자리)</label><input class=\"input\" id=\"p-new\" type=\"password\" inputmode=\"numeric\" autocomplete=\"new-password\" maxlength=\"12\"></div>\n              <div class=\"field\"><label for=\"p-new2\">새 PIN 확인</label><input class=\"input\" id=\"p-new2\" type=\"password\" inputmode=\"numeric\" autocomplete=\"new-password\" maxlength=\"12\"></div>\n              <div><button type=\"submit\" class=\"btn\">${icon('key-round')}PIN 변경</button></div>\n              <p class=\"tiny muted\">변경하면 다른 기기의 로그인도 모두 해제됩니다.</p>\n            </form></section>\n          <section class=\"card sky span-4\" aria-labelledby=\"s3\"><h2 id=\"s3\" style=\"margin-bottom:12px\">웹 앱 주소</h2>\n            ${url ? `<div class=\"stack\"><div class=\"small\">교수 관리자 화면(즐겨찾기 권장)</div>\n              <div class=\"linkbox\"><code>${esc(url)}?page=admin</code><button type=\"button\" class=\"btn sm\" data-copy-url=\"${esc(url)}?page=admin\">${icon('copy')}복사</button></div>\n              <p class=\"small\">학생 접속 주소는 [교과목] 탭의 [접속 주소]에서 교과목별로 확인하세요.</p></div>`\n              : urlNotice()}\n            <p class=\"tiny muted\" style=\"margin-top:12px\">버전 ${esc(A.data.version)}</p>\n          </section>\n        </div>`, true);\n      $('#set-form').addEventListener('submit', async (e) => {\n        e.preventDefault();\n        const data = readForm(e.target);\n        const btn = e.target.querySelector('[type=\"submit\"]');\n        const restore = CES.busyButton(btn, '저장 중…');\n        const res = await api('saveSettings', [data]);\n        restore();\n        if (!res.ok) {\n          if (res.field === 'min_responses') return CES.toast('최소 공개 응답 수는 3~50입니다.', 'error');\n          if (res.field === 'professor_name') return CES.toast('교수명을 입력하세요.', 'error');\n          if (res.field === 'departments') return CES.toast('학과를 1개 이상 입력하세요.', 'error');\n          if (res.field === 'webapp_url') { $('#s-url').setAttribute('aria-invalid', 'true'); $('#s-url').focus(); return CES.toast(res.message, 'error'); }\n          return fail(res);\n        }\n        Object.assign(A.data.settings, { professor_name: data.professor_name.trim(), affiliation: data.affiliation.trim(), min_responses: Number(data.min_responses),\n          departments: data.departments.split('\\n').map((x) => x.trim()).filter(Boolean) });\n        await refresh();\n        CES.toast('설정을 저장했습니다.');\n        if (A.tab === 'settings') renderSettings(); // 그사이 다른 탭으로 옮겼으면 화면을 되돌리지 않음\n      });\n      $('#pin-form').addEventListener('submit', async (e) => {\n        e.preventDefault();\n        const cur = $('#p-cur').value, n1 = $('#p-new').value, n2 = $('#p-new2').value;\n        if (!/^\\d{6,12}$/.test(n1)) return CES.toast('새 PIN은 숫자 6~12자리입니다.', 'error');\n        if (n1 !== n2) return CES.toast('새 PIN 확인이 일치하지 않습니다.', 'error');\n        const btn = e.target.querySelector('[type=\"submit\"]');\n        const restore = CES.busyButton(btn, '변경 중…');\n        const res = await api('changePin', [cur, n1]);\n        restore();\n        if (!res.ok) return res.code === 'WRONG' ? CES.toast('현재 PIN이 올바르지 않습니다.', 'error') : fail(res);\n        CES.toast('PIN을 변경했습니다. 다시 로그인하세요.');\n        signOut(true);\n      });\n    }\n\n    /* ───── 전역 클릭 위임 ───── */\n    view.addEventListener('click', async (e) => {\n      const t = e.target.closest('button');\n      if (!t) return;\n      if (t.dataset.go) return go(t.dataset.go);\n      if (t.dataset.results) { A.resultsCourse = t.dataset.results; return go('results'); }\n      if (t.dataset.items) { A.itemsCourse = t.dataset.items; return go('items'); }\n      if (t.dataset.export) return doExport(t.dataset.export, t);\n      if (t.dataset.pdf) return doPdf(t.dataset.pdf, t);\n      if (t.dataset.wc) {\n        A.wcKey = t.dataset.wc;\n        A.wcWord = null;\n        $$('[data-wc]', view).forEach((b) => b.setAttribute('aria-pressed', b.dataset.wc === A.wcKey));\n        return drawWordCloud();\n      }\n      if (t.hasAttribute('data-wc-clear')) { if (A.wc) A.wc.clear(); A.wcWord = null; $('#wc-hits').innerHTML = ''; return; }\n      if (t.dataset.copyUrl) return CES.copy(t.dataset.copyUrl);\n      const row = t.closest('.item-row');\n      if (row && t.dataset.move) return moveItem(Number(row.dataset.idx), Number(row.dataset.idx) + Number(t.dataset.move), `[data-move=\"${t.dataset.move}\"]`);\n      if (row && t.hasAttribute('data-del')) {\n        const i = Number(row.dataset.idx);\n        A.items.splice(i, 1);\n        markDirty();\n        drawItems();\n        CES.toast(`${i + 1}번 문항을 삭제했습니다. [저장]을 눌러 반영하세요.`);\n        return;\n      }\n      const c = t.dataset.id ? courseById(t.dataset.id) : null;\n      switch (t.dataset.act) {\n        case 'retry-boot': return boot();\n        case 'new-course': return openCourseForm(null);\n        case 'edit-course': return openCourseForm(c);\n        case 'dup-course': return openDuplicate(c);\n        case 'del-course': return deleteCourse(c);\n        case 'access': return openAccessFresh(t.dataset.id, t);\n        case 'tokens': return openTokens(c);\n        case 'report-pdf': return reportPdf(t);\n        case 'new-term': return openNewTerm();\n        case 'add-item':\n          A.items.push({ domain: A.items.length ? A.items[A.items.length - 1].domain : DOMAINS[0], text: '', type: 'likert5', required: true, reverse: false, options: [] });\n          markDirty();\n          drawItems();\n          { const el = $(`#txt-${A.items.length - 1}`); if (el) { el.focus(); el.scrollIntoView({ block: 'center' }); } }\n          return;\n        case 'clo': return openClo();\n        case 'load-template': return loadTemplate();\n        case 'save-items': return saveItems(t);\n        default: return;\n      }\n    });\n\n    let wcResize;\n    window.addEventListener('resize', () => {\n      clearTimeout(wcResize);\n      wcResize = setTimeout(() => { if (A.tab === 'results' && $('#wc')) drawWordCloud(); }, 250);\n    });\n\n    document.addEventListener('click', (e) => {\n      const b = e.target.closest('.modal [data-go]');\n      if (b) go(b.dataset.go);\n    });\n\n    $('#logout-btn').addEventListener('click', () => signOut(false));\n    window.addEventListener('beforeunload', (e) => {\n      if (A.itemsDirty) { e.preventDefault(); e.returnValue = ''; }\n    });\n\n    if (A.session) boot(); else renderLogin();\n  })();\n  </script>\n</body>\n</html>\n",
 "Styles": "<style>\n/* ==========================================================\n   Cloud Dancer Bento — 강의평가 Studio 디자인 시스템\n   ========================================================== */\n:root {\n  --bg: #F5F3EF;\n  --surface: #FFFFFF;\n  --surface-2: #FAF9F6;\n  --ink: #18181B;\n  --muted: #6B6B76;\n  --line: #E7E4DE;\n  --line-strong: #D6D2CA;\n  --control: #8A867E;           /* 입력·칩 경계(WCAG 1.4.11 비텍스트 대비 3:1) */\n  --primary: #5B4BFF;\n  --primary-ink: #4536E6;       /* 링크·작은 텍스트용(대비 강화) */\n  --primary-soft: #ECE9FF;\n  --on-primary: #FFFFFF;\n  --accent: #FF6B4A;            /* 장식·강조 배지 전용 — 본문 텍스트 금지 */\n  --accent-soft: #FFE5DE;\n  --butter: #FFE8A3;\n  --mint: #DDF3E4;              /* 강점 카드(옅은 초록) */\n  --sky: #DCEBFF;\n  --danger: #E5484D;\n  --danger-ink: #C62A2F;\n  --danger-soft: #FDECEC;\n  --focus: #5B4BFF;\n  --shadow: 0 1px 2px rgba(24, 24, 27, .04), 0 4px 16px rgba(24, 24, 27, .04);\n  --radius: 24px;\n  --radius-sm: 14px;\n  --radius-pill: 999px;\n  --spring: cubic-bezier(.34, 1.56, .64, 1);\n  --ease: cubic-bezier(.2, .7, .2, 1);\n  /* 리커트 분포(발산형: 코랄 ↔ 회색 중앙 ↔ 아이리스) — dataviz 검증기로 인접 ΔE(정상≥15, CVD≥8) 확인 */\n  --lk1: #B4321A;\n  --lk2: #EE7B60;\n  --lk3: #C6C2BA;\n  --lk4: #9184FF;\n  --lk5: #5B4BFF;\n  --chart-muted: #8E8B95;\n  color-scheme: light;\n}\n\n@media (prefers-color-scheme: dark) {\n  :root:not([data-theme=\"light\"]) {\n    --bg: #121214;\n    --surface: #1C1C20;\n    --surface-2: #232328;\n    --ink: #F2F1EE;\n    --muted: #A6A5AE;\n    --line: #2E2E34;\n    --line-strong: #3C3C44;\n    --control: #74737C;\n    --primary: #8B80FF;\n    --primary-ink: #A79EFF;\n    --primary-soft: #2A2650;\n    --on-primary: #121214;\n    --accent: #FF8466;\n    --accent-soft: #3D231C;\n    --butter: #4A3F1C;\n    --mint: #1E3A2A;\n    --sky: #1D2C42;\n    --danger: #FF6B70;\n    --danger-ink: #FF8A8E;\n    --danger-soft: #3A1D1F;\n    --focus: #A79EFF;\n    --shadow: 0 1px 2px rgba(0, 0, 0, .3);\n    --lk1: #F2876C;\n    --lk2: #B04A36;\n    --lk3: #47454C;\n    --lk4: #6156C8;\n    --lk5: #B0A8FF;\n    --chart-muted: #85848D;\n    color-scheme: dark;\n  }\n}\n\n*, *::before, *::after { box-sizing: border-box; }\nhtml { -webkit-text-size-adjust: 100%; }\nbody {\n  margin: 0;\n  background: var(--bg);\n  color: var(--ink);\n  font-family: \"Pretendard Variable\", Pretendard, -apple-system, BlinkMacSystemFont, \"Apple SD Gothic Neo\", \"Noto Sans KR\", \"Malgun Gothic\", system-ui, sans-serif;\n  font-size: 16px;\n  font-weight: 400;\n  line-height: 1.6;\n  word-break: keep-all;\n  overflow-wrap: anywhere;\n  -webkit-font-smoothing: antialiased;\n  min-height: 100vh;\n  display: flex;\n  flex-direction: column;\n}\nh1, h2, h3, h4 { font-weight: 700; line-height: 1.3; margin: 0; letter-spacing: -0.01em; }\nh1 { font-size: clamp(1.5rem, 1.2rem + 1.4vw, 2rem); }\nh2 { font-size: 1.25rem; }\nh3 { font-size: 1.0625rem; }\np { margin: 0; }\na { color: var(--primary-ink); text-underline-offset: 3px; }\nbutton, input, select, textarea { font: inherit; color: inherit; }\nimg, svg { display: block; max-width: 100%; }\n.num, .tabular { font-variant-numeric: tabular-nums; }\n.muted { color: var(--muted); }\n.small { font-size: .875rem; }\n.tiny { font-size: .8125rem; }\n.center { text-align: center; }\n.stack > * + * { margin-top: 12px; }\n.stack-lg > * + * { margin-top: 20px; }\n.row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }\n.row-between { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }\n.grow { flex: 1 1 auto; min-width: 0; }\n.hidden { display: none !important; }\n\n.sr-only {\n  position: absolute !important; width: 1px; height: 1px; padding: 0; margin: -1px;\n  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;\n}\n.skip-link {\n  position: absolute; left: 12px; top: -48px; z-index: 100;\n  background: var(--ink); color: var(--bg); padding: 8px 14px; border-radius: 10px; text-decoration: none;\n}\n.skip-link:focus { top: 12px; }\n\n:focus { outline: none; }\n/* 화면 낭독기용으로 프로그램이 옮긴 포커스(제목 등 비대화형)에는 테두리를 그리지 않음 */\n[tabindex=\"-1\"]:focus { outline: none; }\n:focus-visible {\n  outline: 3px solid var(--focus);\n  outline-offset: 2px;\n  border-radius: 10px;\n}\n\n/* ───── 레이아웃 ───── */\n.topbar {\n  position: sticky; top: 0; z-index: 20;\n  background: color-mix(in srgb, var(--bg) 92%, transparent);\n  border-bottom: 1px solid var(--line);\n}\n@supports not (background: color-mix(in srgb, red 50%, blue)) { .topbar { background: var(--bg); } }\n.topbar-inner {\n  max-width: 1200px; margin: 0 auto; padding: 10px 16px;\n  display: flex; align-items: center; gap: 12px; min-height: 56px;\n}\n.brand { display: flex; align-items: center; gap: 10px; font-weight: 700; letter-spacing: -0.01em; }\n.brand-mark {\n  width: 32px; height: 32px; border-radius: 10px; background: var(--primary); color: var(--on-primary);\n  display: grid; place-items: center; flex: none;\n}\n.brand-mark svg { width: 18px; height: 18px; }\n.brand small { display: block; font-weight: 400; font-size: .75rem; color: var(--muted); line-height: 1.2; }\n\n.wrap { width: 100%; max-width: 1200px; margin: 0 auto; padding: 20px 16px 32px; flex: 1 0 auto; }\n.wrap.narrow { max-width: 640px; }\n.wrap.medium { max-width: 880px; }\n\n.footer {\n  border-top: 1px solid var(--line);\n  padding: 20px 16px calc(20px + env(safe-area-inset-bottom));\n  text-align: center; color: var(--muted); font-size: .875rem;\n}\n.footer .owner { color: var(--ink); font-weight: 600; }\n.footer .credit { font-size: .75rem; margin-top: 4px; }\n.footer .disclaimer {\n  max-width: 640px; margin: 10px auto 0; font-size: .75rem; line-height: 1.5;\n}\n\n/* ───── 카드·벤토 ───── */\n.card {\n  background: var(--surface);\n  border: 1px solid var(--line);\n  border-radius: var(--radius);\n  box-shadow: var(--shadow);\n  padding: 20px;\n  min-width: 0;\n}\n.card.pad-lg { padding: 28px; }\n.card.soft { background: var(--primary-soft); border-color: transparent; }\n.card.butter { background: var(--butter); border-color: transparent; }\n.card.mint { background: var(--mint); border-color: transparent; }\n.card.sky { background: var(--sky); border-color: transparent; }\n.card.interactive { transition: transform .2s var(--ease), box-shadow .2s var(--ease), border-color .2s; cursor: pointer; }\n.card.interactive:hover { transform: translateY(-2px); border-color: var(--line-strong); }\n.card-title { display: flex; align-items: center; gap: 8px; font-size: .9375rem; font-weight: 600; color: var(--muted); }\n.card-title svg { width: 18px; height: 18px; }\n\n.bento {\n  display: grid;\n  grid-template-columns: repeat(1, minmax(0, 1fr));\n  gap: 12px;\n}\n@media (min-width: 640px) {\n  .bento { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }\n  .span-2 { grid-column: span 2; }\n}\n@media (min-width: 1000px) {\n  .bento { grid-template-columns: repeat(4, minmax(0, 1fr)); }\n  .span-3 { grid-column: span 3; }\n  .span-4 { grid-column: span 4; }\n  .row-2 { grid-row: span 2; }\n}\n@media (min-width: 640px) and (max-width: 999px) {\n  .span-3, .span-4 { grid-column: span 2; }\n}\n\n.big-num {\n  font-size: clamp(48px, 9vw, 64px);\n  font-weight: 700; line-height: 1; letter-spacing: -0.03em;\n  font-variant-numeric: tabular-nums;\n}\n.big-num .unit { font-size: .4em; font-weight: 600; color: var(--muted); margin-left: 4px; letter-spacing: 0; }\n.mid-num { font-size: 2rem; font-weight: 700; line-height: 1.1; font-variant-numeric: tabular-nums; }\n\n/* ───── 배지 ───── */\n.badge {\n  display: inline-flex; align-items: center; gap: 6px;\n  padding: 4px 10px; border-radius: var(--radius-pill);\n  font-size: .8125rem; font-weight: 600; line-height: 1.4;\n  background: var(--surface-2); color: var(--ink); border: 1px solid var(--line);\n  white-space: nowrap;\n}\n.badge svg { width: 14px; height: 14px; }\n.badge.open { background: var(--primary-soft); color: var(--primary-ink); border-color: transparent; }\n.badge.ready { background: var(--sky); color: var(--ink); border-color: transparent; }\n.badge.closed { background: var(--surface-2); color: var(--muted); }\n.badge.hot { background: var(--accent-soft); color: var(--ink); border-color: transparent; }\n.badge.hot .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); }\n.badge.warn { background: var(--butter); color: var(--ink); border-color: transparent; }\n.badge.danger { background: var(--danger-soft); color: var(--danger-ink); border-color: transparent; }\n\n/* ───── 버튼 ───── */\n.btn {\n  display: inline-flex; align-items: center; justify-content: center; gap: 8px;\n  min-height: 48px; padding: 0 20px;\n  border-radius: var(--radius-pill);\n  border: 1px solid var(--control);\n  background: var(--surface); color: var(--ink);\n  font-weight: 600; cursor: pointer; text-decoration: none;\n  transition: transform .15s var(--ease), background .15s, border-color .15s;\n  -webkit-tap-highlight-color: transparent;\n}\n.btn svg { width: 18px; height: 18px; flex: none; }\n.btn:hover { border-color: var(--ink); }\n.btn:active { transform: scale(.98); }\n.btn.primary { background: var(--primary); color: var(--on-primary); border-color: var(--primary); }\n.btn.primary:hover { background: var(--primary-ink); border-color: var(--primary-ink); }\n.btn.ghost { background: transparent; border-color: transparent; }\n.btn.ghost:hover { background: var(--surface-2); }\n.btn.danger { color: var(--danger-ink); border-color: var(--danger-soft); background: var(--danger-soft); }\n.btn.sm { min-height: 40px; padding: 0 14px; font-size: .875rem; }\n.btn.icon { width: 44px; min-height: 44px; padding: 0; }\n.btn.sm.icon { width: 40px; min-height: 40px; }\n.btn.block { width: 100%; }\n.btn[disabled], .btn[aria-disabled=\"true\"] { opacity: .5; cursor: not-allowed; transform: none; }\n.btn .spinner { width: 18px; height: 18px; }\n\n/* ───── 폼 ───── */\n.field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }\n.field > label, .field-label { font-weight: 600; font-size: .9375rem; }\n.field .hint { font-size: .8125rem; color: var(--muted); }\n.field .error { font-size: .8125rem; color: var(--danger-ink); font-weight: 600; }\n.input, .select, .textarea {\n  width: 100%; min-height: 48px; padding: 10px 14px;\n  border: 1px solid var(--control); border-radius: var(--radius-sm);\n  background: var(--surface); color: var(--ink);\n  transition: border-color .15s, box-shadow .15s;\n}\n.textarea { min-height: 120px; resize: vertical; line-height: 1.6; }\n.input:focus-visible, .select:focus-visible, .textarea:focus-visible {\n  outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-soft);\n}\n.input[aria-invalid=\"true\"], .textarea[aria-invalid=\"true\"] { border-color: var(--danger); }\n.input.code {\n  font-size: 1.375rem; letter-spacing: .18em; text-align: center; font-weight: 700;\n  font-variant-numeric: tabular-nums; text-transform: uppercase;\n}\n.form-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }\n@media (min-width: 640px) { .form-grid.two { grid-template-columns: 1fr 1fr; } .form-grid .full { grid-column: 1 / -1; } }\n.check { display: inline-flex; align-items: center; gap: 8px; min-height: 40px; cursor: pointer; }\n.check input { width: 20px; height: 20px; accent-color: var(--primary); }\n\n/* ───── 칩(리커트·선택지) ───── */\n.likert {\n  display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px;\n  margin: 0; padding: 0; border: 0;\n}\n.chip {\n  position: relative;\n  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;\n  min-height: 64px; min-width: 48px; padding: 8px 4px;\n  border: 1px solid var(--control); border-radius: 18px;\n  background: var(--surface); color: var(--ink);\n  cursor: pointer; text-align: center; line-height: 1.25;\n  -webkit-tap-highlight-color: transparent;\n  transition: border-color .15s, background .15s, color .15s;\n}\n.chip .n { font-size: 1.25rem; font-weight: 700; font-variant-numeric: tabular-nums; }\n.chip .l { font-size: .6875rem; color: var(--muted); }\n.chip:hover { border-color: var(--primary); }\n.chip[aria-checked=\"true\"], .chip[aria-pressed=\"true\"] {\n  background: var(--primary); border-color: var(--primary); color: var(--on-primary);\n}\n.chip[aria-checked=\"true\"] .l, .chip[aria-pressed=\"true\"] .l { color: var(--on-primary); }\n.chip.pop { animation: chip-pop .38s var(--spring); }\n@keyframes chip-pop { 0% { transform: scale(.97); } 100% { transform: scale(1); } }\n.likert-scale { display: flex; justify-content: space-between; font-size: .75rem; color: var(--muted); margin-top: 6px; }\n@media (min-width: 480px) { .chip .l { font-size: .75rem; } }\n\n.option-list { display: grid; gap: 8px; }\n.option {\n  display: flex; align-items: center; gap: 12px; min-height: 52px; padding: 10px 16px;\n  border: 1px solid var(--control); border-radius: 16px; background: var(--surface);\n  cursor: pointer; text-align: left; width: 100%;\n  transition: border-color .15s, background .15s;\n}\n.option .mark {\n  width: 22px; height: 22px; flex: none; border: 2px solid var(--control); border-radius: 50%;\n  display: grid; place-items: center;\n}\n.option.multi .mark { border-radius: 6px; }\n.option[aria-checked=\"true\"] { border-color: var(--primary); background: var(--primary-soft); }\n.option[aria-checked=\"true\"] .mark { border-color: var(--primary); background: var(--primary); }\n.option[aria-checked=\"true\"] .mark::after {\n  content: \"\"; width: 8px; height: 8px; border-radius: 50%; background: var(--on-primary);\n}\n.option.multi[aria-checked=\"true\"] .mark::after { width: 10px; height: 6px; border-radius: 0; background: none;\n  border-left: 2px solid var(--on-primary); border-bottom: 2px solid var(--on-primary); transform: rotate(-45deg) translate(1px, -1px); }\n\n/* ───── 진행 바 ───── */\n.progress {\n  height: 8px; border-radius: var(--radius-pill); background: var(--line); overflow: hidden;\n}\n.progress > span {\n  display: block; height: 100%; width: 0; background: var(--primary); border-radius: inherit;\n  transition: width .45s var(--ease);\n}\n.progress.thin { height: 6px; }\n\n/* ───── 설문 ───── */\n.survey-head { position: sticky; top: 56px; z-index: 10; background: var(--bg); padding: 8px 0 12px; }\n.q-card .q-domain { font-size: .8125rem; font-weight: 600; color: var(--primary-ink); }\n.q-card .q-text { font-size: 1.1875rem; font-weight: 700; line-height: 1.45; margin: 6px 0 16px; }\n.q-card .req { color: var(--danger-ink); font-weight: 700; margin-left: 4px; }\n.q-card + .q-card { margin-top: 12px; }\n.q-card.invalid { border-color: var(--danger); }\n.q-error { color: var(--danger-ink); font-size: .875rem; font-weight: 600; margin-top: 8px; }\n.nav-bar {\n  position: sticky; bottom: 0; z-index: 10;\n  display: flex; gap: 8px; padding: 12px 0 calc(12px + env(safe-area-inset-bottom));\n  background: linear-gradient(to top, var(--bg) 75%, transparent);\n}\n.nav-bar .btn { flex: 1; }\n.counter { font-size: .8125rem; color: var(--muted); text-align: right; margin-top: 4px; font-variant-numeric: tabular-nums; }\n.kbd {\n  display: inline-block; min-width: 22px; padding: 0 6px; border: 1px solid var(--line-strong);\n  border-bottom-width: 2px; border-radius: 6px; font-size: .75rem; text-align: center; background: var(--surface);\n}\n\n.review-list { list-style: none; margin: 0; padding: 0; }\n.review-list li { display: flex; gap: 12px; padding: 12px 0; border-top: 1px solid var(--line); align-items: flex-start; }\n.review-list li:first-child { border-top: 0; }\n.review-list .ans { margin-left: auto; font-weight: 700; text-align: right; flex: none; max-width: 45%; }\n.review-list .ans.missing { color: var(--danger-ink); }\n.review-list .ans.text { font-weight: 400; color: var(--muted); white-space: pre-wrap; }\n\n.notice-icon {\n  width: 72px; height: 72px; border-radius: 24px; display: grid; place-items: center; margin: 0 auto 16px;\n  background: var(--primary-soft); color: var(--primary-ink);\n}\n.notice-icon svg { width: 34px; height: 34px; }\n.notice-icon.warn { background: var(--butter); color: var(--ink); }\n.notice-icon.danger { background: var(--danger-soft); color: var(--danger-ink); }\n\n.feature-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }\n.feature-list li { display: flex; gap: 12px; align-items: flex-start; }\n.feature-list .ico {\n  width: 36px; height: 36px; border-radius: 12px; display: grid; place-items: center; flex: none;\n  background: var(--primary-soft); color: var(--primary-ink);\n}\n.feature-list .ico svg { width: 18px; height: 18px; }\n\n.meta { display: flex; flex-wrap: wrap; gap: 6px; }\n\n/* ───── 탭 ───── */\n.tabs {\n  display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none;\n  padding: 4px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-pill);\n}\n.tabs::-webkit-scrollbar { display: none; }\n.tab {\n  display: inline-flex; align-items: center; gap: 6px; flex: none;\n  min-height: 40px; padding: 0 14px; border: 0; border-radius: var(--radius-pill);\n  background: transparent; color: var(--muted); font-weight: 600; cursor: pointer; white-space: nowrap;\n}\n.tab svg { width: 16px; height: 16px; }\n.tab[aria-selected=\"true\"] { background: var(--primary); color: var(--on-primary); }\n.tab:hover:not([aria-selected=\"true\"]) { color: var(--ink); background: var(--surface-2); }\n\n/* ───── 표 ───── */\n.table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }\ntable.data { width: 100%; border-collapse: collapse; font-size: .9375rem; }\ntable.data th, table.data td { padding: 10px 8px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }\ntable.data th { font-size: .8125rem; color: var(--muted); font-weight: 600; white-space: nowrap; }\ntable.data td.num, table.data th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }\ntable.data tr:last-child td { border-bottom: 0; }\n\n/* ───── 리커트 분포 막대(2px 표면 간격) ───── */\n.dist { display: flex; height: 14px; min-width: 120px; border-radius: 4px; overflow: hidden; gap: 2px; background: var(--surface); }\n.dist > span { display: block; height: 100%; min-width: 0; }\n.dist .d1 { background: var(--lk1); } .dist .d2 { background: var(--lk2); } .dist .d3 { background: var(--lk3); }\n.dist .d4 { background: var(--lk4); } .dist .d5 { background: var(--lk5); }\n.legend { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: .8125rem; color: var(--muted); }\n.legend i { display: inline-block; width: 12px; height: 12px; border-radius: 3px; margin-right: 6px; vertical-align: -1px; }\n.hbar { display: flex; align-items: center; gap: 8px; }\n.hbar .track { flex: 1; height: 10px; background: var(--line); border-radius: 4px; overflow: hidden; }\n.hbar .fill { height: 100%; background: var(--primary); border-radius: 4px; }\n.meter { height: 8px; border-radius: 4px; background: var(--line); overflow: hidden; }\n.meter > span { display: block; height: 100%; background: var(--primary); border-radius: 4px; }\n\n.chart-box { position: relative; width: 100%; min-height: 260px; }\n.chart-box canvas { max-width: 100%; }\n\n/* ───── 서술형 ───── */\n.quote-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }\ndetails > summary { list-style: none; cursor: pointer; }\ndetails > summary::-webkit-details-marker { display: none; }\n.quote-list li {\n  padding: 12px 14px; border-radius: 16px; background: var(--surface-2); border: 1px solid var(--line);\n  white-space: pre-wrap; line-height: 1.55;\n}\n\n/* ───── 문항 편집기 ───── */\n.item-row {\n  display: grid; grid-template-columns: 32px 1fr; gap: 8px 12px; align-items: start;\n  padding: 14px; border: 1px solid var(--line); border-radius: 18px; background: var(--surface);\n}\n.item-row + .item-row { margin-top: 8px; }\n.item-row.dragging { opacity: .5; }\n.item-row.is-hidden { background: var(--surface-2); border-style: dashed; }\n.item-row.drop-before { box-shadow: 0 -3px 0 var(--primary); }\n.item-row.drop-after { box-shadow: 0 3px 0 var(--primary); }\n.drag-handle {\n  width: 32px; height: 44px; display: grid; place-items: center; color: var(--muted);\n  cursor: grab; border-radius: 10px; border: 0; background: transparent;\n}\n.drag-handle:active { cursor: grabbing; }\n.item-fields { display: grid; gap: 8px; min-width: 0; }\n.item-fields .line { display: grid; grid-template-columns: 1fr; gap: 8px; }\n@media (min-width: 720px) { .item-fields .line { grid-template-columns: 180px 1fr 150px; } }\n.item-tools { display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: center; }\n.item-index { font-weight: 700; color: var(--muted); font-variant-numeric: tabular-nums; font-size: .875rem; text-align: center; }\n\n/* ───── 토스트·로딩·모달 ───── */\n.toast-host {\n  position: fixed; left: 50%; bottom: calc(24px + env(safe-area-inset-bottom)); transform: translateX(-50%);\n  z-index: 200; display: grid; gap: 8px; width: min(92vw, 420px); pointer-events: none;\n}\n.toast {\n  background: var(--ink); color: var(--bg); padding: 12px 16px; border-radius: 16px;\n  font-weight: 600; font-size: .9375rem; box-shadow: 0 8px 24px rgba(0,0,0,.18);\n  animation: toast-in .25s var(--ease); pointer-events: auto;\n}\n.toast.error { background: var(--danger-ink); color: #fff; }\n@keyframes toast-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }\n\n.loading-bar {\n  position: fixed; top: 0; left: 0; right: 0; height: 3px; z-index: 300; overflow: hidden;\n  background: transparent; pointer-events: none;\n}\n.loading-bar::after {\n  content: \"\"; position: absolute; top: 0; bottom: 0; left: -40%; width: 40%;\n  background: var(--primary); border-radius: 3px; animation: loading 1.1s var(--ease) infinite;\n}\n@keyframes loading { to { left: 100%; } }\n.spinner {\n  width: 28px; height: 28px; border-radius: 50%;\n  border: 3px solid var(--primary-soft); border-top-color: var(--primary);\n  animation: spin .8s linear infinite;\n}\n@keyframes spin { to { transform: rotate(360deg); } }\n.skeleton { border-radius: var(--radius); background: var(--surface); border: 1px solid var(--line); min-height: 120px; position: relative; overflow: hidden; }\n.skeleton::after {\n  content: \"\"; position: absolute; inset: 0;\n  background: linear-gradient(90deg, transparent, var(--surface-2), transparent);\n  animation: shimmer 1.4s infinite; transform: translateX(-100%);\n}\n@keyframes shimmer { to { transform: translateX(100%); } }\n\n.modal-backdrop {\n  position: fixed; inset: 0; z-index: 150; background: rgba(18, 18, 20, .45);\n  display: flex; align-items: flex-end; justify-content: center; padding: 0;\n  animation: fade .2s var(--ease);\n}\n@media (min-width: 640px) { .modal-backdrop { align-items: center; padding: 24px; } }\n.modal {\n  background: var(--surface); width: 100%; max-width: 640px; max-height: 92vh; overflow: auto;\n  border-radius: var(--radius) var(--radius) 0 0; padding: 22px 20px calc(20px + env(safe-area-inset-bottom));\n  border: 1px solid var(--line);\n  animation: rise .28s var(--ease);\n}\n.modal.wide { max-width: 980px; }\n@media (min-width: 640px) { .modal { border-radius: var(--radius); padding: 28px; } }\n.modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 16px; }\n.modal-foot { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; margin-top: 20px; }\n@keyframes fade { from { opacity: 0; } }\n@keyframes rise { from { transform: translateY(16px); opacity: 0; } }\n\n.confetti-canvas { position: fixed; inset: 0; pointer-events: none; z-index: 250; }\n\n.linkbox {\n  display: flex; gap: 8px; align-items: center; padding: 8px 8px 8px 14px; border: 1px solid var(--line-strong);\n  border-radius: var(--radius-sm); background: var(--surface-2); font-size: .875rem;\n}\n.linkbox code { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n\n.empty { text-align: center; padding: 40px 16px; color: var(--muted); }\n.empty svg { width: 40px; height: 40px; margin: 0 auto 12px; color: var(--line-strong); }\n\n.callout { display: flex; gap: 12px; padding: 14px 16px; border-radius: 18px; background: var(--butter); color: var(--ink); align-items: flex-start; }\n.callout.info { background: var(--sky); }\n.callout > div, .callout > p { min-width: 0; } /* 긴 내용이 상자를 넘지 않게 */\n.callout svg { width: 20px; height: 20px; flex: none; margin-top: 2px; }\n\n.present {\n  position: fixed; inset: 0; z-index: 400; background: var(--surface); display: flex; flex-direction: column;\n  align-items: center; justify-content: center; gap: 24px; padding: 24px; text-align: center;\n}\n.addr-box { background: var(--surface-2); border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; }\n.addr-box code { display: block; margin-top: 4px; font-size: 14px; word-break: break-all; user-select: all; }\n.addr-box .addr-long { word-break: break-all; }\n.linklike { background: none; border: 0; padding: 4px 2px; color: var(--muted); text-decoration: underline; text-underline-offset: 3px; font: inherit; cursor: pointer; min-height: 24px; }\n.linklike:hover { color: var(--ink); }\n.present .addr-big { font-size: clamp(16px, 2.6vw, 34px); font-weight: 600; word-break: break-all; max-width: 90vw; user-select: all; }\n.present .code-big { font-size: clamp(40px, 8vw, 96px); font-weight: 700; letter-spacing: .12em; font-variant-numeric: tabular-nums; }\n\n/* ───── 토큰 인쇄 시트(A4 절취형) ───── */\n#print-area { display: none; }\n.slips { display: grid; grid-template-columns: repeat(3, 1fr); }\n.slip {\n  border: 1px dashed #9a9a9a; padding: 4mm; height: 33mm; display: flex; gap: 3mm; align-items: center;\n  break-inside: avoid; color: #000; background: #fff; font-family: inherit;\n}\n.slip .u { font-size: 6pt; color: #444; word-break: break-all; margin-top: .6mm; }\n.slip .t { font-size: 15pt; font-weight: 700; letter-spacing: .06em; font-variant-numeric: tabular-nums; }\n.slip .c { font-size: 7.5pt; line-height: 1.3; }\n.slip .g { font-size: 6.5pt; color: #444; margin-top: 1mm; }\n\n@media print {\n  @page { size: A4; margin: 10mm; }\n  body.printing > *:not(#print-area) { display: none !important; }\n  body.printing #print-area { display: block !important; }\n  body.printing { background: #fff; }\n}\n\n\n/* ==========================================================\n   v1.1 — 다이나믹 요소(학생 화면) · 시각화(교수 대시보드)\n   글래스·네온 글로우·그라데이션 텍스트는 사용하지 않습니다.\n   ========================================================== */\n\n/* ───── 떠다니는 배경 장식(학생 화면) ───── */\n.deco { position: fixed; inset: 0; z-index: -1; overflow: hidden; pointer-events: none; }\n.deco span {\n  position: absolute; display: block; border-radius: 40%; opacity: .9;\n  animation: drift 18s ease-in-out infinite alternate;\n}\n.deco .s1 { width: 220px; height: 220px; background: var(--primary-soft); top: -60px; right: -70px; border-radius: 46% 54% 60% 40%; }\n.deco .s2 { width: 140px; height: 140px; background: var(--butter); bottom: 12%; left: -50px; border-radius: 50%; animation-duration: 22s; }\n.deco .s3 { width: 90px; height: 90px; background: var(--sky); top: 38%; right: -28px; border-radius: 28px; animation-duration: 16s; animation-delay: -4s; }\n.deco .s4 { width: 54px; height: 54px; background: var(--accent-soft); top: 18%; left: 8%; border-radius: 18px; animation-duration: 14s; animation-delay: -8s; }\n@keyframes drift {\n  0% { transform: translate(0, 0) rotate(0deg); }\n  50% { transform: translate(18px, 26px) rotate(18deg); }\n  100% { transform: translate(-14px, 10px) rotate(-12deg); }\n}\nbody.page-student, body.page-admin { background: var(--bg); position: relative; isolation: isolate; }\n/* 슬라이드 전환 중 잠깐 생기는 가로 넘침 차단(clip은 sticky 헤더를 깨지 않음) */\n.page-student main.wrap { overflow-x: clip; }\n\n/* ───── 등장 애니메이션(순차) ───── */\n.rise { animation: rise-in .55s var(--ease) both; animation-delay: calc(var(--i, 0) * 70ms); }\n@keyframes rise-in { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }\n.slide-in-r { animation: slide-r .38s var(--ease) both; }\n.slide-in-l { animation: slide-l .38s var(--ease) both; }\n@keyframes slide-r { from { opacity: 0; transform: translateX(32px); } to { opacity: 1; transform: none; } }\n@keyframes slide-l { from { opacity: 0; transform: translateX(-32px); } to { opacity: 1; transform: none; } }\n\n/* ───── 인트로 스티커 타일 ───── */\n.stickers { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }\n.sticker {\n  aspect-ratio: 1 / 1; border-radius: 22px; display: grid; place-items: center; gap: 4px; text-align: center;\n  font-size: .75rem; font-weight: 600; color: var(--ink); padding: 8px;\n  animation: bob 3.6s ease-in-out infinite; animation-delay: calc(var(--i, 0) * -1.2s);\n}\n.sticker .emo { font-size: 1.75rem; line-height: 1; }\n.sticker:nth-child(1) { background: var(--primary-soft); }\n.sticker:nth-child(2) { background: var(--butter); }\n.sticker:nth-child(3) { background: var(--sky); }\n@keyframes bob { 0%, 100% { transform: translateY(0) rotate(-1.5deg); } 50% { transform: translateY(-6px) rotate(1.5deg); } }\n\n/* ───── 영역 배지(문항 상단) ───── */\n.domain-tag {\n  display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px 4px 6px; border-radius: var(--radius-pill);\n  font-size: .8125rem; font-weight: 700; color: var(--ink);\n}\n.domain-tag .ic { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; background: var(--surface); }\n.domain-tag .ic svg { width: 15px; height: 15px; }\n.tone-primary { background: var(--primary-soft); } .tone-butter { background: var(--butter); }\n.tone-sky { background: var(--sky); } .tone-accent { background: var(--accent-soft); } .tone-plain { background: var(--surface-2); }\n\n/* ───── 이모지 리커트 칩 ───── */\n.chip .emo { font-size: 1.5rem; line-height: 1; transition: transform .25s var(--spring); }\n.chip:hover .emo { transform: scale(1.15) rotate(-6deg); }\n.chip[aria-checked=\"true\"] .emo { animation: emo-bounce .6s var(--spring); }\n.chip.has-emo { min-height: 84px; }\n@keyframes emo-bounce { 0% { transform: scale(.6); } 60% { transform: scale(1.25); } 100% { transform: scale(1); } }\n\n/* ───── 진행 바 마커·응원 ───── */\n.progress-wrap { position: relative; }\n.progress-marker {\n  position: absolute; top: 50%; width: 24px; height: 24px; margin-left: -12px; margin-top: -12px; border-radius: 50%;\n  background: var(--surface); border: 2px solid var(--primary); display: grid; place-items: center; font-size: 12px;\n  transition: left .45s var(--ease); left: 0;\n}\n.cheer {\n  display: inline-flex; align-items: center; gap: 8px; margin: 0 0 12px; padding: 8px 14px; border-radius: var(--radius-pill);\n  background: var(--butter); color: var(--ink); font-weight: 700; font-size: .875rem;\n  animation: cheer-pop .5s var(--spring) both;\n}\n@keyframes cheer-pop { from { opacity: 0; transform: scale(.8) translateY(6px); } to { opacity: 1; transform: none; } }\n\n/* ───── 드롭다운(select) ───── */\n.select {\n  appearance: none; -webkit-appearance: none; padding-right: 44px; cursor: pointer;\n  background-image: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%236B6B76' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\");\n  background-repeat: no-repeat; background-position: right 14px center;\n}\n.select.lg { min-height: 56px; font-size: 1.0625rem; font-weight: 600; }\n\n/* ───── 체크 그리기(감사 화면) ───── */\n.check-draw { width: 96px; height: 96px; margin: 0 auto; }\n.check-draw circle { fill: var(--primary-soft); stroke: var(--primary); stroke-width: 4; stroke-dasharray: 290; stroke-dashoffset: 290; animation: draw .7s var(--ease) forwards; }\n.check-draw path { fill: none; stroke: var(--primary); stroke-width: 7; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 80; stroke-dashoffset: 80; animation: draw .45s .55s var(--ease) forwards; }\n@keyframes draw { to { stroke-dashoffset: 0; } }\n\n/* ───── 링 게이지 ───── */\n.ring { display: block; position: relative; width: 132px; height: 132px; flex: none; margin: 0 auto; }\n.ring.sm { width: 76px; height: 76px; }\n.ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }\n.ring .ring-bg { fill: none; stroke: var(--line); stroke-width: 9; }\n.ring .ring-fg { fill: none; stroke: var(--primary); stroke-width: 9; stroke-linecap: round; transition: stroke-dashoffset 1.1s var(--ease); }\n.ring .ring-fg.coral { stroke: var(--lk1); }\n.ring .ring-fg.ink { stroke: var(--primary-ink); }\n.ring.sm .ring-bg, .ring.sm .ring-fg { stroke-width: 11; }\n.ring-label { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; line-height: 1.1; }\n.ring-label strong { font-size: 1.75rem; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }\n.ring.sm .ring-label strong { font-size: 1rem; }\n.ring-label > span { display: block; font-size: .75rem; color: var(--muted); margin-top: 2px; }\n.count-chip {\n  width: 76px; height: 76px; border-radius: 50%; flex: none; display: grid; place-content: center; text-align: center;\n  background: var(--primary-soft); color: var(--primary-ink); line-height: 1.1;\n}\n.count-chip strong { display: block; font-size: 1.25rem; font-weight: 700; font-variant-numeric: tabular-nums; }\n.count-chip span { display: block; font-size: .6875rem; }\n.kpi-ring { display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; }\n.kpi-ring .cap { font-size: .875rem; font-weight: 600; }\n.kpi-ring .sub { font-size: .75rem; color: var(--muted); max-width: 220px; }\n\n/* ───── 가로 막대(영역 평균) ───── */\n.hbars { display: grid; gap: 10px; }\n.hbars .r { display: grid; grid-template-columns: minmax(96px, 34%) 1fr 48px; align-items: center; gap: 10px; font-size: .875rem; }\n.hbars .lab { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.hbars .track { position: relative; height: 14px; background: var(--line); border-radius: 4px; overflow: visible; }\n.hbars .fill { height: 100%; width: 0; border-radius: 4px; background: var(--primary); transition: width 1s var(--ease); }\n.hbars .fill.low { background: var(--lk1); }\n.hbars .ref { position: absolute; top: -4px; bottom: -4px; width: 2px; background: var(--ink); opacity: .55; border-radius: 1px; }\n.hbars .val { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }\n.hbars .dist { height: 14px; }\n.hbars .dist > span { transition: flex-grow 1s var(--ease); }\n\n/* ───── 교과목 한눈에(대시보드) ───── */\n.warn-text { color: var(--danger-ink); }\n.ai-panel h3 { display: flex; gap: 6px; align-items: center; }\n/* 교수자 관리 화면: 환영 배너·제목 타일·카드 반응·화면 전환 */\n.page-admin main.wrap { overflow-x: clip; }\n.hero { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 20px; align-items: center; margin-bottom: 18px;\n  padding: 24px 26px; border-radius: 28px; background: linear-gradient(135deg, var(--primary-soft) 0%, var(--sky) 100%); position: relative; overflow: hidden; }\n.hero::after { content: ''; position: absolute; width: 180px; height: 180px; right: -50px; bottom: -70px; border-radius: 46% 54% 60% 40%; background: var(--butter); opacity: .7; z-index: 0; animation: drift 20s ease-in-out infinite; }\n.hero > * { position: relative; z-index: 1; min-width: 0; }\n.hero h1 { font-size: clamp(1.35rem, 2.6vw, 1.9rem); margin: 4px 0 6px; text-wrap: balance; }\n.hero-date { font-size: .8125rem; color: var(--muted); letter-spacing: .02em; margin: 0; }\n.hero-sub { margin: 0; color: var(--ink); opacity: .85; }\n.hero-actions { margin-top: 14px; }\n.hero-stickers .sticker { background: var(--surface) !important; box-shadow: var(--shadow); }\n.hero-stickers { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }\n.hero-stickers .sticker { aspect-ratio: auto; display: flex; align-items: center; justify-content: flex-start; gap: 8px; padding: 12px 14px; text-align: left; border-radius: 18px; flex-wrap: wrap; }\n.hero-stickers .sticker .emo { font-size: 1.5rem; }\n.hero-stickers .sticker b { font-size: 1.25rem; font-variant-numeric: tabular-nums; }\n.hero-stickers .sticker.is-new { outline: 2px solid var(--primary); outline-offset: -2px; }\n.hero-stickers .sticker.is-new .emo { animation: emo-bounce .6s var(--spring) .4s both, bob 3s ease-in-out 1s infinite; }\n.today-chip { display: inline-block; font-size: .6875rem; font-weight: 700; color: var(--on-primary); background: var(--primary); border-radius: 999px; padding: 1px 7px; vertical-align: middle; }\n.wave { display: inline-block; transform-origin: 70% 70%; animation: wave 2.4s ease-in-out 1s 2; }\n@keyframes wave { 0%, 60%, 100% { transform: rotate(0); } 10%, 30% { transform: rotate(14deg); } 20% { transform: rotate(-8deg); } 40% { transform: rotate(-4deg); } 50% { transform: rotate(10deg); } }\n.page-title { display: flex; align-items: center; gap: 10px; }\n.ptile { display: inline-grid; place-items: center; width: 1.7em; height: 1.7em; border-radius: 12px; background: var(--primary-soft); font-size: .8em; flex: none; animation: emo-bounce .5s var(--spring) both; }\n.page-admin .bento > .card, .page-admin .course-card, .page-admin .course-pulse { transition: transform .25s var(--ease), box-shadow .25s var(--ease); }\n.page-admin .bento > .card:hover, .page-admin .course-pulse:hover { transform: translateY(-3px); box-shadow: var(--shadow); }\n.view-enter { animation: rise-in .45s var(--ease) both; }\n@media (max-width: 760px) { .hero { grid-template-columns: 1fr; padding: 20px; } }\n@media (prefers-reduced-motion: reduce) { .hero::after, .wave, .ptile, .view-enter, .hero-stickers .sticker.is-new .emo { animation: none !important; } .page-admin .bento > .card:hover, .page-admin .course-pulse:hover { transform: none; } }\n/* 사용 매뉴얼 탭 */\n.manual details { border-top: 1px solid var(--line); padding: 12px 0; }\n.manual details:first-of-type { margin-top: 12px; }\n.manual summary { cursor: pointer; font-weight: 700; font-size: 1rem; padding: 4px 0; list-style: none; display: flex; gap: 8px; align-items: baseline; }\n.manual summary::-webkit-details-marker { display: none; }\n.manual summary::before { content: '▸'; color: var(--primary); font-size: .9em; width: 1em; flex: none; }\n.manual details[open] > summary::before { content: '▾'; }\n.manual summary:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; border-radius: 6px; }\n.manual details > *:not(summary) { margin-top: 10px; }\n.manual ol, .manual ul { padding-left: 22px; }\n.manual li + li { margin-top: 6px; }\n.manual table { width: 100%; border-collapse: collapse; font-size: .875rem; }\n.manual th, .manual td { border: 1px solid var(--line); padding: 8px 10px; text-align: left; vertical-align: top; }\n.manual th { background: var(--primary-soft); white-space: nowrap; width: 1%; }\n.manual code { font-size: .85em; background: var(--line); padding: 1px 5px; border-radius: 4px; word-break: break-all; }\n.manual-toc { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; }\n.manual-toc a { font-size: .8125rem; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--line); color: var(--ink); text-decoration: none; }\n.manual-toc a:hover, .manual-toc a:focus-visible { border-color: var(--primary); color: var(--primary); }\n@media (max-width: 520px) { .manual th { white-space: normal; width: 34%; } }\n.course-pulse { display: grid; grid-template-columns: auto 1fr; gap: 14px; align-items: center; align-content: start; } /* 버튼 기본 세로 가운데 정렬 대신 위쪽 정렬(카드끼리 맞춤) */\n.sparkbars { display: grid; gap: 4px; }\n.sparkbars .sb { display: grid; grid-template-columns: 14px 1fr 32px; gap: 6px; align-items: center; font-size: .6875rem; color: var(--muted); }\n.sparkbars .sb .t, .sparkbars .sb b, .sparkbars .sb > span { display: block; }\n.sparkbars .sb i { display: block; height: 6px; border-radius: 3px; background: var(--primary); width: 0; transition: width 1s var(--ease); }\n.sparkbars .sb .t { height: 6px; background: var(--line); border-radius: 3px; overflow: hidden; }\n.sparkbars .sb b { color: var(--ink); font-variant-numeric: tabular-nums; text-align: right; }\n\n/* ───── 워드 클라우드 ───── */\n.wc-box { position: relative; width: 100%; min-height: 280px; }\n.wc-box svg { width: 100%; height: auto; display: block; overflow: visible; }\n.wc-box text {\n  font-family: inherit; font-weight: 700; cursor: pointer; paint-order: stroke;\n  transform-box: fill-box; transform-origin: center;\n  animation: wc-pop .5s var(--spring) both; animation-delay: calc(var(--i, 0) * 22ms);\n  transition: opacity .2s;\n}\n.wc-box text:hover, .wc-box text:focus-visible { text-decoration: underline; outline: none; }\n.wc-box.filtering text:not(.on) { opacity: .28; }\n.wc-t1 { fill: var(--primary-ink); } .wc-t2 { fill: var(--primary); } .wc-t3 { fill: var(--muted); }\n@keyframes wc-pop { from { opacity: 0; transform: scale(.4); } to { opacity: 1; transform: scale(1); } }\n.seg { display: inline-flex; flex-wrap: wrap; gap: 6px; }\n.seg button { min-height: 36px; padding: 0 12px; border-radius: var(--radius-pill); border: 1px solid var(--control); background: var(--surface); font-weight: 600; font-size: .8125rem; cursor: pointer; }\n.seg button[aria-pressed=\"true\"] { background: var(--ink); color: var(--bg); border-color: var(--ink); }\nmark { background: var(--butter); color: var(--ink); border-radius: 4px; padding: 0 2px; }\n.section-head { display: flex; align-items: center; gap: 10px; margin: 28px 0 12px; }\n.section-head h2 { font-size: 1.125rem; display: inline-flex; align-items: center; gap: 8px; }\n.section-head h2 svg { width: 20px; height: 20px; color: var(--primary-ink); }\n.section-head::after { content: \"\"; flex: 1; height: 1px; background: var(--line); }\n\n/* ───── 모션 최소화 ───── */\n@media (prefers-reduced-motion: reduce) {\n  *, *::before, *::after {\n    animation-duration: .001ms !important; animation-iteration-count: 1 !important;\n    transition-duration: .001ms !important; scroll-behavior: auto !important;\n  }\n  .card.interactive:hover { transform: none; }\n  .deco span, .sticker { animation: none !important; }\n}\n\n/* ───── 고대비(강제 색상) ───── */\n@media (forced-colors: active) {\n  .chip[aria-checked=\"true\"], .option[aria-checked=\"true\"], .tab[aria-selected=\"true\"] { outline: 3px solid Highlight; }\n  .dist > span { forced-color-adjust: none; }\n}\n</style>\n",
 "Scripts": "<script>\n/* ==========================================================\n   강의평가 Studio — 공통 클라이언트 라이브러리 (window.CES)\n   ========================================================== */\n(function (global) {\n  'use strict';\n  var CES = {};\n\n  /* ───── DOM·문자열 ───── */\n  CES.$ = function (sel, root) { return (root || document).querySelector(sel); };\n  CES.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };\n\n  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', \"'\": '&#39;', '`': '&#96;' };\n  CES.esc = function (s) {\n    return String(s == null ? '' : s).replace(/[&<>\"'`]/g, function (c) { return ESC[c]; });\n  };\n\n  /** Lucide 아이콘 자리표시자. 렌더링 후 CES.icons()로 SVG 변환. */\n  CES.icon = function (name, label) {\n    return '<i data-lucide=\"' + CES.esc(name) + '\"' + (label ? ' aria-label=\"' + CES.esc(label) + '\" role=\"img\"' : ' aria-hidden=\"true\"') + '></i>';\n  };\n  CES.icons = function () {\n    try { if (global.lucide && global.lucide.createIcons) global.lucide.createIcons(); } catch (e) { /* 아이콘 없이도 동작 */ }\n  };\n\n  CES.fmt = function (n, digits) {\n    if (n == null || isNaN(n)) return '—';\n    return Number(n).toFixed(digits == null ? 2 : digits);\n  };\n\n  CES.uuid = function () {\n    if (global.crypto && crypto.randomUUID) return crypto.randomUUID();\n    var b = new Uint8Array(16);\n    (global.crypto || global.msCrypto).getRandomValues(b);\n    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;\n    var h = Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');\n    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);\n  };\n\n  CES.reducedMotion = function () {\n    return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);\n  };\n\n  /* ───── 저장소(실패해도 앱은 동작) ───── */\n  CES.store = {\n    get: function (key, area) {\n      try { var v = (area || global.sessionStorage).getItem(key); return v ? JSON.parse(v) : null; } catch (e) { return null; }\n    },\n    set: function (key, val, area) {\n      try { (area || global.sessionStorage).setItem(key, JSON.stringify(val)); } catch (e) { /* 무시 */ }\n    },\n    remove: function (key, area) {\n      try { (area || global.sessionStorage).removeItem(key); } catch (e) { /* 무시 */ }\n    }\n  };\n\n  /* ───── 화면 낭독기 알림 ───── */\n  CES.announce = function (msg) {\n    var el = document.getElementById('sr-status');\n    if (!el) return;\n    el.textContent = '';\n    setTimeout(function () { el.textContent = msg; }, 60);\n  };\n\n  /* ───── 로딩 상태 ───── */\n  var loadingCount = 0, loadingTimer = null;\n  CES.loading = function (on) {\n    loadingCount = Math.max(0, loadingCount + (on ? 1 : -1));\n    var bar = document.getElementById('loading-bar');\n    if (!bar) {\n      bar = document.createElement('div');\n      bar.id = 'loading-bar';\n      bar.className = 'loading-bar hidden';\n      bar.setAttribute('role', 'progressbar');\n      bar.setAttribute('aria-label', '불러오는 중');\n      document.body.appendChild(bar);\n    }\n    clearTimeout(loadingTimer);\n    if (loadingCount > 0) {\n      loadingTimer = setTimeout(function () { bar.classList.remove('hidden'); }, 150);\n      document.body.setAttribute('aria-busy', 'true');\n    } else {\n      bar.classList.add('hidden');\n      document.body.removeAttribute('aria-busy');\n    }\n  };\n\n  /** 버튼에 로딩 상태 표시. 반환 함수를 호출하면 원상 복구. */\n  CES.busyButton = function (btn, text) {\n    if (!btn) return function () {};\n    var html = btn.innerHTML;\n    btn.disabled = true;\n    btn.setAttribute('aria-busy', 'true');\n    btn.innerHTML = '<span class=\"spinner\" aria-hidden=\"true\"></span><span>' + CES.esc(text || '처리 중…') + '</span>';\n    return function () {\n      btn.disabled = false;\n      btn.removeAttribute('aria-busy');\n      btn.innerHTML = html;\n      CES.icons();\n    };\n  };\n\n  /* ───── 서버 호출 ─────\n     모든 google.script.run 호출은 이 함수를 거칩니다(성공·실패 핸들러, 로딩 상태, 선택적 재시도).\n     opts.retries: BUSY 응답·네트워크 실패 시 지수 백오프 재시도 횟수(멱등 호출에만 사용)\n     opts.onRetry(attempt, max): 재시도 직전 콜백 */\n  CES.call = function (fn, args, opts) {\n    opts = opts || {};\n    var max = opts.retries || 0;\n    var silent = !!opts.silent;\n    return new Promise(function (resolve) {\n      var attempt = 0;\n      var run = function () {\n        if (!silent) CES.loading(true);\n        var done = function (res, isFailure) {\n          if (!silent) CES.loading(false);\n          var retryable = isFailure || (res && res.code === 'BUSY');\n          if (retryable && attempt < max) {\n            attempt++;\n            if (opts.onRetry) opts.onRetry(attempt, max);\n            var delay = Math.min(8000, 800 * Math.pow(2, attempt - 1)) + Math.floor(Math.random() * 400);\n            setTimeout(run, delay);\n            return;\n          }\n          resolve(res);\n        };\n        try {\n          var runner = global.google && google.script && google.script.run;\n          if (!runner) throw new Error('google.script.run 사용 불가');\n          runner\n            .withSuccessHandler(function (res) {\n              done(res && typeof res === 'object' ? res : { ok: false, code: 'BAD_RESPONSE' }, false);\n            })\n            .withFailureHandler(function (err) {\n              done({ ok: false, code: 'NETWORK', message: String(err && err.message || err) }, true);\n            })[fn].apply(null, args || []);\n        } catch (e) {\n          done({ ok: false, code: 'NETWORK', message: String(e && e.message || e) }, true);\n        }\n      };\n      run();\n    });\n  };\n\n  CES.errorText = function (res) {\n    var map = {\n      NETWORK: '네트워크 연결을 확인한 뒤 다시 시도하세요.',\n      BUSY: '동시에 많은 요청이 처리되고 있습니다. 잠시 후 다시 시도하세요.',\n      SERVER_ERROR: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도하세요.',\n      SETUP_REQUIRED: '아직 초기 설정이 되지 않았습니다. 스프레드시트 메뉴에서 초기 설정을 실행하세요.',\n      NOT_FOUND: '요청한 교과목을 찾을 수 없습니다.',\n      AUTH: '로그인이 만료되었습니다. 다시 로그인하세요.',\n      VALIDATION: '입력값을 확인하세요.',\n      BAD_RESPONSE: '서버 응답을 해석할 수 없습니다.'\n    };\n    if (res && res.message && res.code === 'VALIDATION') return res.message;\n    return map[res && res.code] || '처리하지 못했습니다. 잠시 후 다시 시도하세요.';\n  };\n\n  /* ───── 토스트 ───── */\n  CES.toast = function (msg, type) {\n    var host = document.getElementById('toast-host');\n    if (!host) {\n      host = document.createElement('div');\n      host.id = 'toast-host';\n      host.className = 'toast-host';\n      host.setAttribute('role', 'status');\n      host.setAttribute('aria-live', 'polite');\n      document.body.appendChild(host);\n    }\n    var t = document.createElement('div');\n    t.className = 'toast' + (type === 'error' ? ' error' : '');\n    t.textContent = msg;\n    host.appendChild(t);\n    setTimeout(function () { t.remove(); }, type === 'error' ? 5200 : 3200);\n  };\n\n  /* ───── 모달(포커스 트랩, Esc 닫기, 포커스 복귀) ───── */\n  CES.modal = function (opts) {\n    var prev = document.activeElement;\n    var back = document.createElement('div');\n    back.className = 'modal-backdrop';\n    var id = 'm' + Math.random().toString(36).slice(2, 8);\n    back.innerHTML =\n      '<div class=\"modal' + (opts.wide ? ' wide' : '') + '\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"' + id + '\">' +\n      '<div class=\"modal-head\"><h2 id=\"' + id + '\">' + CES.esc(opts.title) + '</h2>' +\n      '<button type=\"button\" class=\"btn ghost icon sm\" data-close aria-label=\"닫기\">' + CES.icon('x') + '</button></div>' +\n      '<div class=\"modal-body\">' + (opts.html || '') + '</div>' +\n      (opts.footer ? '<div class=\"modal-foot\">' + opts.footer + '</div>' : '') +\n      '</div>';\n    document.body.appendChild(back);\n    var dialog = back.querySelector('.modal');\n    var api = {\n      el: dialog,\n      close: function () {\n        document.removeEventListener('keydown', onKey, true);\n        back.remove();\n        if (opts.onClose) opts.onClose();\n        if (prev && prev.focus) { try { prev.focus(); } catch (e) { /* 무시 */ } }\n      }\n    };\n    var focusables = function () {\n      return CES.$$('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex=\"-1\"])', dialog)\n        .filter(function (el) { return el.offsetParent !== null; });\n    };\n    // persistent 모달은 Esc·바깥 클릭으로 닫히지 않고, 닫기 버튼은 onRequestClose(확인 절차)를 거칩니다.\n    var requestClose = function () { if (opts.onRequestClose) opts.onRequestClose(api); else api.close(); };\n    var onKey = function (e) {\n      if (e.key === 'Escape') { e.preventDefault(); if (opts.persistent) requestClose(); else api.close(); }\n      if (e.key === 'Tab') {\n        var f = focusables();\n        if (!f.length) return;\n        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }\n        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }\n      }\n    };\n    document.addEventListener('keydown', onKey, true);\n    back.addEventListener('click', function (e) {\n      if (e.target === back && !opts.persistent) api.close();\n      if (e.target.closest('[data-close]')) { if (opts.persistent) requestClose(); else api.close(); }\n    });\n    CES.icons();\n    setTimeout(function () {\n      var first = dialog.querySelector('[autofocus]') || focusables()[1] || focusables()[0];\n      if (first) first.focus();\n    }, 30);\n    if (opts.onOpen) opts.onOpen(api);\n    return api;\n  };\n\n  CES.confirm = function (title, message, okLabel, danger) {\n    return new Promise(function (resolve) {\n      var answered = false;\n      var m = CES.modal({\n        title: title,\n        html: '<p>' + CES.esc(message).replace(/\\n/g, '<br>') + '</p>',\n        footer: '<button type=\"button\" class=\"btn\" data-close>취소</button>' +\n          '<button type=\"button\" class=\"btn ' + (danger ? 'danger' : 'primary') + '\" data-ok autofocus>' + CES.esc(okLabel || '확인') + '</button>',\n        onClose: function () { if (!answered) resolve(false); }\n      });\n      m.el.querySelector('[data-ok]').addEventListener('click', function () { answered = true; m.close(); resolve(true); });\n    });\n  };\n\n  /* ───── 다운로드(샌드박스 iframe에서 실패하면 복사 창으로 대체) ───── */\n  CES.download = function (filename, content, mime) {\n    var isCsv = /\\.csv$/i.test(filename);\n    var data = (isCsv ? '﻿' : '') + content; // 엑셀 한글 깨짐 방지 BOM\n    try {\n      var blob = new Blob([data], { type: (mime || 'text/plain') + ';charset=utf-8' });\n      var url = URL.createObjectURL(blob);\n      var a = document.createElement('a');\n      a.href = url;\n      a.download = filename;\n      a.rel = 'noopener';\n      document.body.appendChild(a);\n      a.click();\n      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);\n      CES.toast(filename + ' 파일을 내려받았습니다.');\n    } catch (e) {\n      CES.copyDialog(filename, content);\n    }\n  };\n\n  /** base64로 받은 이진 파일(PDF 등) 내려받기 */\n  CES.downloadBase64 = function (filename, b64, mime) {\n    try {\n      var bin = atob(b64);\n      var bytes = new Uint8Array(bin.length);\n      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);\n      // PDF 형식의 Blob은 브라우저 PDF 뷰어가 가로채 파일 이름이 'download'로 바뀌는 경우가 있어, 이진 파일로 내려받습니다.\n      void mime;\n      var url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));\n      var a = document.createElement('a');\n      a.href = url;\n      a.download = filename;\n      a.rel = 'noopener';\n      document.body.appendChild(a);\n      a.click();\n      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);\n      CES.toast(filename + ' 파일을 내려받았습니다.');\n    } catch (e) {\n      CES.toast('파일을 내려받지 못했습니다. 브라우저의 다운로드 차단 설정을 확인하세요.', 'error');\n    }\n  };\n\n  CES.copyDialog = function (title, content) {\n    var m = CES.modal({\n      title: title,\n      wide: true,\n      html: '<p class=\"muted small\" style=\"margin-bottom:8px\">내려받기가 차단된 환경입니다. 아래 내용을 복사해 메모장·엑셀에 붙여 넣으세요.</p>' +\n        '<textarea class=\"textarea\" style=\"min-height:300px;font-family:ui-monospace,monospace;font-size:13px\" readonly>' + CES.esc(content) + '</textarea>',\n      footer: '<button type=\"button\" class=\"btn primary\" data-copy>' + CES.icon('copy') + '복사</button>'\n    });\n    m.el.querySelector('[data-copy]').addEventListener('click', function () {\n      CES.copy(content);\n    });\n  };\n\n  CES.copy = function (text) {\n    var ok = function () { CES.toast('클립보드에 복사했습니다.'); };\n    var fallback = function () {\n      var ta = document.createElement('textarea');\n      ta.value = text;\n      ta.setAttribute('readonly', '');\n      ta.style.position = 'fixed'; ta.style.opacity = '0';\n      document.body.appendChild(ta);\n      ta.select();\n      try { document.execCommand('copy'); ok(); } catch (e) { CES.toast('복사하지 못했습니다. 직접 선택해 복사하세요.', 'error'); }\n      ta.remove();\n    };\n    if (navigator.clipboard && navigator.clipboard.writeText) {\n      navigator.clipboard.writeText(text).then(ok, fallback);\n    } else {\n      fallback();\n    }\n  };\n\n  /* ───── 축하 효과(가벼운 confetti, 모션 최소화 설정 시 생략) ───── */\n  CES.confetti = function () {\n    if (CES.reducedMotion()) return;\n    var canvas = document.createElement('canvas');\n    canvas.className = 'confetti-canvas';\n    canvas.setAttribute('aria-hidden', 'true');\n    document.body.appendChild(canvas);\n    var ctx = canvas.getContext('2d');\n    var dpr = global.devicePixelRatio || 1;\n    var W = canvas.width = global.innerWidth * dpr;\n    var H = canvas.height = global.innerHeight * dpr;\n    var css = getComputedStyle(document.documentElement);\n    var colors = ['--primary', '--accent', '--butter', '--sky', '--primary-soft'].map(function (v) {\n      return css.getPropertyValue(v).trim() || '#5B4BFF';\n    });\n    var parts = [];\n    for (var i = 0; i < 90; i++) {\n      parts.push({\n        x: W / 2 + (Math.random() - .5) * W * .3, y: H * .35,\n        vx: (Math.random() - .5) * 14 * dpr, vy: (-Math.random() * 12 - 4) * dpr,\n        w: (6 + Math.random() * 6) * dpr, h: (8 + Math.random() * 8) * dpr,\n        r: Math.random() * Math.PI, vr: (Math.random() - .5) * .3,\n        c: colors[i % colors.length]\n      });\n    }\n    var start = performance.now();\n    var frame = function (t) {\n      var elapsed = t - start;\n      ctx.clearRect(0, 0, W, H);\n      parts.forEach(function (p) {\n        p.vy += .35 * dpr; p.vx *= .99;\n        p.x += p.vx; p.y += p.vy; p.r += p.vr;\n        ctx.save();\n        ctx.globalAlpha = Math.max(0, 1 - elapsed / 1800);\n        ctx.translate(p.x, p.y); ctx.rotate(p.r);\n        ctx.fillStyle = p.c;\n        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);\n        ctx.restore();\n      });\n      if (elapsed < 1800) requestAnimationFrame(frame); else canvas.remove();\n    };\n    requestAnimationFrame(frame);\n  };\n\n\n  /* ───── 링 게이지(SVG) ─────\n     frac 0~1, center: 가운데 큰 글자(HTML), caption: 작은 글자 */\n  CES.ring = function (frac, center, caption, opts) {\n    opts = opts || {};\n    var r = 42, c = 2 * Math.PI * r;\n    var f = Math.max(0, Math.min(1, Number(frac) || 0));\n    return '<span class=\"ring' + (opts.small ? ' sm' : '') + '\" role=\"img\" aria-label=\"' + CES.esc(opts.label || '') + '\">' +\n      '<svg viewBox=\"0 0 100 100\" aria-hidden=\"true\"><circle class=\"ring-bg\" cx=\"50\" cy=\"50\" r=\"' + r + '\"/>' +\n      '<circle class=\"ring-fg' + (opts.tone ? ' ' + opts.tone : '') + '\" cx=\"50\" cy=\"50\" r=\"' + r + '\" stroke-dasharray=\"' + c.toFixed(2) +\n      '\" stroke-dashoffset=\"' + c.toFixed(2) + '\" data-off=\"' + (c * (1 - f)).toFixed(2) + '\"/></svg>' +\n      '<span class=\"ring-label\" aria-hidden=\"true\"><strong>' + center + '</strong>' + (caption ? '<span>' + caption + '</span>' : '') + '</span></span>';\n  };\n\n  /** 숫자 카운트업 자리표시: <span data-count=\"3.58\" data-dec=\"2\">0</span> */\n  CES.count = function (value, dec) {\n    if (value == null || isNaN(value)) return '—';\n    dec = dec == null ? 2 : dec;\n    return '<span data-count=\"' + value + '\" data-dec=\"' + dec + '\">' + (CES.reducedMotion() ? Number(value).toFixed(dec) : (0).toFixed(dec)) + '</span>';\n  };\n\n  /** 링·막대·카운트업을 화면에 들어온 뒤 부드럽게 채웁니다(모션 최소화 시 즉시). */\n  CES.animateIn = function (root) {\n    root = root || document;\n    var instant = CES.reducedMotion();\n    var apply = function () {\n      CES.$$('.ring-fg[data-off]', root).forEach(function (el) { el.style.strokeDashoffset = el.getAttribute('data-off'); });\n      CES.$$('[data-w]', root).forEach(function (el) { el.style.width = el.getAttribute('data-w'); });\n      CES.$$('[data-grow]', root).forEach(function (el) { el.style.flexGrow = el.getAttribute('data-grow'); });\n      CES.$$('[data-count]', root).forEach(function (el) {\n        var to = Number(el.getAttribute('data-count')), dec = Number(el.getAttribute('data-dec') || 0);\n        if (instant) { el.textContent = to.toFixed(dec); return; }\n        var t0 = performance.now(), dur = 900;\n        var step = function (t) {\n          var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);\n          el.textContent = (to * e).toFixed(dec);\n          if (k < 1) requestAnimationFrame(step);\n        };\n        requestAnimationFrame(step);\n      });\n    };\n    if (instant) apply(); else requestAnimationFrame(function () { requestAnimationFrame(apply); });\n  };\n\n  /* ───── 워드 클라우드(아르키메데스 나선 배치, SVG) ─────\n     words: [{w, n}] 빈도 내림차순. opts.onSelect(word|null) 클릭 시 호출 */\n  CES.wordCloud = function (host, words, opts) {\n    opts = opts || {};\n    host.innerHTML = '';\n    if (!words || !words.length) {\n      host.innerHTML = '<p class=\"small muted\">표시할 단어가 없습니다.</p>';\n      return;\n    }\n    var W = Math.max(280, Math.round(host.clientWidth || 600));\n    var H = opts.height || Math.round(Math.min(380, Math.max(240, W * 0.55)));\n    var small = W < 480;\n    var maxN = words[0].n, minN = words[words.length - 1].n;\n    var ctx = document.createElement('canvas').getContext('2d');\n    var family = getComputedStyle(document.body).fontFamily;\n    var placed = [], out = [];\n    var overlap = function (a, b) {\n      return !(a.x + a.w + 3 < b.x || b.x + b.w + 3 < a.x || a.y + a.h + 2 < b.y || b.y + b.h + 2 < a.y);\n    };\n    words.slice(0, opts.max || 45).forEach(function (wd, i) {\n      var t = maxN === minN ? 1 : (wd.n - minN) / (maxN - minN);\n      var size = Math.round((small ? 13 : 15) + Math.sqrt(t) * (small ? 26 : 42));\n      ctx.font = '700 ' + size + 'px ' + family;\n      var tw = ctx.measureText(wd.w).width, th = size * 1.1;\n      for (var a = 0; a < 1600; a++) {\n        var ang = a * 0.3, rad = 1.6 * ang;\n        var x = W / 2 + rad * Math.cos(ang) * (W / H) - tw / 2;\n        var y = H / 2 + rad * Math.sin(ang) - th / 2;\n        if (x < 2 || y < 2 || x + tw > W - 2 || y + th > H - 2) continue;\n        var box = { x: x, y: y, w: tw, h: th };\n        if (!placed.some(function (p) { return overlap(p, box); })) {\n          placed.push(box);\n          out.push({ wd: wd, x: x + tw / 2, y: y + th * 0.8, size: size, tier: t > 0.6 ? 1 : t > 0.25 ? 2 : 3, i: i });\n          break;\n        }\n      }\n    });\n    var svg = '<svg viewBox=\"0 0 ' + W + ' ' + H + '\" role=\"group\" aria-label=\"' + CES.esc(opts.label || '워드 클라우드') + '\">' +\n      out.map(function (o) {\n        return '<text x=\"' + o.x.toFixed(1) + '\" y=\"' + o.y.toFixed(1) + '\" text-anchor=\"middle\" font-size=\"' + o.size + '\" class=\"wc-t' + o.tier + '\"' +\n          ' style=\"--i:' + o.i + '\" tabindex=\"0\" role=\"button\" data-w=\"' + CES.esc(o.wd.w) + '\"' +\n          ' aria-label=\"' + CES.esc(o.wd.w) + ' ' + o.wd.n + '회. 선택하면 이 단어가 들어간 응답만 봅니다\"><title>' +\n          CES.esc(o.wd.w) + ' · ' + o.wd.n + '회</title>' + CES.esc(o.wd.w) + '</text>';\n      }).join('') + '</svg>';\n    host.innerHTML = svg;\n    var current = null;\n    var pick = function (el) {\n      var w = el ? el.getAttribute('data-w') : null;\n      current = current === w ? null : w;\n      host.classList.toggle('filtering', !!current);\n      CES.$$('text', host).forEach(function (t) { t.classList.toggle('on', t.getAttribute('data-w') === current); });\n      if (opts.onSelect) opts.onSelect(current);\n    };\n    host.querySelector('svg').addEventListener('click', function (e) {\n      var t = e.target.closest('text');\n      if (t) pick(t);\n    });\n    host.querySelector('svg').addEventListener('keydown', function (e) {\n      var t = e.target.closest('text');\n      if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pick(t); }\n    });\n    return {\n      clear: function () { current = null; host.classList.remove('filtering'); CES.$$('text', host).forEach(function (t) { t.classList.remove('on'); }); },\n      select: function (w) {\n        var el = CES.$$('text', host).filter(function (t) { return t.getAttribute('data-w') === w; })[0];\n        if (el) { current = null; pick(el); return true; }\n        return false;\n      }\n    };\n  };\n\n\n  global.CES = CES;\n})(window);\n</script>\n",
 "Manual": "<!-- 관리자 화면 [사용 매뉴얼] 탭 본문(PDF 매뉴얼의 화면용 요약). Admin.html이 include합니다. -->\n<template id=\"manual-tpl\">\n  <section class=\"card pad-lg manual\" aria-labelledby=\"mn-title\">\n    <div class=\"row-between\">\n      <div>\n        <h1 id=\"mn-title\" class=\"page-title\" style=\"font-size:1.375rem;margin:0\"><span class=\"ptile\" aria-hidden=\"true\">📖</span>사용 매뉴얼</h1>\n        <p class=\"small muted\" style=\"margin-top:4px\">교수용 안내 · 장 제목을 누르면 펼쳐집니다.</p>\n      </div>\n      <button type=\"button\" class=\"btn sm\" data-manual-toggle>모두 펼치기</button>\n    </div>\n\n    <nav class=\"manual-toc\" aria-label=\"매뉴얼 차례\">\n      <a href=\"#mn-1\">1. 개요</a><a href=\"#mn-2\">2. 설치·배포</a><a href=\"#mn-3\">3. 로그인·대시보드</a>\n      <a href=\"#mn-4\">4. 교과목</a><a href=\"#mn-5\">5. 문항</a><a href=\"#mn-6\">6. 학생 참여</a>\n      <a href=\"#mn-7\">7. 학생 화면</a><a href=\"#mn-8\">8. 결과·내보내기</a><a href=\"#mn-9\">9. 설정·업데이트</a>\n      <a href=\"#mn-10\">10. 익명성</a><a href=\"#mn-11\">11. 문제 해결</a><a href=\"#mn-12\">12. 시트 구조</a>\n    </nav>\n\n    <details id=\"mn-1\" open>\n      <summary>1. 한눈에 보는 강의평가 Studio</summary>\n      <p>교수가 학기 중 자신의 수업에 대한 학생 의견을 <b>익명으로</b> 모으고, 결과를 시각화해 다음 수업 개선(CQI)에 활용하는 도구입니다. 데이터는 교수 본인의 Google 스프레드시트에만 저장됩니다. <b>학교 공식 강의평가를 대체하지 않습니다.</b></p>\n      <table>\n        <tr><th>교수</th><td>교과목 등록 → 접속 주소·접속코드 안내 → 응답 현황 확인 → 결과 분석·PDF 내보내기</td></tr>\n        <tr><th>학생</th><td>공통 주소 열기 → 접속코드 입력 → 익명 안내 확인 → 28~32문항 응답(약 5분) → 제출</td></tr>\n        <tr><th>평가 영역</th><td>A 강의 설계 · B 교수학습방법 · C 평가 및 과제 · D 학습성과(CLO) · E 학습 환경 · F 디지털·AI 활용 · G 종합 · H 온라인 강의(온라인(비대면)·혼합만) · I 실무 적용(전공심화과정만) · 서술형 3문항</td></tr>\n      </table>\n    </details>\n\n    <details id=\"mn-2\">\n      <summary>2. 설치와 배포 (최초 1회)</summary>\n      <ol>\n        <li>스프레드시트 ▸ <b>확장 프로그램 ▸ Apps Script</b> ▸ Code.gs에 설치 파일 전체를 붙여 넣고 저장합니다.</li>\n        <li>함수 <b>setup</b>을 실행하고 권한을 승인합니다(「확인하지 않은 앱」 화면에서 [고급] ▸ [이동]).</li>\n        <li>스프레드시트 메뉴 <b>② 관리자 PIN 설정·재설정</b>에서 숫자 6~12자리 PIN을 정합니다.</li>\n        <li><b>배포 ▸ 새 배포 ▸ 웹 앱</b>: <b>실행: 나</b>를 먼저 고르고 <b>액세스: 모든 사용자</b>를 고른 뒤 배포합니다.</li>\n        <li>웹 앱 URL(…/exec) 끝에 <code>?page=admin</code>을 붙인 주소가 관리자 화면입니다. 즐겨찾기 하세요.</li>\n      </ol>\n      <p class=\"callout\"><span>「실행: 웹 앱을 액세스하는 사용자」나 「Google 계정이 있는 모든 사용자」로 배포하면 학생에게 로그인을 요구하고 응답을 저장할 수 없습니다. 배포 직후 <b>시크릿 창</b>에서 웹 앱 주소가 열리는지 확인하세요.</span></p>\n    </details>\n\n    <details id=\"mn-3\">\n      <summary>3. 로그인과 대시보드</summary>\n      <ul>\n        <li>관리자 주소(<code>…/exec?page=admin</code>)에서 PIN을 입력합니다. 5회 틀리면 10분간 잠깁니다.</li>\n        <li>PIN 입력 상자가 안 보이면 <code>?page=admin</code>이 빠진 것입니다. 학생용 접속코드 화면 아래 <b>교수자 로그인</b> 링크를 누르세요.</li>\n        <li>「응답 수」는 진행 중인 모든 교과목의 합계이고, 「전체 평균」·「긍정 응답률」은 <b>결과가 열린 교과목만</b>으로 계산합니다. 카드 아래에 기준(예: 결과가 열린 1개 교과목(30명) 기준 · 1개는 잠김)이 표시됩니다.</li>\n        <li>대시보드 맨 위 <b>환영 배너</b>에 오늘 날짜와 진행 중 설문·<b>오늘 새 응답</b>·누적 응답·마감 임박 수가 스티커로 표시되고, [교과목·접속 주소]·[결과 보기]로 바로 이동할 수 있습니다. 오늘 응답이 들어온 교과목 카드에는 <b>오늘 +N</b> 표시가 붙습니다.</li>\n        <li><b>목표 도달 축하</b>: 교과목 응답이 결과 공개 기준(기본 5명)에 처음 도달하면(수강인원을 입력한 교과목은 응답률 80%도) 대시보드에서 축하 효과와 알림이 한 번 나타납니다.</li>\n        <li>교과목 카드를 누르면 결과 화면으로 이동합니다. 「마감 임박」은 72시간 안에 끝나는 교과목입니다.</li>\n      </ul>\n    </details>\n\n    <details id=\"mn-4\">\n      <summary>4. 교과목 등록 · 설문 중지 · 다시 시작</summary>\n      <ul>\n        <li><b>+ 새 교과목</b>: 교과목명, 학년도, 학기·학과·학년·수업 방식·교과목 유형, 응답 기간, 참여 방식(접속코드/일회용 토큰), 결과 공개일(선택)을 입력합니다. 접속코드는 교과목마다 달라야 합니다.</li>\n        <li>수업 방식이 대면이면 온라인 문항(H)이, 교과목 유형이 이론이면 실습실 문항이, 실습이면 이론 강의실 문항이 숨겨집니다.</li>\n        <li>응답이 1건이라도 들어오면 문항·수업 방식·교과목 유형은 바꿀 수 없습니다.</li>\n        <li><b>설문 중지</b>: [편집] ▸ 「지금 수동으로 마감」 체크 ▸ 저장. 응답·문항은 그대로 보관되고 학생에게는 「마감」 화면이 나옵니다.</li>\n        <li><b>다시 시작</b>: 다음 학기·다음 해에는 <b>[복제]</b>로 새 학년도·학기와 기간을 입력합니다(새 접속코드, 이전 학기와 자동 비교). 같은 학기 안에서는 [편집]에서 수동 마감을 해제하고 기간을 새로 입력합니다.</li>\n        <li><b>새 학기 준비</b>: [교과목] 위쪽의 <b>새 학기 준비</b> ▸ 복제할 학기·새 학년도/학기·응답 기간 선택 ▸ 준비하기. 그 학기 교과목이 문항째 한 번에 복제되고 <b>새 접속코드</b>가 만들어집니다. 「이전 학기 마감」을 체크하면 이전 접속코드로는 응답할 수 없습니다. 학생 접속 주소(공통 주소)는 그대로입니다.</li>\n        <li>응답이 없는 교과목만 삭제할 수 있습니다.</li>\n        <li>기본 교과목: 디지털리터러시와 AI활용(1학년·대면), AI융합 간호정보학(3학년·혼합), <b>AI융합 간호정보학(전공심화과정)</b>(2026학년도 2학기·4학년·이론+실습·온라인(비대면), CLO는 AI융합 간호정보학과 동일, 「I. 실무 적용」 영역 2문항 추가 → 34문항(결과도 영역별로 따로 분석)).</li>\n      </ul>\n    </details>\n\n    <details id=\"mn-5\">\n      <summary>5. 문항 관리</summary>\n      <ul>\n        <li>[문항] 탭에서 <b>공통 기본 문항 은행</b> 또는 교과목을 고릅니다. 기본 문항 은행을 고치면 이후 새로 만드는 교과목에 적용됩니다.</li>\n        <li>문항마다 영역, 문구, 유형(5점 리커트·단일·복수 선택·드롭다운·서술형), 필수, 역문항, 표시 조건을 정합니다.</li>\n        <li><b>영역</b>은 드롭다운에서 고릅니다. 목록에 없는 영역은 맨 아래 <b>「직접 입력…」</b>을 고르고 이름을 입력한 뒤 Enter를 누르면 추가되며, 다른 문항의 목록에도 나타납니다.</li>\n        <li><b>CLO 일괄 입력</b>: 학습성과를 한 줄에 하나씩 붙여 넣으면 「나는 ~할 수 있게 되었다.」 문항이 D 영역에 들어갑니다.</li>\n        <li>편집기 위쪽에 학생에게 보이는 문항 수와 예상 시간이 표시됩니다(기본: 대면 28문항, 혼합·온라인(비대면) 32문항, 약 5분).</li>\n      </ul>\n    </details>\n\n    <details id=\"mn-6\">\n      <summary>6. 학생 참여 안내 (공통 주소 · 접속코드 · 토큰)</summary>\n      <table>\n        <tr><th>공통 주소 + 접속코드</th><td>[교과목] ▸ <b>접속 주소</b>. <b>안내문 복사(LMS 공지용)</b>로 주소·접속코드 안내문을 LMS에 올리면, 학생은 주소를 열고 접속코드만 입력합니다. 모든 교과목이 같은 주소를 씁니다. 접속코드를 비워 두면 저장할 때 자동으로 만들어집니다.</td></tr>\n        <tr><th>주소 복사·안내문</th><td><b>주소 복사</b>와 <b>안내문 복사</b>는 항상 <b>원래 주소</b>(…/exec)를 씁니다. 창의 주소가 Apps Script [배포 ▸ 배포 관리]의 <b>웹 앱 URL과 같은지</b> 먼저 확인하고, 다르면 [설정]에서 고치세요.</td></tr>\n        <tr><th>수업 중 안내</th><td><b>수업 화면에 띄우기</b>로 주소와 접속코드를 강의실 화면에 크게 보여 줍니다.</td></tr>\n        <tr><th>일회용 토큰</th><td>토큰 방식 교과목의 <b>토큰</b>에서 수강생보다 2~3개 넉넉히 생성 → 인쇄해 <b>무작위로 섞어</b> 배부. 토큰 원문은 생성 화면에서 한 번만 보입니다.</td></tr>\n      </table>\n    </details>\n\n    <details id=\"mn-7\">\n      <summary>7. 학생 응답 화면</summary>\n      <ul>\n        <li>학생은 로그인 없이 휴대폰으로 응답합니다: (공통 주소면 접속코드 입력) → 교과목 안내 → 익명성 안내 → 문항 → 검토 → 제출.</li>\n        <li>화면을 새로 고쳐도 입력한 답이 유지됩니다(탭을 닫으면 임시 저장은 지워짐).</li>\n        <li>빠진 필수 문항은 검토 단계에서 안내합니다. 기간 전·후, 사용한 토큰은 안내 화면이 나옵니다.</li>\n      </ul>\n    </details>\n\n    <details id=\"mn-8\">\n      <summary>8. 결과 분석과 내보내기</summary>\n      <ul>\n        <li>응답이 <b>최소 공개 수(기본 5명)</b> 미만이거나 결과 공개일 전이면 결과·내보내기가 잠깁니다.</li>\n        <li>한눈에 보기(응답 수·전체 평균·만족도·추천), 영역별 평균·분포, 워드 클라우드, 레이더 차트, 학기 간·분반 간 비교, 문항별 결과, 서술형 응답, CQI 요약(강점은 <b>옅은 초록</b>, 개선점은 <b>노랑</b> 카드, 문항 평균 상위·하위 3개)을 제공합니다.</li>\n        <li>해석 기준(5점): 4.5 이상 매우 우수 · 4.0 이상 우수 · 3.5 이상 보통 이상 · 3.0 이상 보통 · 3.0 미만 개선 필요. 긍정 응답률 = 4·5점 비율.</li>\n      </ul>\n      <table>\n        <tr><th>원자료 PDF</th><td>문항 번호표 → 객관식 응답표(무작위 순서) → 서술형 응답표</td></tr>\n        <tr><th>결과 보고서 PDF</th><td>[결과 분석] 위쪽 <b>결과 보고서 PDF</b>: 매뉴얼처럼 인쇄용으로 짠 보고서입니다. 보고서 정보(교과목·학기·응답 기간·응답 수·담당 교수) → ① 한눈에 보기 → ② 영역별 결과(막대·레이더 차트) → ③ 학기·분반 비교 → ④ 문항별 결과(분포 막대) → ⑤ 서술형 응답(워드 클라우드·자주 나온 단어) → ⑥ CQI 요약(강점 초록·개선점 노랑 상자, AI 요약, 개선 계획 작성란). 글자 검색·복사가 됩니다.</td></tr>\n        <tr><th>CQI 요약표 PDF</th><td>영역별 결과, 강점·개선점, 문항별 결과, 개선 계획 작성란</td></tr>\n      </table>\n      <p><b>서술형 응답 AI 분석</b> (CQI 요약표 아래)</p>\n      <ol>\n        <li><b>범위</b>를 고릅니다(전체 또는 서술형 문항 하나). 글자 수가 표시되고, 너무 길면 문항별로 나누도록 안내합니다.</li>\n        <li><b>AI용으로 복사</b>를 눌러 생성형 AI(ChatGPT·Gemini·Claude 등)에 붙여 넣습니다. 간호교육 CQI 보고 양식에 맞춘 요청 문구가 함께 복사됩니다. 파일이 필요하면 <b>서술형 텍스트(AI 붙여넣기용 TXT)</b>를 받습니다.</li>\n        <li>AI 요약을 검토해 <b>AI 요약 붙여넣기</b> 칸에 넣고 <b>서술형 응답 PDF(보고·인쇄용)</b>를 저장합니다. 칸을 비우면 PDF에 작성란이 인쇄됩니다.</li>\n      </ol>\n\n      <p class=\"small muted\">AI에 넣기 전에 이름·학번 등 개인 식별 정보가 없는지 확인하세요.</p>\n    </details>\n\n    <details id=\"mn-9\">\n      <summary>9. 설정 · 메뉴 · 버전 업데이트</summary>\n      <ul>\n        <li>[설정]: 교수명·소속, 학과 목록, 최소 공개 수(3~50), PIN 변경, 학생용 웹 앱 주소(…/exec).</li>\n        <li>스프레드시트 메뉴: ① 초기 설정 실행 · ② 관리자 PIN 설정·재설정 · 웹 앱 주소 확인 · <b>응답 시트 빈 열 정리(학기 시작 전)</b> · [테스트] 샘플 응답 생성/삭제.</li>\n        <li><b>업데이트</b>: Code.gs를 새 버전으로 바꿔 저장 → <b>setup</b> 실행 → <b>배포 관리 ▸ ✏️ ▸ 버전: 새 버전 ▸ 배포</b>.</li>\n      </ul>\n      <p class=\"callout\"><span><b>「새 배포」를 만들지 마세요.</b> 웹 앱 주소가 바뀌어 이미 안내한 공통 주소가 열리지 않습니다.</span></p>\n      <p class=\"small muted\">[테스트] 샘플 응답은 결과 화면 연습용입니다. 실제 평가 전에 반드시 「샘플 데이터 모두 삭제」를 실행하세요. 삭제는 <b>샘플 응답만</b> 지우며 교과목·접속코드는 그대로 유지됩니다.</p>\n    </details>\n\n    <details id=\"mn-10\">\n      <summary>10. 익명성 보호 원칙</summary>\n      <ul>\n        <li>학번·이름·이메일·IP·기기 정보를 수집하지 않으며, 학생은 로그인하지 않습니다.</li>\n        <li>제출 <b>날짜만</b> 저장하고, 응답 행은 시트의 무작위 위치에 들어갑니다.</li>\n        <li>최소 공개 수 미만이면 결과·내보내기·비교가 잠기고, 서술형은 무작위 순서로 보입니다.</li>\n        <li>토큰은 해시로만 저장되어 응답과 연결할 수 없습니다.</li>\n        <li>한계: 접속코드 방식은 중복 응답을 완전히 막지 못하고, 주소와 접속코드가 퍼지면 수업 밖에서도 응답할 수 있습니다. 1인 1회가 중요하면 토큰을 쓰세요.</li>\n      </ul>\n    </details>\n\n    <details id=\"mn-11\">\n      <summary>11. 자주 묻는 질문과 문제 해결</summary>\n      <table>\n        <tr><th>「현재 파일을 열 수 없습니다」</th><td>시크릿 창에서 열리면 교수님 브라우저의 다중 계정 문제(학생은 정상). 안 열리면 배포가 <b>실행: 나 / 액세스: 모든 사용자</b>인지, [설정]의 학생용 주소가 배포 주소와 같은지 확인.</td></tr>\n        <tr><th>학생에게 로그인 화면</th><td>액세스를 「모든 사용자」로 바꾸고 새 버전으로 배포.</td></tr>\n        <tr><th>PIN 입력 상자가 없음</th><td>주소에 <code>?page=admin</code>을 붙이거나 접속코드 화면의 「교수자 로그인」 링크.</td></tr>\n        <tr><th>학생 주소가 모두 「현재 파일을 열 수 없습니다」(배포 설정은 정상)</th><td>이 스프레드시트에 연결된 프로젝트의 배포가 로그인 없는 접속에서 막힌 경우입니다. ① 스프레드시트 <b>파일 ▸ 사본 만들기</b> ② 사본의 Apps Script에서 <b>setup</b> 실행(원본 주소가 자동으로 비워짐) ③ <b>새 배포</b>(실행: 나 / 액세스: 모든 사용자) ④ 새 URL 끝에 <code>?page=admin</code>을 붙여 접속(새 주소 자동 저장) ⑤ [접속 주소]의 새 주소를 안내. 교과목·문항·응답·PIN은 사본에 그대로 있습니다.</td></tr>\n        <tr><th>v1.5 독립형 설치를 시험했다가 되돌릴 때</th><td>스프레드시트의 <b>확장 프로그램 ▸ Apps Script</b>(연결형)에 최신 설치 파일을 붙여 넣고 <b>setup</b>을 실행하세요. Settings의 쓰지 않는 행(script_id·webapp_script_id)을 지우고, 학생 주소를 이 프로젝트의 배포 주소로 다시 저장합니다. 이후 「배포 관리 ▸ 새 버전」으로 배포하고 [접속 주소]에서 주소를 확인하세요. 독립형 프로젝트는 배포를 보관한 뒤 Drive에서 삭제해도 됩니다.</td></tr>\n        <tr><th>예전에 안내한 링크로 들어온 학생</th><td>「이전 방식의 링크입니다」 안내와 함께 접속코드 입력 화면이 나옵니다. 공통 주소와 접속코드를 다시 안내하세요.</td></tr>\n        <tr><th>결과가 열리지 않음</th><td>응답 수가 최소 공개 수 미만이거나 결과 공개일 전.</td></tr>\n        <tr><th>문항을 고칠 수 없음</th><td>응답이 들어온 교과목은 잠김. [복제]로 새 교과목을 만들어 수정.</td></tr>\n        <tr><th>Responses 시트에 빈칸</th><td>정상. 문항마다 열이 따로 있어 다른 교과목의 문항 열은 빈칸입니다. 머리글 색이 교과목별로 다르고, 메모에 [교과목명]이 있습니다.</td></tr>\n        <tr><th>Items에 같은 문항 반복</th><td>정상. 기본 문항 은행과 교과목마다 복사본을 둡니다. 지우지 마세요.</td></tr>\n        <tr><th>Tokens 시트가 비어 있음</th><td>접속코드 방식만 쓰면 정상. 지우면 관리자 화면이 열리지 않으니 숨기기만 하세요.</td></tr>\n        <tr><th>PIN을 잊음 / 잠김</th><td>스프레드시트 메뉴 ② 관리자 PIN 설정·재설정. 잠김은 10분 뒤 해제.</td></tr>\n      </table>\n    </details>\n\n    <details id=\"mn-12\">\n      <summary>12. 부록: 스프레드시트 구조</summary>\n      <table>\n        <tr><th>Settings</th><td>교수명·소속, 학과 목록, 최소 공개 수, 학생용 주소, PIN 해시, 버전 — 관리자 화면 [설정]에서 관리</td></tr>\n        <tr><th>Courses</th><td>교과목 1개 = 1행(기간·접속코드·상태·수업 방식 등) — [교과목] 탭에서 관리(경고 보호)</td></tr>\n        <tr><th>Items</th><td>문항 1개 = 1행(TEMPLATE = 기본 문항 은행) — [문항] 탭에서 관리(경고 보호)</td></tr>\n        <tr><th>Tokens</th><td>일회용 토큰 해시·사용 여부 — 지우지 마세요(경고 보호)</td></tr>\n        <tr><th>Responses</th><td>응답 1건 = 1행, 문항 ID 열에 답 저장 — 직접 편집 금지(경고 보호)</td></tr>\n      </table>\n      <p class=\"small muted\">시트를 지우거나 이름을 바꾸면 앱이 동작하지 않습니다. 학기 말에는 스프레드시트를 [사본 만들기]로 백업하세요.</p>\n    </details>\n  </section>\n</template>\n"
};

function __template_(name) {
  return HtmlService.createTemplate(__FILES__[name]);
}

/* ───── Code.gs ───── */
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
  VERSION: '1.4.12',
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
  var t = __template_(isAdmin ? 'Admin' : 'Student');
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
  return __FILES__[name];
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
  return 'Asia/Seoul';
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


/* ───── Setup.gs ───── */
/**
 * 강의평가 Studio — 초기 설정·스프레드시트 메뉴·테스트 데이터
 */

/**
 * 공통 기본 문항 은행: [영역, 문항, 유형, 선택지, 표시 조건]
 * 표시 조건: 'online'=온라인(비대면)·혼합 수업만, 'theory'=이론이 있는 교과목만, 'practice'=실습이 있는 교과목만
 * D 영역(학습성과·CLO)은 교과목마다 다르므로 교과목에서 입력합니다.
 */
var DEFAULT_ITEMS = [
  ['A. 강의 설계', '강의계획서에 제시된 내용과 실제 수업이 일치하였다.', 'likert5'],
  ['A. 강의 설계', '수업 목표가 명확하게 제시되었다.', 'likert5'],
  ['B. 교수학습방법', '교수자의 설명은 이해하기 쉬웠다.', 'likert5'],
  ['B. 교수학습방법', '수업 자료(교안·영상·실습자료 등)는 학습에 유용하였다.', 'likert5'],
  ['B. 교수학습방법', '수업 중 질문하거나 참여할 기회가 충분히 주어졌다.', 'likert5'],
  ['B. 교수학습방법', '토의·사례·시뮬레이션·플립러닝·스마트교수법·AI활용 등 다양한 교수학습방법이 활용되었다.', 'likert5'],
  ['C. 평가 및 과제', '평가 기준과 방법이 사전에 공지되었다.', 'likert5'],
  ['C. 평가 및 과제', '평가는 공정하게 이루어졌다.', 'likert5'],
  ['C. 평가 및 과제', '과제의 양과 난이도가 적절하였다.', 'likert5'],
  ['C. 평가 및 과제', '과제·시험에 대한 피드백을 적절한 시기에 받았다.', 'likert5'],
  ['E. 학습 환경', '이론 강의실의 환경(좌석·조명·냉난방·기자재)이 학습에 적절하였다.', 'likert5', null, 'theory'],
  ['E. 학습 환경', '실습실의 시설과 실습 기자재가 실습하기에 충분하였다.', 'likert5', null, 'practice'],
  ['E. 학습 환경', '강의실·실습실의 유무선 인터넷(Wi-Fi) 환경이 원활하였다.', 'likert5'],
  ['F. 디지털·AI 활용', '수업에서 활용한 디지털 도구·AI는 학습에 도움이 되었다.', 'likert5'],
  ['F. 디지털·AI 활용', '이 수업에서 배운 디지털·AI 활용 역량을 간호실무에 활용할 수 있다고 느낀다.', 'likert5'],
  ['F. 디지털·AI 활용', '수업에서 사용하는 디지털 도구·AI의 사용 방법을 충분히 안내받았다.', 'likert5'],
  ['F. 디지털·AI 활용', 'AI가 제시한 정보의 정확성과 근거를 비판적으로 검토하는 능력이 향상되었다.', 'likert5'],
  ['F. 디지털·AI 활용', 'AI 활용 시 윤리·저작권·개인정보(환자정보) 보호의 중요성을 이해하게 되었다.', 'likert5'],
  ['G. 종합', '이 수업에 전반적으로 만족한다.', 'likert5'],
  ['G. 종합', '이 수업을 후배에게 추천하고 싶다.', 'likert5'],
  ['H. 온라인(비대면) 강의', '온라인 강의 영상·음성의 품질이 학습하기에 적절하였다.', 'likert5', null, 'online'],
  ['H. 온라인(비대면) 강의', '온라인 학습 플랫폼(LMS) 접속과 사용이 원활하였다.', 'likert5', null, 'online'],
  ['H. 온라인(비대면) 강의', '온라인 수업에서도 질문·토론 등 상호작용 기회가 충분하였다.', 'likert5', null, 'online'],
  ['H. 온라인(비대면) 강의', '온라인 강의 자료와 공지가 제때 제공되었다.', 'likert5', null, 'online'],
  ['서술형', '이 수업에서 가장 도움이 된 점은 무엇인가요?', 'text'],
  ['서술형', '교수학습방법·평가·과제에서 개선이 필요한 점을 적어 주세요.', 'text'],
  ['서술형', '다음 학기 수업에 바라는 점이 있다면 적어 주세요.', 'text'] // 모든 문항은 필수(setup이 기본 문항을 필수로 생성)
];

var PRACTICE_DOMAIN = 'I. 실무 적용';

/** 이번 학기 교과목 예시(샘플). 교과목명·학년은 실제 담당 교과목, 수강인원·기간은 예시값입니다. */
var SAMPLE_COURSES = [
  {
    course_name: '디지털리터러시와 AI활용', semester: '1', grade: 1, section: '', enrollment: 0, delivery_mode: '대면', course_type: '이론+실습',
    clos: [
      '나는 디지털 도구를 활용하여 학습 자료를 검색·정리할 수 있게 되었다.',
      '나는 생성형 AI를 학습에 윤리적이고 비판적으로 활용할 수 있게 되었다.',
      '나는 문서·스프레드시트·프레젠테이션 도구로 학습 결과물을 작성할 수 있게 되었다.',
      '나는 온라인 건강정보의 신뢰성을 평가하고 근거 자료를 선별할 수 있게 되었다.',
      '나는 디지털 협업 도구를 활용하여 팀 과제를 수행할 수 있게 되었다.'
    ]
  },
  {
    course_name: 'AI융합 간호정보학', grade: 3, section: '', enrollment: 0, delivery_mode: '혼합', course_type: '이론+실습',
    clos: [
      '나는 간호정보시스템(EMR)의 구조와 기능을 설명할 수 있게 되었다.',
      '나는 AI 기반 임상의사결정지원 결과를 간호 근거에 비추어 검토할 수 있게 되었다.',
      '나는 표준간호용어(NANDA·NIC·NOC 등)를 활용하여 간호기록을 구조화할 수 있게 되었다.',
      '나는 간호 데이터를 수집·분석·시각화하여 간호문제 해결에 활용할 수 있게 되었다.',
      '나는 의료정보 보안과 환자 개인정보 보호 원칙을 간호실무에 적용할 수 있게 되었다.'
    ]
  },
  {
    // 기존 시트에 없으면 setup이 추가합니다(ensure).
    course_name: 'AI융합 간호정보학(전공심화과정)', year: 2026, semester: '2', grade: 4, section: '', enrollment: 0, delivery_mode: '온라인(비대면)', course_type: '이론+실습', ensure: true,
    // 현직 간호사가 많은 전공심화과정: 실무 적용 가능성 문항(별도 영역 I, 서술형 앞)
    extra: [
      { domain: PRACTICE_DOMAIN, text: '이 수업에서 배운 간호정보·AI 활용 내용을 현재(또는 앞으로) 근무하는 임상 현장에 적용할 수 있다.', type: 'likert5' },
      { domain: PRACTICE_DOMAIN, text: '이 수업은 나의 간호 업무(간호기록·정보 관리 등)의 효율성을 높이는 데 도움이 되었다.', type: 'likert5' }
    ],
    clos: [
      '나는 간호정보시스템(EMR)의 구조와 기능을 설명할 수 있게 되었다.',
      '나는 AI 기반 임상의사결정지원 결과를 간호 근거에 비추어 검토할 수 있게 되었다.',
      '나는 표준간호용어(NANDA·NIC·NOC 등)를 활용하여 간호기록을 구조화할 수 있게 되었다.',
      '나는 간호 데이터를 수집·분석·시각화하여 간호문제 해결에 활용할 수 있게 되었다.',
      '나는 의료정보 보안과 환자 개인정보 보호 원칙을 간호실무에 적용할 수 있게 되었다.'
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
    .addItem('응답 시트 빈 열 정리(학기 시작 전)', 'cleanResponseSheet')
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
  upgradeTemplateScopes_();
  sheet_(APP.SHEETS.RESPONSES).getRange(1, 3, sheet_(APP.SHEETS.RESPONSES).getMaxRows(), 1).setNumberFormat('@');

  // 설정 기본값(없는 키만 추가)
  var s = getSettingsMap_();
  var defaults = [
    ['professor_name', '정종필', '교수명([설정] 탭에서 변경)'],
    ['affiliation', '청암대학교 간호학과', '소속(학교/학과)'],
    ['min_responses', 5, '결과를 공개하는 최소 응답 수(3 이상)'],
    ['departments', '간호학과', '교과목 설정의 학과 드롭다운 목록(줄바꿈으로 구분)'],
    ['webapp_url', '', '학생 접속 주소(공통 주소)로 쓰는 웹 앱 주소(/exec). /exec로 접속하면 자동 저장'],
    ['pin_hash', '', '관리자 PIN 해시(SHA-256 + salt). 메뉴 ② 로 설정하세요. 직접 수정 금지'],
    ['pin_salt', '', 'PIN 해시용 salt. 직접 수정 금지'],
    ['token_salt', randomString_(32, APP.ID_ALPHABET), '토큰 해시용 salt. 변경하면 발급된 토큰이 모두 무효가 됩니다'],
    ['session_epoch', '0', '관리자 세션 무효화 기준값. 직접 수정 금지'],
    ['app_version', APP.VERSION, '설치 버전']
  ];
  defaults.forEach(function (d) {
    if (!s.hasOwnProperty(d[0])) setSetting_(d[0], d[1], d[2]);
  });
  // 이미 있는 행은 값은 그대로 두고 설명만 최신 문구로 맞춥니다(예: 예전 「링크·QR」 설명).
  var st = readTable_(APP.SHEETS.SETTINGS);
  defaults.forEach(function (d) {
    var row = st.rows.filter(function (r) { return String(r.key).trim() === d[0]; })[0];
    if (row && String(row.description || '') !== d[2]) st.sheet.getRange(row._row, 3).setValue(d[2]);
  });
  setSetting_('app_version', APP.VERSION);

  // 스프레드시트 사본에서 실행한 경우: 원본의 학생용 주소는 다른 프로젝트(원본)의 배포이므로 비웁니다.
  // 비워 두면 사본에서 새로 배포한 /exec 주소로 처음 접속할 때 자동으로 저장되어 학생 접속 주소도 새 주소로 바뀝니다.
  var sheetId = ss.getId();
  var knownId = String(getSettingsMap_().sheet_id || '');
  if (knownId && knownId !== sheetId) setSetting_('webapp_url', '');
  setSetting_('sheet_id', sheetId, '이 스프레드시트 ID(사본 감지용). 직접 수정 금지');

  // v1.5 독립형 시험 설치의 흔적 정리: 학생용 주소가 독립형 배포를 가리킬 수 있으므로 비우고(이 프로젝트의 /exec로
  // 관리자 화면에 접속하면 다시 자동 저장), 더 쓰지 않는 설정 행은 지웁니다.
  if (removeSettings_(OBSOLETE_SETTINGS) > 0) setSetting_('webapp_url', '');
  removeSettings_(OBSOLETE_SHORT_SETTINGS);

  // 접속코드가 비어 있는 접속코드 방식 교과목(이전 버전의 「링크만으로 참여」)에 코드를 만들어 줍니다.
  fillMissingAccessCodes_();

  // 공통 기본 문항(TEMPLATE)
  if (getItems_(APP.TEMPLATE_ID).length === 0) {
    var rows = DEFAULT_ITEMS.map(function (d, i) {
      return itemToRow_({
        item_id: 't' + ('0' + (i + 1)).slice(-2), course_id: APP.TEMPLATE_ID, domain: d[0], text: d[1], type: d[2],
        required: true, order: i + 1, reverse: false, options: d[3] || [], scope: d[4] || ''
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
    setSetting_('added_courses', SAMPLE_COURSES.filter(function (x) { return x.ensure; }).map(function (x) { return x.course_name; }).join('\n'),
      'setup이 추가한 기본 교과목(삭제해도 다시 만들지 않음). 직접 수정 금지');
  } else {
    // 새로 추가된 기본 교과목(ensure)은 처음 한 번만 넣습니다(교수가 삭제하면 다시 만들지 않음).
    var names = getCourses_().map(function (c) { return String(c.course_name).trim(); });
    var added = String(getSettingsMap_().added_courses || '').split('\n').filter(String);
    SAMPLE_COURSES.forEach(function (spec) {
      if (!spec.ensure || added.indexOf(spec.course_name) >= 0) return;
      if (names.indexOf(spec.course_name) < 0) { createDemoCourse_(spec); created = true; }
      added.push(spec.course_name);
    });
    setSetting_('added_courses', added.join('\n'), 'setup이 추가한 기본 교과목(삭제해도 다시 만들지 않음). 직접 수정 금지');
  }

  // 수업 방식 이름 변경(비대면 → 온라인(비대면))을 시트에도 반영
  renameDeliveryModes_();
  // 교과목별 추가 문항(예: 전공심화과정 실무 적용) — 응답이 없는 교과목에 한 번만
  addCourseExtraItems_();

  upgradeDefaults_();
  styleResponseHeaders_();
  protectSheets_();
  rememberExecUrl_();
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
    Courses: ['자동 생성 ID', '교과목명', '학년도(예: 2026)', '학기(1/2)', '학년', '분반(사용 안 함)', '수강인원(선택, 비우면 응답률 미표시)',
      '응답 시작일시', '응답 종료일시', 'code=접속코드, token=일회용 토큰', '접속코드(학생이 공통 주소에서 입력. 비우면 자동 생성)',
      '준비/진행/마감(마감=수동 마감)', '결과공개일(비우면 즉시 공개)', '학과', '수업 방식(대면/온라인(비대면)/혼합)', '교과목 유형(이론/실습/이론+실습)'],
    Items: ['문항 ID', "교과목 ID('TEMPLATE'=공통 기본 문항)", '영역', '문항', 'likert5|single|multi|select|text',
      '필수 여부', '순서', '역문항 여부(likert5만)', '선택지(| 로 구분)', "표시 조건(online=온라인(비대면)·혼합만, theory=이론 포함만, practice=실습 포함만, 빈칸=항상)"],
    Tokens: ['교과목 ID', '토큰 해시(원문은 저장하지 않음)', '사용 여부'],
    Responses: ['응답 ID(UUID)', '교과목 ID', '제출 날짜(시각은 저장하지 않음)']
  };
  Object.keys(notes).forEach(function (name) {
    sheet_(name).getRange(1, 1, 1, notes[name].length).setNotes([notes[name]]);
  });
}

/** 앱이 관리하는 시트에 「직접 편집 시 경고」 보호(편집은 가능, 저장 전 경고)를 겁니다. 스크립트 동작에는 영향이 없습니다. */
function protectSheets_() {
  var desc = {};
  desc[APP.SHEETS.RESPONSES] = '강의평가 Studio: 직접 편집하면 익명성·토큰 검증이 깨질 수 있습니다.';
  desc[APP.SHEETS.TOKENS] = '강의평가 Studio: 직접 편집하면 익명성·토큰 검증이 깨질 수 있습니다.';
  desc[APP.SHEETS.COURSES] = '강의평가 Studio: 교과목은 관리자 화면 [교과목] 탭에서 수정하세요. 직접 편집하면 접속코드·기간 검증이 깨질 수 있습니다.';
  desc[APP.SHEETS.ITEMS] = '강의평가 Studio: 문항은 관리자 화면 [문항] 탭에서 수정하세요. 직접 편집하면 응답과 문항의 연결이 깨질 수 있습니다.';
  Object.keys(desc).forEach(function (name) {
    var sh = sheet_(name);
    var existing = sh.getProtections(SpreadsheetApp.ProtectionType.SHEET);
    if (existing.length) return;
    sh.protect().setDescription(desc[name]).setWarningOnly(true);
  });
}

/**
 * 이전 버전 템플릿 업그레이드: 공통 기본 문항 중 문구가 기본값 그대로이고 표시 조건이 비어 있는 문항에만
 * 새 표시 조건(이론·실습·온라인)을 채웁니다. 교수가 고친 문항은 건드리지 않습니다.
 */
function upgradeTemplateScopes_() {
  var t = readTable_(APP.SHEETS.ITEMS);
  var col = t.headers.indexOf('scope') + 1;
  if (col < 1) return 0;
  var want = {};
  DEFAULT_ITEMS.forEach(function (d) { if (d[4]) want[d[1]] = d[4]; });
  var n = 0;
  t.rows.forEach(function (r) {
    if (String(r.course_id) !== APP.TEMPLATE_ID || String(r.scope || '') !== '') return;
    if (want[String(r.text)]) { t.sheet.getRange(r._row, col).setValue(want[String(r.text)]); n++; }
  });
  return n;
}

/**
 * 이전 버전 시트 업그레이드(v1.2.2)
 * ① 기본 문항(문구가 기본값 그대로인 문항)을 모두 '필수'로 — 응답이 아직 없는 교과목과 기본 문항 은행만
 * ② 예시 교과목의 학기를 SAMPLE_COURSES 값으로(디지털리터러시와 AI활용 → 1학기) — 응답이 없을 때만
 * ③ 응답자 정보(성별) 기본 문항 삭제 — 기본 문항 은행과 응답이 없는 교과목만 (v1.2.3)
 * ④ 예시 교과목에 넣었던 임시값(반 'A', 수강인원 40) 비우기 (v1.2.3)
 * 응답이 이미 있는 교과목은 설문 구성이 바뀌므로 문항을 건드리지 않습니다.
 */
/** 문구가 바뀐 기본 문항: 이전 문구 → 새 문구 */
var RENAMED_ITEMS = {
  '토의·사례·시뮬레이션 등 다양한 교수학습방법이 활용되었다.': '토의·사례·시뮬레이션·플립러닝·스마트교수법·AI활용 등 다양한 교수학습방법이 활용되었다.'
};

function upgradeDefaults_() {
  var used = {};
  readResponses_().forEach(function (r) { used[String(r.course_id)] = true; });
  // 바뀐 문구 반영: 기본 문항 은행과 응답이 없는 교과목만(응답이 있는 교과목은 문항 의미 보존)
  var renamed = 0;
  var rt = readTable_(APP.SHEETS.ITEMS);
  var textCol = rt.headers.indexOf('text') + 1;
  rt.rows.forEach(function (r) {
    var next = RENAMED_ITEMS[String(r.text)];
    if (!next || used[String(r.course_id)]) return;
    rt.sheet.getRange(r._row, textCol).setValue(next);
    renamed++;
  });
  var n = filterTable_(APP.SHEETS.ITEMS, function (r) {
    var gender = String(r.type) === 'select' && /^성별/.test(String(r.text)) && String(r.domain) === '응답자 정보';
    return !(gender && (String(r.course_id) === APP.TEMPLATE_ID || !used[String(r.course_id)]));
  });
  var defaults = {};
  DEFAULT_ITEMS.forEach(function (d) { defaults[d[1]] = true; });
  var it = readTable_(APP.SHEETS.ITEMS);
  var reqCol = it.headers.indexOf('required') + 1;
  it.rows.forEach(function (r) {
    if (used[String(r.course_id)] || toBool_(r.required) || !defaults[String(r.text)]) return;
    it.sheet.getRange(r._row, reqCol).setValue(true);
    n++;
  });
  var ct = readTable_(APP.SHEETS.COURSES);
  var semCol = ct.headers.indexOf('semester') + 1;
  ct.rows.forEach(function (r) {
    var id = String(r.course_id);
    if (id.indexOf('demo') !== 0 || used[id]) return;
    var spec = SAMPLE_COURSES.filter(function (x) { return x.course_name === String(r.course_name) && x.semester; })[0];
    if (spec && String(r.semester) !== spec.semester) { ct.sheet.getRange(r._row, semCol).setValue(asTextCell_(spec.semester)); n++; }
  });
  var secCol = ct.headers.indexOf('section') + 1, enrCol = ct.headers.indexOf('enrollment') + 1;
  ct.rows.forEach(function (r) {
    if (String(r.course_id).indexOf('demo') !== 0) return;
    if (String(r.section) === 'A') { ct.sheet.getRange(r._row, secCol).setValue(''); n++; }
    if (Number(r.enrollment) === 40) { ct.sheet.getRange(r._row, enrCol).setValue(''); n++; }
  });

  // v1.3: F 영역 기본 문항 5개, 예시 교과목 CLO 5개 — 이전 기본 2개를 그대로 가진 곳(응답 없음)에만 추가
  var fDefaults = DEFAULT_ITEMS.filter(function (d) { return d[0] === 'F. 디지털·AI 활용'; })
    .map(function (d) { return { domain: d[0], text: d[1], type: d[2], scope: d[4] || '' }; });
  var targets = [APP.TEMPLATE_ID].concat(getCourses_().map(function (c) { return c.course_id; }));
  targets.forEach(function (id) {
    if (!used[id]) n += addMissingItems_(id, fDefaults, 2);
  });
  getCourses_().forEach(function (c) {
    if (c.course_id.indexOf('demo') !== 0 || used[c.course_id]) return;
    var spec = SAMPLE_COURSES.filter(function (x) { return x.course_name === c.course_name; })[0];
    if (!spec) return;
    n += addMissingItems_(c.course_id, spec.clos.map(function (t) { return { domain: CLO_DOMAIN, text: t, type: 'likert5', scope: '' }; }), 2);
  });
  return n + renamed;
}

/**
 * 기본 문항 목록(같은 영역) 중 빠진 문항을 그 영역의 마지막 문항 뒤에 넣습니다.
 * 이전 버전 기본 문항(앞 baseCount개)이 모두 있을 때만 추가해, 교수가 지운 영역은 되살리지 않습니다.
 */
function addMissingItems_(courseId, wanted, baseCount) {
  var items = getItems_(courseId);
  var has = {};
  items.forEach(function (it) { has[it.text] = true; });
  if (!wanted.slice(0, baseCount).every(function (w) { return has[w.text]; })) return 0;
  var missing = wanted.filter(function (w) { return !has[w.text]; });
  if (!missing.length) return 0;
  var domain = wanted[0].domain;
  var last = -1;
  items.forEach(function (it, i) { if (it.domain === domain) last = i; });
  if (last < 0) {
    // 아직 없는 영역: 알파벳 순서상 뒤 영역(또는 서술형) 바로 앞에 넣습니다.
    var after = -1;
    items.forEach(function (it, i) { if (domainRank_(it.domain) <= domainRank_(domain)) after = i; });
    last = after;
  }
  var merged = items.slice(0, last + 1).concat(missing.map(function (w) {
    return { item_id: '', domain: w.domain, text: w.text, type: w.type, required: true, reverse: false, options: [], scope: w.scope || '' };
  }), items.slice(last + 1));
  var all = readTable_(APP.SHEETS.ITEMS);
  var taken = {};
  all.rows.forEach(function (r) { taken[String(r.item_id)] = true; });
  var rows = merged.map(function (it, i) {
    var c = JSON.parse(JSON.stringify(it));
    if (!c.item_id) {
      c.item_id = courseId === APP.TEMPLATE_ID ? templateItemId_(taken) : newItemId_(taken);
      taken[c.item_id] = true;
    }
    c.course_id = courseId;
    c.order = i + 1;
    return itemToRow_(c);
  });
  var kept = all.rows.filter(function (r) { return String(r.course_id) !== courseId; })
    .map(function (r) { return HEADERS.Items.map(function (h) { return r[h] == null ? '' : r[h]; }); });
  rewriteBody_(all.sheet, HEADERS.Items.length, kept.concat(rows));
  return missing.length;
}

/** 기본 문항 은행용 ID(t01, t02, …) 중 비어 있는 다음 번호 */
function templateItemId_(taken) {
  for (var i = 1; i < 1000; i++) {
    var id = 't' + (i < 10 ? '0' + i : String(i));
    if (!taken[id]) return id;
  }
  return newItemId_(taken);
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
    year: spec.year || Number(Utilities.formatDate(now, tz_(), 'yyyy')) - (month <= 2 ? 1 : 0),
    semester: spec.semester || (month >= 3 && month <= 8 ? '1' : '2'),
    grade: spec.grade,
    section: spec.section,
    enrollment: spec.enrollment,
    start_at: start,
    end_at: end,
    access_mode: 'code',
    access_code: demoAccessCode_(),
    status: APP.STATUS.OPEN,
    result_open_date: '',
    department: depts[0],
    delivery_mode: spec.delivery_mode,
    course_type: spec.course_type || '이론+실습'
  };
  var sh = sheet_(APP.SHEETS.COURSES);
  var row = courseToRow_(course);
  sh.getRange(sh.getLastRow() + 1, 1, 1, row.length).setValues([row]);

  // 기본 문항 복사(대면이면 온라인 문항 제외) 후 C 영역 뒤에 CLO 문항 삽입
  var template = getItems_(APP.TEMPLATE_ID); // 모두 복사, 화면에는 교과목 조건에 맞는 문항만 표시
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
  if (spec.extra) addMissingItems_(course.course_id, spec.extra, 0);
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
  rememberExecUrl_();
  var url = studentBaseUrl_(getSettingsMap_());
  var ui = SpreadsheetApp.getUi();
  if (!url) {
    ui.alert('학생용 웹 앱 주소(/exec)를 찾지 못했습니다.\n\n' +
      '① Apps Script 편집기 ▸ [배포] ▸ [새 배포] ▸ 웹 앱으로 배포했는지 확인하세요.\n' +
      '② [배포] ▸ [배포 관리]에 표시된 웹 앱 URL(…/exec)로 관리자 화면에 한 번 접속하면 자동으로 저장됩니다.\n' +
      '   (「테스트 배포」의 …/dev 주소는 학생이 열 수 없습니다.)');
    return;
  }
  var html = HtmlService.createHtmlOutput(
    '<div style="font-family:sans-serif;font-size:14px;line-height:1.7">' +
    '<p><b>교수 관리자 화면</b><br><a href="' + url + '?page=admin" target="_blank">' + url + '?page=admin</a></p>' +
    '<p><b>학생 접속 주소</b>는 관리자 화면 ▸ 교과목 ▸ [접속 주소]에서 확인하세요(공통 주소 + 접속코드).</p></div>'
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
    styleResponseHeaders_();
    // 교과목별로 응답이 들어간 열 범위(시트에서 찾기 쉽게 안내)
    var headers = readTable_(APP.SHEETS.RESPONSES).headers;
    var where = demos.map(function (course) {
      var idx = itemsForCourse_(course).map(function (it) { return headers.indexOf(it.item_id); }).filter(function (i) { return i >= 0; });
      return { course: course.course_name, from: colLetter_(Math.min.apply(null, idx) + 1), to: colLetter_(Math.max.apply(null, idx) + 1) };
    });
    return { ok: true, where: where };
  });
  if (result.ok) result.created = made;
  notify_('샘플 응답 생성', result.ok
    ? names.join(', ') + '에 교과목마다 샘플 응답 30건(총 ' + made + '건)을 만들었습니다.\n\n' +
      'Responses 시트에서 응답이 들어간 열(머리글 색으로 구분):\n' +
      result.where.map(function (w) { return '· ' + w.course + ' 30건 → ' + w.from + '~' + w.to + '열'; }).join('\n') +
      '\n(다른 교과목의 문항 열은 빈칸이 정상입니다.)\n\n⚠ 실제 강의평가를 시작하기 전에 메뉴 ▸ [테스트] 샘플 데이터 모두 삭제를 실행하세요.'
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
        // 필수 문항은 항상 채움(선택 문항만 일부 비움)
        rowObj[it.item_id] = it.required || Math.random() < 0.7 ? asTextCell_(pool[Math.floor(Math.random() * pool.length)]) : '';
      } else if (it.type === 'select') {
        var x = Math.random();
        rowObj[it.item_id] = x < 0.08 && !it.required ? '' : asTextCell_(it.options[x < 0.30 ? 0 : 1] || it.options[0]);
      } else if (it.type === 'single') {
        rowObj[it.item_id] = asTextCell_(it.options[Math.floor(Math.random() * it.options.length)]);
      } else if (it.type === 'multi') {
        var picked = it.options.filter(function () { return Math.random() < 0.4; });
        if (!picked.length && it.required) picked = [it.options[Math.floor(Math.random() * it.options.length)]];
        rowObj[it.item_id] = picked.length ? asTextCell_(picked.join('; ')) : '';
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
      var ans = ui.alert('샘플 데이터 삭제', 'SAMPLE 응답만 삭제합니다. 교과목·문항·접속코드는 그대로 유지됩니다. 계속할까요?', ui.ButtonSet.YES_NO);
      if (ans !== ui.Button.YES) return { ok: false, code: 'CANCELLED' };
    }
  }
  var result = withLock_(function () {
    var removed = filterTable_(APP.SHEETS.RESPONSES, function (r) {
      return String(r.response_id).indexOf('SAMPLE-') !== 0;
    });
    // 교과목(예시 교과목 포함)은 지우지 않습니다. 예시 교과목을 실제 수업에 쓰는 경우가 많고,
    // 지웠다가 다시 만들면 교과목 ID·접속코드가 바뀌어 이미 안내한 접속코드가 바뀌기 때문입니다.
    pruneResponseColumns_();
    return { ok: true, removed: removed };
  });
  notify_('샘플 데이터 삭제', result.ok
    ? '샘플 응답 ' + result.removed + '건을 삭제했습니다.\n교과목·문항·접속코드는 그대로입니다.'
    : '다른 작업이 진행 중입니다.');
  return result;
}

/**
 * 응답 시트의 문항 열 정리. 데이터가 있는 열은 항상 남깁니다.
 * dropAllEmpty=false: 지워진 문항의 빈 열만 / true: 데이터가 없는 문항 열 모두(응답이 들어오면 필요한 열은 자동으로 다시 생김)
 * 정리한 열 수를 반환합니다.
 */
function pruneResponseColumns_(dropAllEmpty) {
  var t = readTable_(APP.SHEETS.RESPONSES);
  var live = {};
  getAllItems_().forEach(function (it) { live[it.item_id] = true; });
  var keep = t.headers.filter(function (h, i) {
    if (i < HEADERS.Responses.length) return true;
    if (!h) return false;
    if (t.rows.some(function (r) { return r[h] !== '' && r[h] != null; })) return true;
    return !dropAllEmpty && !!live[h];
  });
  var removed = t.headers.filter(String).length - keep.length;
  if (keep.length === t.headers.length) return 0;
  var sh = t.sheet;
  var width = sh.getLastColumn();
  sh.getRange(1, 1, Math.max(1, sh.getLastRow()), width).clearContent();
  sh.getRange(1, 1, 1, width).clearNote();
  sh.getRange(1, 1, 1, keep.length).setValues([keep]).setFontWeight('bold');
  var body = t.rows.map(function (r) { return keep.map(function (h) { return r[h] == null ? '' : r[h]; }); });
  if (body.length) sh.getRange(2, 1, body.length, keep.length).setValues(body);
  if (width > keep.length) sh.getRange(1, keep.length + 1, 1, width - keep.length).setBackground(null);
  styleResponseHeaders_();
  return removed;
}

/** 메뉴: 학기 시작 전 응답 시트에서 데이터가 없는 문항 열을 정리합니다(응답 데이터는 그대로). */
function cleanResponseSheet() {
  var result = withLock_(function () { return { ok: true, removed: pruneResponseColumns_(true) }; });
  notify_('응답 시트 빈 열 정리', result.ok
    ? (result.removed ? '데이터가 없는 문항 열 ' + result.removed + '개를 정리했습니다.' : '정리할 빈 열이 없습니다.') +
      '\n\n응답 데이터는 그대로이며, 새 응답이 들어오면 필요한 열이 자동으로 만들어집니다.'
    : '다른 작업이 진행 중입니다. 잠시 후 다시 실행하세요.');
  return result;
}

/* ───────────────────────────── 보조 ───────────────────────────── */

/** 열 번호(1부터) → 시트 열 이름(A, B, …, Z, AA, …) */
function colLetter_(n) {
  var s = '';
  while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

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


/** 더 이상 쓰지 않는 설정 키(v1.5 독립형 설치에서 추가) */
var OBSOLETE_SETTINGS = ['script_id', 'webapp_script_id'];
/** v1.4.4~1.4.7 단축 주소 기능의 설정(기능 삭제) — 학생 주소와 무관하므로 행만 지웁니다. */
var OBSOLETE_SHORT_SETTINGS = ['short_url', 'short_url_target'];

/** Settings 시트에서 주어진 키의 행을 지우고, 지운 행 수를 돌려줍니다. */
function removeSettings_(keys) {
  var t = readTable_(APP.SHEETS.SETTINGS);
  var rows = t.rows.filter(function (r) { return keys.indexOf(String(r.key).trim()) >= 0; })
    .map(function (r) { return r._row; }).sort(function (a, b) { return b - a; });
  rows.forEach(function (n) { t.sheet.deleteRow(n); });
  return rows.length;
}

/** 접속코드 방식인데 코드가 비어 있는 교과목에 겹치지 않는 코드를 채웁니다. 채운 수를 돌려줍니다. */
function fillMissingAccessCodes_() {
  var t = readTable_(APP.SHEETS.COURSES);
  var col = HEADERS.Courses.indexOf('access_code') + 1;
  var n = 0;
  t.rows.forEach(function (r) {
    if (String(r.access_mode) === 'token' || String(r.access_code || '').trim()) return;
    var code = uniqueAccessCode_(t.rows);
    r.access_code = code;
    t.sheet.getRange(r._row, col).setValue(asTextCell_(code));
    n++;
  });
  return n;
}

/** 예시 교과목 접속코드: NURSE + 숫자 2자리, 다른 교과목과 겹치지 않게(겹치면 무작위 6자리) */
function demoAccessCode_() {
  var used = {};
  getCourses_().forEach(function (c) { used[String(c.access_code || '').trim().toUpperCase()] = true; });
  for (var i = 0; i < 30; i++) {
    var code = 'NURSE' + randomString_(2, '23456789');
    if (!used[code]) return code;
  }
  return uniqueAccessCode_(readTable_(APP.SHEETS.COURSES).rows);
}

/** Courses 시트의 이전 수업 방식 이름을 현재 이름으로 바꿉니다. 바꾼 수를 돌려줍니다. */
function renameDeliveryModes_() {
  var t = readTable_(APP.SHEETS.COURSES);
  var col = HEADERS.Courses.indexOf('delivery_mode') + 1;
  var n = 0;
  t.rows.forEach(function (r) {
    var next = APP.DELIVERY_RENAMED[String(r.delivery_mode).trim()];
    if (next) { t.sheet.getRange(r._row, col).setValue(next); n++; }
  });
  return n;
}

/**
 * SAMPLE_COURSES의 교과목별 추가 문항(extra)을 같은 이름의 교과목에 넣습니다.
 * 응답이 없는 교과목에만, 교과목마다 한 번만(교수가 지운 문항은 다시 넣지 않음) 적용합니다.
 */
function addCourseExtraItems_() {
  var done = String(getSettingsMap_().extra_items_added || '').split('\n').filter(String);
  var used = {};
  readResponses_().forEach(function (r) { used[String(r.course_id)] = true; });
  var n = 0;
  getCourses_().forEach(function (c) {
    var spec = SAMPLE_COURSES.filter(function (x) { return x.extra && x.course_name === String(c.course_name).trim(); })[0];
    if (!spec) return;
    if (!used[c.course_id]) n += moveExtraItems_(c.course_id, spec.extra);
    if (done.indexOf(c.course_id) >= 0) return;
    if (!used[c.course_id]) n += addMissingItems_(c.course_id, spec.extra, 0);
    done.push(c.course_id);
  });
  setSetting_('extra_items_added', done.join('\n'), '교과목별 추가 문항을 넣은 교과목 ID(다시 넣지 않음). 직접 수정 금지');
  return n;
}

/** 영역 정렬 순서: 'A.'~'Z.' 알파벳 순, 그 밖(서술형 등)은 맨 뒤 */
function domainRank_(d) {
  var m = /^([A-Z])\./.exec(String(d || ''));
  return m ? m[1].charCodeAt(0) : 1000;
}

/** 추가 문항이 다른 영역에 들어가 있으면(이전 버전: F 영역) 지정 영역으로 옮기고 위치를 맞춥니다. */
function moveExtraItems_(courseId, extra) {
  var texts = extra.map(function (w) { return w.text; });
  var items = getItems_(courseId);
  var wrong = items.filter(function (it) { return texts.indexOf(it.text) >= 0 && it.domain !== extra[0].domain; });
  if (!wrong.length) return 0;
  var rest = items.filter(function (it) { return texts.indexOf(it.text) < 0; });
  var all = readTable_(APP.SHEETS.ITEMS);
  var kept = all.rows.filter(function (r) { return String(r.course_id) !== courseId; })
    .map(function (r) { return HEADERS.Items.map(function (h) { return r[h] == null ? '' : r[h]; }); });
  rewriteBody_(all.sheet, HEADERS.Items.length, kept.concat(rest.map(function (it, i) {
    var c = JSON.parse(JSON.stringify(it)); c.course_id = courseId; c.order = i + 1; return itemToRow_(c);
  })));
  addMissingItems_(courseId, extra, 0);
  return wrong.length;
}

