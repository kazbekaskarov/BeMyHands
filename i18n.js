/* Qolda — i18n
 * Lightweight, no deps. Languages: ru, en, kk, tr.
 *
 * Usage in HTML:
 *   <span data-i18n="nav.cursor"></span>
 *   <input data-i18n-placeholder="voice.transcript_placeholder">
 *   <option data-i18n="voice.lang_ru">…</option>
 *
 * Usage in JS:
 *   window.i18n.t('status.loading')
 *   window.i18n.setLang('en')
 *   window.i18n.onChange(cb)
 */
(function () {
  const DICT = {
    /* ===================== RUSSIAN ===================== */
    ru: {
      'app.title': 'Qolda',
      'app.subtitle': 'управление лицом и голосом',
      'nav.overview':    'Обзор',
      'nav.cursor':      'Курсор',
      'nav.gestures':    'Жесты',
      'nav.voice':       'Голос',
      'nav.handsfree':   'Hands-free',
      'nav.permissions': 'Разрешения',
      'nav.lang':        'Язык',

      'status.loading':       'Загрузка…',
      'status.use_mode':      'Режим использования',
      'status.use_mode_hint': 'Скрыть окно — останется только тонкая полоса сверху',

      'overview.eyebrow': 'Обзор',
      'overview.title':   'Управляйте Mac движениями лица и голосом',
      'overview.lede':    'Камера и микрофон обрабатываются локально. Калибруйтесь, включайте управление и работайте без рук.',
      'overview.start':   'Включить управление',
      'overview.stop':    'Остановить управление',
      'overview.calib':   'Калибровать',

      'cam.title':    'Камера',
      'cam.step1':    'Сядьте лицом к камере, голова в нейтральной позе.',
      'cam.step2_a':  'Нажмите',
      'cam.step2_b':  '— это становится «центром».',
      'cam.step3':    'Включите управление и двигайте головой, чтобы вести курсор.',

      'stat.state':    'Состояние',
      'stat.state_sub':'cursor · gestures · voice',
      'stat.perf':     'Производительность',
      'stat.perf_sub': 'кадров с лицом / секунду',
      'stat.model':    'Модель',
      'stat.model_sub':'MediaPipe Tasks Vision',

      'sec.section': 'Раздел',

      'cursor.title':       'Курсор',
      'cursor.lede':        'Источник позиции и поведение по умолчанию.',
      'cursor.source':      'Источник позиции',
      'cursor.source_nose': 'Нос — стабильнее',
      'cursor.source_eyes': 'Между глаз',
      'cursor.smooth':      'Сглаживание',
      'cursor.sens_x':      'Чувствительность X',
      'cursor.sens_y':      'Чувствительность Y',
      'cursor.dwell_t':     'Dwell-клик',
      'cursor.dwell_d':     'Левый клик после 1.2 с без движения курсора.',

      'gest.title':       'Жесты лицом',
      'gest.lede':        'Каждый жест → действие. Полоса справа — текущая «уверенность» модели.',
      'gest.h_gesture':   'Жест',
      'gest.h_action':    'Действие',
      'gest.h_threshold': 'Порог',
      'gest.h_now':       'Сейчас',
      'gest.mouth':       'Открыть рот',
      'gest.mouth_act':   'Левый клик',
      'gest.brow':        'Поднять брови',
      'gest.brow_act':    'Правый клик',
      'gest.smile':       'Улыбнуться',
      'gest.smile_act':   'Двойной клик',
      'gest.winkL':       'Прищурить левый глаз',
      'gest.winkL_act':   'Зажать ЛКМ',
      'gest.winkR':       'Прищурить правый глаз',
      'gest.winkR_act':   'Прокрутка',
      'gest.drag':        '<b>Drag.</b> Удерживайте левый глаз закрытым — ЛКМ зажата, ведите головой. Открыли — освободилась.',
      'gest.scroll':      '<b>Scroll.</b> Закройте правый глаз — наклон головы вверх/вниз прокручивает страницу.',
      'tag.drag':   'drag',
      'tag.scroll': 'scroll',

      'voice.title':       'Голосовой ввод',
      'voice.lede':        'Печать голосом и команды. Local Whisper работает офлайн.',
      'voice.start':       'Начать голосовой ввод',
      'voice.stop':        'Остановить голос',
      'voice.lang':        'Язык',
      'voice.engine':      'Движок',
      'voice.engine_local':'Local Whisper (offline)',
      'voice.engine_web':  'Web Speech (онлайн)',
      'voice.engine_oai':  'OpenAI Whisper (.env)',
      'voice.continuous_t':'Непрерывный режим',
      'voice.continuous_d':'Автоматически нарезает речь по тишине и печатает фразы.',
      'voice.transcript_ph':'Здесь появится распознанный текст. Команды: «клик», «пауза», «продолжи», «открой ютуб / телеграм», «найди коты в шапках».',

      'voice.gate_hint_a':       'Скажи',
      'voice.gate_hint_b':       'печать с голоса остановится',
      'voice.gate_hint_c':       'снова включится',
      'voice.gate_state_listen': '🎙 слушаю',
      'voice.gate_state_muted':  '🔇 не слышу',

      'hf.title':            'Hands-free поведение',
      'hf.lede':              'Чтобы пользоваться без рук — даже при ошибках камеры.',
      'hf.autostart_t':      'Автозапуск при открытии',
      'hf.autostart_d':      'Сразу включает управление курсором и непрерывный голос. Нужна сохранённая калибровка.',
      'hf.autopause_t':      'Авто-пауза без лица',
      'hf.autopause_d':      'Если 2 секунды нет лица в кадре — управление приостанавливается.',
      'hf.corners_t':        'Углы экрана',
      'hf.corners_d':        'TL — пауза/возобновить · TR — показать окно · BR — аварийный стоп.',
      'hf.cmds_t':           'Голосовые команды',
      'hf.cmds_d':           'Управление: «пауза», «клик», «вверх» · Запуск: «открой ютуб / телеграм / vs code», «найди X» · Редактор: «сохрани», «отмени», «найди», «команда», «терминал», «следующая вкладка», «назад» · Точность: «точно».',

      'perm.title':   'Разрешения macOS',
      'perm.lede':    'Настроили один раз — и забыли.',
      'perm.req':     'обязательно',
      'perm.open':    'Открыть панель',
      'perm.acc_d':   'Чтобы курсор и клавиатура работали в других приложениях.',
      'perm.cam_d':   'Для отслеживания лица локально на устройстве.',
      'perm.mic_d':   'Для голосового ввода и команд.',
      'perm.note_a':  'После выдачи прав',
      'perm.note_b':  'перезапустите приложение.',

      // Renderer dynamic strings:
      'd.calib_loaded':    'Сохранённая калибровка загружена.',
      'd.no_face':         'Лицо не найдено. Подвиньтесь к камере.',
      'd.calibrated':      'Откалибровано. Двигайте головой — курсор будет следовать.',
      'd.calib_first':     'Сначала откалибруйте центр.',
      'd.calib_in':        'Калибровка через',
      'd.calib_in_look':   '… смотрите прямо в камеру',
      'd.autostart_calib': 'Автозапуск активен. Для курсора нажмите «Калибровать» в нейтральной позе.',
      'd.paused':          '⏸ Пауза',
      'd.resumed':         '▶ Управление активно',
      'd.face_back':       'Лицо снова в кадре',
      'd.estop':           '🛑 Аварийная пауза (правый-нижний угол)',
      'd.autostart_all':   '▶ Автозапуск: всё активно',
      'd.cmd':             'команда',
      'd.launch':          'запуск',
      'd.precision':       '🎯 Precision mode',
      'd.calibration':     '🎯 КАЛИБРОВКА',

      // Mode badges
      'd.mode_drag':   '🖱 ПЕРЕТАСКИВАНИЕ',
      'd.mode_scroll': '↕ ПРОКРУТКА',
      'd.mode_pause':  '⏸ ПАУЗА',
      'd.mode_noface': '👤❌ нет лица',

      // Engine option labels
      'd.voice_local_missing': 'Local Whisper (нет модели/CLI — npm run setup)',
      'd.voice_local_ready':   'Local Whisper (офлайн, {model})',

      // Boot / camera / model
      'd.mp_loading':         'Загружаю MediaPipe wasm…',
      'd.mp_gpu_fail':        'GPU не доступен, перехожу на CPU…',
      'd.mp_loaded':          'Модель загружена ({delegate}). Открываю камеру…',
      'd.cam_no_avail':       'нет доступной камеры',
      'd.cam_open_fail':      'Камера не открылась → {reason}',
      'd.cam_disconnect':     'Камера отключилась. Переподключаюсь…',
      'd.cam_reconnect_fail': 'Не удалось переподключить камеру: {msg}',
      'd.cam_ready':          'Готово (камера {w}×{h}). Калибруйте центр (🎯).',
      'd.init_err':           'Ошибка инициализации: {msg}',

      // Diagnostics (5s self-check)
      'd.diag_no_frames': '❌ Камера не отдаёт кадры (videoWidth={w}, readyState={r}). Открыта ли камера в другом приложении? Проверьте System Settings → Camera.',
      'd.diag_no_face':   '⚠ Кадры идут ({n}/5с), но лицо не найдено. Освещение/позиция перед камерой? detectErrors={e}{tail}',
      'd.diag_ok':        '✓ Работает: {f}/{n} кадров с лицом за 5с ({d}).',

      // Camera card chips
      'd.chip_no_stream': 'нет потока',
      'd.chip_face':      'лицо {n}/с',
      'd.chip_no_face':   'нет лица',

      // State tile
      'd.s_ready':   'Готов',
      'd.s_paused':  'Пауза',
      'd.s_noface':  'Нет лица',
      'd.s_active':  'Активно',

      // Status messages
      'd.ctrl_active':     'Управление активно',
      'd.ready_short':     'Готово',
      'd.reason_no_video': 'нет видео-потока (камера занята другим приложением?)',
      'd.reason_mp_err':   'ошибка MediaPipe: {msg}',
      'd.reason_face_out': 'лицо вне кадра',
      'd.autopause':       'Авто-пауза: {reason}',

      // Voice transcript bracketed lines
      'd.voice_stop':        'Остановить голос',
      'd.voice_start':       'Начать голосовой ввод',
      'd.webspeech_missing': '[Web Speech API недоступен в этой сборке Electron. Переключитесь на Local Whisper]',
      'd.recog_err':         '[ошибка распознавания: {err}]',
      'd.start_fail':        '[не удалось запустить: {err}]',
      'd.send_oai':          '[отправляю в OpenAI Whisper…]',
      'd.whisper_err':       '[Whisper ошибка: {reason}]',
      'd.mic_unavailable':   '[микрофон недоступен: {err}]',
      'd.local_no_cli':      '[Local Whisper: не найден whisper-cli. Установите: brew install whisper-cpp]',
      'd.local_no_model':    '[Local Whisper: модель не найдена ({path}). Запустите: npm run setup]',
      'd.local_ready_cont':  '[Local Whisper готов. Говорите — буду печатать после каждой паузы.]',
      'd.local_ready_once':  '[Local Whisper: запись… нажмите ⏹, чтобы распознать.]',
      'd.send_err':          '[ошибка отправки: {err}]',
      'd.cmd_log':           '[команда: {cmd}]',
      'd.launch_log':        '[запуск: {label}]',
      'd.search_label':      'поиск «{q}»',
      'd.muted':             '🔇 Печать с голоса выключена. Скажи «слушай», чтобы продолжить.',
      'd.listening':         '🎙 Печать с голоса снова включена.',
      'd.muted_log':         '[пропущено: «{text}»]',
    },

    /* ===================== ENGLISH ===================== */
    en: {
      'app.title': 'Qolda',
      'app.subtitle': 'face & voice control',
      'nav.overview':    'Overview',
      'nav.cursor':      'Cursor',
      'nav.gestures':    'Gestures',
      'nav.voice':       'Voice',
      'nav.handsfree':   'Hands-free',
      'nav.permissions': 'Permissions',
      'nav.lang':        'Language',

      'status.loading':       'Loading…',
      'status.use_mode':      'Use mode',
      'status.use_mode_hint': 'Hide the window — only a thin top bar stays',

      'overview.eyebrow': 'Overview',
      'overview.title':   'Control your Mac with face motion and voice',
      'overview.lede':    'Camera and microphone are processed locally. Calibrate, enable control, and work hands-free.',
      'overview.start':   'Enable control',
      'overview.stop':    'Stop control',
      'overview.calib':   'Calibrate',

      'cam.title':    'Camera',
      'cam.step1':    'Sit facing the camera, head in a neutral pose.',
      'cam.step2_a':  'Press',
      'cam.step2_b':  '— this becomes the “center”.',
      'cam.step3':    'Enable control and move your head to drive the cursor.',

      'stat.state':    'State',
      'stat.state_sub':'cursor · gestures · voice',
      'stat.perf':     'Performance',
      'stat.perf_sub': 'frames with face / second',
      'stat.model':    'Model',
      'stat.model_sub':'MediaPipe Tasks Vision',

      'sec.section': 'Section',

      'cursor.title':       'Cursor',
      'cursor.lede':        'Position source and default behavior.',
      'cursor.source':      'Position source',
      'cursor.source_nose': 'Nose — more stable',
      'cursor.source_eyes': 'Between the eyes',
      'cursor.smooth':      'Smoothing',
      'cursor.sens_x':      'Sensitivity X',
      'cursor.sens_y':      'Sensitivity Y',
      'cursor.dwell_t':     'Dwell click',
      'cursor.dwell_d':     'Left click after 1.2 s of no cursor movement.',

      'gest.title':       'Face gestures',
      'gest.lede':        'Each gesture → action. The bar on the right is the model’s current confidence.',
      'gest.h_gesture':   'Gesture',
      'gest.h_action':    'Action',
      'gest.h_threshold': 'Threshold',
      'gest.h_now':       'Now',
      'gest.mouth':       'Open mouth',
      'gest.mouth_act':   'Left click',
      'gest.brow':        'Raise brows',
      'gest.brow_act':    'Right click',
      'gest.smile':       'Smile',
      'gest.smile_act':   'Double click',
      'gest.winkL':       'Squint left eye',
      'gest.winkL_act':   'Hold LMB',
      'gest.winkR':       'Squint right eye',
      'gest.winkR_act':   'Scroll',
      'gest.drag':        '<b>Drag.</b> Keep the left eye closed — LMB stays held, drive with your head. Open it to release.',
      'gest.scroll':      '<b>Scroll.</b> Close the right eye — tilt your head up/down to scroll.',
      'tag.drag':   'drag',
      'tag.scroll': 'scroll',

      'voice.title':       'Voice input',
      'voice.lede':        'Voice typing and commands. Local Whisper works offline.',
      'voice.start':       'Start voice input',
      'voice.stop':        'Stop voice',
      'voice.lang':        'Language',
      'voice.engine':      'Engine',
      'voice.engine_local':'Local Whisper (offline)',
      'voice.engine_web':  'Web Speech (online)',
      'voice.engine_oai':  'OpenAI Whisper (.env)',
      'voice.continuous_t':'Continuous mode',
      'voice.continuous_d':'Automatically slices speech by silence and types out phrases.',
      'voice.transcript_ph':'Recognized text appears here. Commands: “click”, “pause”, “resume”, “open youtube / telegram”, “search cats in hats”.',

      'voice.gate_hint_a':       'Say',
      'voice.gate_hint_b':       'voice typing turns off',
      'voice.gate_hint_c':       'turns back on',
      'voice.gate_state_listen': '🎙 listening',
      'voice.gate_state_muted':  '🔇 muted',

      'hf.title':            'Hands-free behavior',
      'hf.lede':              'For using the Mac without hands — even when the camera glitches.',
      'hf.autostart_t':      'Auto-start on open',
      'hf.autostart_d':      'Immediately enables cursor control and continuous voice. Requires saved calibration.',
      'hf.autopause_t':      'Auto-pause without face',
      'hf.autopause_d':      'If there’s no face in frame for 2 seconds, control pauses.',
      'hf.corners_t':        'Hot corners',
      'hf.corners_d':        'TL — pause/resume · TR — show window · BR — emergency stop.',
      'hf.cmds_t':           'Voice commands',
      'hf.cmds_d':           'Control: “pause”, “click”, “up” · Launch: “open youtube / telegram / vs code”, “search X” · Editor: “save”, “undo”, “find”, “command”, “terminal”, “next tab”, “back” · Precision: “precision”.',

      'perm.title':   'macOS permissions',
      'perm.lede':    'Set up once and forget.',
      'perm.req':     'required',
      'perm.open':    'Open panel',
      'perm.acc_d':   'So the cursor and keyboard work in other applications.',
      'perm.cam_d':   'For tracking your face locally on this device.',
      'perm.mic_d':   'For voice typing and commands.',
      'perm.note_a':  'After granting permissions,',
      'perm.note_b':  'restart the application.',

      'd.calib_loaded':    'Saved calibration loaded.',
      'd.no_face':         'No face detected. Move closer to the camera.',
      'd.calibrated':      'Calibrated. Move your head — the cursor will follow.',
      'd.calib_first':     'Calibrate the center first.',
      'd.calib_in':        'Calibrating in',
      'd.calib_in_look':   '… look straight into the camera',
      'd.autostart_calib': 'Auto-start is on. Press “Calibrate” in a neutral pose to enable the cursor.',
      'd.paused':          '⏸ Paused',
      'd.resumed':         '▶ Control active',
      'd.face_back':       'Face is back in frame',
      'd.estop':           '🛑 Emergency pause (bottom-right corner)',
      'd.autostart_all':   '▶ Auto-start: everything active',
      'd.cmd':             'command',
      'd.launch':          'launch',
      'd.precision':       '🎯 Precision mode',
      'd.calibration':     '🎯 CALIBRATION',

      'd.mode_drag':   '🖱 DRAG',
      'd.mode_scroll': '↕ SCROLL',
      'd.mode_pause':  '⏸ PAUSED',
      'd.mode_noface': '👤❌ no face',

      'd.voice_local_missing': 'Local Whisper (no model/CLI — npm run setup)',
      'd.voice_local_ready':   'Local Whisper (offline, {model})',

      'd.mp_loading':         'Loading MediaPipe wasm…',
      'd.mp_gpu_fail':        'GPU unavailable, falling back to CPU…',
      'd.mp_loaded':          'Model loaded ({delegate}). Opening camera…',
      'd.cam_no_avail':       'no camera available',
      'd.cam_open_fail':      'Camera failed to open → {reason}',
      'd.cam_disconnect':     'Camera disconnected. Reconnecting…',
      'd.cam_reconnect_fail': 'Camera reconnect failed: {msg}',
      'd.cam_ready':          'Ready (camera {w}×{h}). Calibrate the center (🎯).',
      'd.init_err':           'Initialization error: {msg}',

      'd.diag_no_frames': '❌ Camera produced no frames (videoWidth={w}, readyState={r}). Is the camera used by another app? Check System Settings → Camera.',
      'd.diag_no_face':   '⚠ Frames are coming ({n}/5s) but no face was detected. Lighting/position in front of the camera? detectErrors={e}{tail}',
      'd.diag_ok':        '✓ Working: {f}/{n} frames with face in 5s ({d}).',

      'd.chip_no_stream': 'no stream',
      'd.chip_face':      'face {n}/s',
      'd.chip_no_face':   'no face',

      'd.s_ready':   'Ready',
      'd.s_paused':  'Paused',
      'd.s_noface':  'No face',
      'd.s_active':  'Active',

      'd.ctrl_active':     'Control active',
      'd.ready_short':     'Ready',
      'd.reason_no_video': 'no video stream (camera busy in another app?)',
      'd.reason_mp_err':   'MediaPipe error: {msg}',
      'd.reason_face_out': 'face out of frame',
      'd.autopause':       'Auto-pause: {reason}',

      'd.voice_stop':        'Stop voice',
      'd.voice_start':       'Start voice input',
      'd.webspeech_missing': '[Web Speech API unavailable in this Electron build. Switch to Local Whisper]',
      'd.recog_err':         '[recognition error: {err}]',
      'd.start_fail':        '[failed to start: {err}]',
      'd.send_oai':          '[sending to OpenAI Whisper…]',
      'd.whisper_err':       '[Whisper error: {reason}]',
      'd.mic_unavailable':   '[microphone unavailable: {err}]',
      'd.local_no_cli':      '[Local Whisper: whisper-cli not found. Install: brew install whisper-cpp]',
      'd.local_no_model':    '[Local Whisper: model not found ({path}). Run: npm run setup]',
      'd.local_ready_cont':  '[Local Whisper ready. Speak — I will type after each pause.]',
      'd.local_ready_once':  '[Local Whisper: recording… press ⏹ to recognize.]',
      'd.send_err':          '[send error: {err}]',
      'd.cmd_log':           '[command: {cmd}]',
      'd.launch_log':        '[launch: {label}]',
      'd.search_label':      'search “{q}”',
      'd.muted':             '🔇 Voice typing is off. Say “listen” to resume.',
      'd.listening':         '🎙 Voice typing is back on.',
      'd.muted_log':         '[muted: “{text}”]',
    },

    /* ===================== KAZAKH ===================== */
    kk: {
      'app.title': 'Qolda',
      'app.subtitle': 'бет және дауыспен басқару',
      'nav.overview':    'Шолу',
      'nav.cursor':      'Меңзер',
      'nav.gestures':    'Қимылдар',
      'nav.voice':       'Дауыс',
      'nav.handsfree':   'Қолсыз',
      'nav.permissions': 'Рұқсаттар',
      'nav.lang':        'Тіл',

      'status.loading':       'Жүктелуде…',
      'status.use_mode':      'Қолдану режимі',
      'status.use_mode_hint': 'Терезені жасыру — жоғарыдағы жұқа тақта ғана қалады',

      'overview.eyebrow': 'Шолу',
      'overview.title':   'Mac-ты бет қимылдарымен және дауыспен басқарыңыз',
      'overview.lede':    'Камера мен микрофон құрылғыда жергілікті өңделеді. Калибрлеп, басқаруды қосып, қолсыз жұмыс істеңіз.',
      'overview.start':   'Басқаруды қосу',
      'overview.stop':    'Басқаруды тоқтату',
      'overview.calib':   'Калибрлеу',

      'cam.title':    'Камера',
      'cam.step1':    'Камераға қарап, басыңызды бейтарап күйде ұстап отырыңыз.',
      'cam.step2_a':  'Басыңыз',
      'cam.step2_b':  '— бұл «орталық» болады.',
      'cam.step3':    'Басқаруды қосып, басыңызды жылжытып меңзерді жүргізіңіз.',

      'stat.state':    'Күй',
      'stat.state_sub':'cursor · gestures · voice',
      'stat.perf':     'Өнімділік',
      'stat.perf_sub': 'бетті анықтаған кадр / секунд',
      'stat.model':    'Модель',
      'stat.model_sub':'MediaPipe Tasks Vision',

      'sec.section': 'Бөлім',

      'cursor.title':       'Меңзер',
      'cursor.lede':        'Орын көзі және әдепкі әрекеттер.',
      'cursor.source':      'Орын көзі',
      'cursor.source_nose': 'Мұрын — тұрақты',
      'cursor.source_eyes': 'Көздер арасы',
      'cursor.smooth':      'Тегістеу',
      'cursor.sens_x':      'Сезімталдық X',
      'cursor.sens_y':      'Сезімталдық Y',
      'cursor.dwell_t':     'Күту бойынша басу',
      'cursor.dwell_d':     'Меңзер 1.2 с қозғалмаса — сол жақ батырма басылады.',

      'gest.title':       'Бет қимылдары',
      'gest.lede':        'Әр қимыл → әрекет. Оң жақтағы жолақ — модельдің ағымдық сенімділігі.',
      'gest.h_gesture':   'Қимыл',
      'gest.h_action':    'Әрекет',
      'gest.h_threshold': 'Шек',
      'gest.h_now':       'Қазір',
      'gest.mouth':       'Аузын ашу',
      'gest.mouth_act':   'Сол жақ басу',
      'gest.brow':        'Қастарын көтеру',
      'gest.brow_act':    'Оң жақ басу',
      'gest.smile':       'Күлу',
      'gest.smile_act':   'Қос басу',
      'gest.winkL':       'Сол көзін қысу',
      'gest.winkL_act':   'Сол батырманы ұстап тұру',
      'gest.winkR':       'Оң көзін қысу',
      'gest.winkR_act':   'Айналдыру',
      'gest.drag':        '<b>Drag.</b> Сол көзді жабық ұстаңыз — сол батырма басылып, басыңызбен сүйрейсіз. Аштыңыз — босады.',
      'gest.scroll':      '<b>Scroll.</b> Оң көзді жабыңыз — басыңызды жоғары/төмен қисайту бетті айналдырады.',
      'tag.drag':   'drag',
      'tag.scroll': 'scroll',

      'voice.title':       'Дауыспен енгізу',
      'voice.lede':        'Дауыспен теру және командалар. Local Whisper желісіз жұмыс істейді.',
      'voice.start':       'Дауысты бастау',
      'voice.stop':        'Дауысты тоқтату',
      'voice.lang':        'Тіл',
      'voice.engine':      'Қозғалтқыш',
      'voice.engine_local':'Local Whisper (желісіз)',
      'voice.engine_web':  'Web Speech (желілік)',
      'voice.engine_oai':  'OpenAI Whisper (.env)',
      'voice.continuous_t':'Үздіксіз режим',
      'voice.continuous_d':'Сөйлеуді үнсіздік бойынша автоматты бөлеп, фразаларды теріп шығарады.',
      'voice.transcript_ph':'Танылған мәтін осында пайда болады. Командалар: «бас», «тоқта», «жалғастыр», «аш ютуб / телеграм», «тап мысықтар».',

      'voice.gate_hint_a':       'Айт',
      'voice.gate_hint_b':       'дауыспен теру тоқтайды',
      'voice.gate_hint_c':       'қайта қосылады',
      'voice.gate_state_listen': '🎙 тыңдап тұрмын',
      'voice.gate_state_muted':  '🔇 тыңдамаймын',

      'hf.title':            'Қолсыз режим параметрлері',
      'hf.lede':              'Қолды қолданбай пайдалану үшін — камера ақаулары кезінде де.',
      'hf.autostart_t':      'Ашқанда автоқосу',
      'hf.autostart_d':      'Меңзерді басқару мен үздіксіз дауысты бірден қосады. Сақталған калибрлеу қажет.',
      'hf.autopause_t':      'Бетсіз авто-кідіріс',
      'hf.autopause_d':      'Кадрда 2 секунд бет болмаса, басқару кідіртіледі.',
      'hf.corners_t':        'Экран бұрыштары',
      'hf.corners_d':        'TL — кідіріс/жалғастыру · TR — терезені көрсету · BR — апаттық тоқтату.',
      'hf.cmds_t':           'Дауыс командалары',
      'hf.cmds_d':           'Басқару: «тоқта», «бас», «жоғары» · Іске қосу: «аш ютуб / телеграм / vs code», «тап X» · Редактор: «сақта», «болдырма», «тап», «команда», «терминал», «келесі қойынды», «артқа» · Дәлдік: «дәл».',

      'perm.title':   'macOS рұқсаттары',
      'perm.lede':    'Бір рет орнатып — ұмытыңыз.',
      'perm.req':     'міндетті',
      'perm.open':    'Тақтаны ашу',
      'perm.acc_d':   'Меңзер мен пернетақта басқа қолданбаларда жұмыс істеуі үшін.',
      'perm.cam_d':   'Бетті құрылғыда жергілікті бақылау үшін.',
      'perm.mic_d':   'Дауыспен енгізу және командалар үшін.',
      'perm.note_a':  'Рұқсаттарды бергеннен кейін',
      'perm.note_b':  'қолданбаны қайта іске қосыңыз.',

      'd.calib_loaded':    'Сақталған калибрлеу жүктелді.',
      'd.no_face':         'Бет табылмады. Камераға жақындаңыз.',
      'd.calibrated':      'Калибрленді. Басыңызды жылжытыңыз — меңзер ереді.',
      'd.calib_first':     'Алдымен орталықты калибрлеңіз.',
      'd.calib_in':        'Калибрлеу',
      'd.calib_in_look':   ' секундта… камераға тура қараңыз',
      'd.autostart_calib': 'Автоқосу қосулы. Меңзер үшін бейтарап күйде «Калибрлеу» түймесін басыңыз.',
      'd.paused':          '⏸ Кідірісте',
      'd.resumed':         '▶ Басқару белсенді',
      'd.face_back':       'Бет қайтадан кадрда',
      'd.estop':           '🛑 Апаттық кідіріс (оң төменгі бұрыш)',
      'd.autostart_all':   '▶ Автоқосу: барлығы белсенді',
      'd.cmd':             'команда',
      'd.launch':          'іске қосу',
      'd.precision':       '🎯 Дәлдік режимі',
      'd.calibration':     '🎯 КАЛИБРЛЕУ',

      'd.mode_drag':   '🖱 СҮЙРЕУ',
      'd.mode_scroll': '↕ АЙНАЛДЫРУ',
      'd.mode_pause':  '⏸ КІДІРІС',
      'd.mode_noface': '👤❌ бет жоқ',

      'd.voice_local_missing': 'Local Whisper (модель/CLI жоқ — npm run setup)',
      'd.voice_local_ready':   'Local Whisper (желісіз, {model})',

      'd.mp_loading':         'MediaPipe wasm жүктелуде…',
      'd.mp_gpu_fail':        'GPU қолжетімсіз, CPU-ға ауысу…',
      'd.mp_loaded':          'Модель жүктелді ({delegate}). Камера ашылуда…',
      'd.cam_no_avail':       'қолжетімді камера жоқ',
      'd.cam_open_fail':      'Камера ашылмады → {reason}',
      'd.cam_disconnect':     'Камера ажыратылды. Қайта қосылуда…',
      'd.cam_reconnect_fail': 'Камераны қайта қосу мүмкін болмады: {msg}',
      'd.cam_ready':          'Дайын (камера {w}×{h}). Орталықты калибрлеңіз (🎯).',
      'd.init_err':           'Іске қосу қатесі: {msg}',

      'd.diag_no_frames': '❌ Камера кадрларды бермейді (videoWidth={w}, readyState={r}). Камера басқа қолданбада ашық па? System Settings → Camera-ны тексеріңіз.',
      'd.diag_no_face':   '⚠ Кадрлар келіп жатыр ({n}/5с), бірақ бет табылмады. Жарықтандыру/орналасу қалай? detectErrors={e}{tail}',
      'd.diag_ok':        '✓ Жұмыс істеп тұр: 5 секундта {f}/{n} кадрда бет ({d}).',

      'd.chip_no_stream': 'ағын жоқ',
      'd.chip_face':      'бет {n}/с',
      'd.chip_no_face':   'бет жоқ',

      'd.s_ready':   'Дайын',
      'd.s_paused':  'Кідірісте',
      'd.s_noface':  'Бет жоқ',
      'd.s_active':  'Белсенді',

      'd.ctrl_active':     'Басқару белсенді',
      'd.ready_short':     'Дайын',
      'd.reason_no_video': 'видео ағыны жоқ (камераны басқа қолданба пайдаланып жатыр ма?)',
      'd.reason_mp_err':   'MediaPipe қатесі: {msg}',
      'd.reason_face_out': 'бет кадрдан тыс',
      'd.autopause':       'Авто-кідіріс: {reason}',

      'd.voice_stop':        'Дауысты тоқтату',
      'd.voice_start':       'Дауысты бастау',
      'd.webspeech_missing': '[Web Speech API бұл Electron құрамасында қолжетімсіз. Local Whisper-ге ауысыңыз]',
      'd.recog_err':         '[тану қатесі: {err}]',
      'd.start_fail':        '[іске қосу мүмкін болмады: {err}]',
      'd.send_oai':          '[OpenAI Whisper-ге жіберілуде…]',
      'd.whisper_err':       '[Whisper қатесі: {reason}]',
      'd.mic_unavailable':   '[микрофон қолжетімсіз: {err}]',
      'd.local_no_cli':      '[Local Whisper: whisper-cli табылмады. Орнатыңыз: brew install whisper-cpp]',
      'd.local_no_model':    '[Local Whisper: модель табылмады ({path}). Орындаңыз: npm run setup]',
      'd.local_ready_cont':  '[Local Whisper дайын. Сөйлеңіз — әр үзілістен кейін теріп шығамын.]',
      'd.local_ready_once':  '[Local Whisper: жазылуда… тануға ⏹ басыңыз.]',
      'd.send_err':          '[жіберу қатесі: {err}]',
      'd.cmd_log':           '[команда: {cmd}]',
      'd.launch_log':        '[іске қосу: {label}]',
      'd.search_label':      '«{q}» іздеу',
      'd.muted':             '🔇 Дауыспен теру өшірілді. Жалғастыру үшін «тыңда» деп айтыңыз.',
      'd.listening':         '🎙 Дауыспен теру қайта қосылды.',
      'd.muted_log':         '[өткізілді: «{text}»]',
    },

    /* ===================== TURKISH ===================== */
    tr: {
      'app.title': 'Qolda',
      'app.subtitle': 'yüz ve ses kontrolü',
      'nav.overview':    'Genel',
      'nav.cursor':      'İmleç',
      'nav.gestures':    'Hareketler',
      'nav.voice':       'Ses',
      'nav.handsfree':   'Eller serbest',
      'nav.permissions': 'İzinler',
      'nav.lang':        'Dil',

      'status.loading':       'Yükleniyor…',
      'status.use_mode':      'Kullanım modu',
      'status.use_mode_hint': 'Pencereyi gizle — yalnızca üstteki ince çubuk kalır',

      'overview.eyebrow': 'Genel',
      'overview.title':   'Mac’i yüz hareketleri ve sesle kontrol edin',
      'overview.lede':    'Kamera ve mikrofon yerel olarak işlenir. Kalibre edin, kontrolü açın ve eller serbest çalışın.',
      'overview.start':   'Kontrolü aç',
      'overview.stop':    'Kontrolü durdur',
      'overview.calib':   'Kalibre et',

      'cam.title':    'Kamera',
      'cam.step1':    'Kameraya bakın, başınız nötr pozisyonda olsun.',
      'cam.step2_a':  'Bas',
      'cam.step2_b':  '— burası “merkez” olur.',
      'cam.step3':    'Kontrolü açıp başınızı oynatarak imleci yönlendirin.',

      'stat.state':    'Durum',
      'stat.state_sub':'cursor · gestures · voice',
      'stat.perf':     'Performans',
      'stat.perf_sub': 'yüz olan kare / saniye',
      'stat.model':    'Model',
      'stat.model_sub':'MediaPipe Tasks Vision',

      'sec.section': 'Bölüm',

      'cursor.title':       'İmleç',
      'cursor.lede':        'Konum kaynağı ve varsayılan davranış.',
      'cursor.source':      'Konum kaynağı',
      'cursor.source_nose': 'Burun — daha kararlı',
      'cursor.source_eyes': 'Gözler arası',
      'cursor.smooth':      'Yumuşatma',
      'cursor.sens_x':      'Hassasiyet X',
      'cursor.sens_y':      'Hassasiyet Y',
      'cursor.dwell_t':     'Bekleme tıklaması',
      'cursor.dwell_d':     'İmleç 1.2 sn hareketsiz kalırsa sol tıklama yapılır.',

      'gest.title':       'Yüz hareketleri',
      'gest.lede':        'Her hareket → eylem. Sağdaki çubuk modelin anlık güveni.',
      'gest.h_gesture':   'Hareket',
      'gest.h_action':    'Eylem',
      'gest.h_threshold': 'Eşik',
      'gest.h_now':       'Şimdi',
      'gest.mouth':       'Ağzı aç',
      'gest.mouth_act':   'Sol tık',
      'gest.brow':        'Kaşları kaldır',
      'gest.brow_act':    'Sağ tık',
      'gest.smile':       'Gülümse',
      'gest.smile_act':   'Çift tık',
      'gest.winkL':       'Sol gözü kıs',
      'gest.winkL_act':   'Sol tuşu basılı tut',
      'gest.winkR':       'Sağ gözü kıs',
      'gest.winkR_act':   'Kaydır',
      'gest.drag':        '<b>Drag.</b> Sol gözü kapalı tutun — sol tuş basılı kalır, başınızla sürükleyin. Açtığınızda bırakılır.',
      'gest.scroll':      '<b>Scroll.</b> Sağ gözü kapatın — başınızı yukarı/aşağı eğmek sayfayı kaydırır.',
      'tag.drag':   'drag',
      'tag.scroll': 'scroll',

      'voice.title':       'Sesli giriş',
      'voice.lede':        'Sesli yazma ve komutlar. Local Whisper çevrimdışı çalışır.',
      'voice.start':       'Sesli girişi başlat',
      'voice.stop':        'Sesi durdur',
      'voice.lang':        'Dil',
      'voice.engine':      'Motor',
      'voice.engine_local':'Local Whisper (çevrimdışı)',
      'voice.engine_web':  'Web Speech (çevrimiçi)',
      'voice.engine_oai':  'OpenAI Whisper (.env)',
      'voice.continuous_t':'Sürekli mod',
      'voice.continuous_d':'Konuşmayı sessizliğe göre otomatik böler ve cümleleri yazar.',
      'voice.transcript_ph':'Tanınan metin burada görünür. Komutlar: “tıkla”, “dur”, “devam”, “youtube aç / telegram”, “kedi ara”.',

      'voice.gate_hint_a':       'Söyle',
      'voice.gate_hint_b':       'sesli yazma kapanır',
      'voice.gate_hint_c':       'tekrar açılır',
      'voice.gate_state_listen': '🎙 dinliyorum',
      'voice.gate_state_muted':  '🔇 sessize aldım',

      'hf.title':            'Eller serbest davranışı',
      'hf.lede':              'Kamera arıza yapsa bile elleri kullanmadan çalışmak için.',
      'hf.autostart_t':      'Açılışta otomatik başlat',
      'hf.autostart_d':      'İmleç kontrolünü ve sürekli sesi anında açar. Kayıtlı kalibrasyon gerekir.',
      'hf.autopause_t':      'Yüz olmazsa otomatik duraklat',
      'hf.autopause_d':      'Karede 2 saniye yüz görünmezse kontrol duraklar.',
      'hf.corners_t':        'Ekran köşeleri',
      'hf.corners_d':        'TL — duraklat/devam · TR — pencereyi göster · BR — acil durdurma.',
      'hf.cmds_t':           'Sesli komutlar',
      'hf.cmds_d':           'Kontrol: “dur”, “tıkla”, “yukarı” · Başlat: “youtube aç / telegram / vs code”, “X ara” · Editör: “kaydet”, “geri al”, “bul”, “komut”, “terminal”, “sonraki sekme”, “geri” · Hassas: “hassas”.',

      'perm.title':   'macOS izinleri',
      'perm.lede':    'Bir kez ayarlayın, unutun.',
      'perm.req':     'gerekli',
      'perm.open':    'Paneli aç',
      'perm.acc_d':   'İmleç ve klavye diğer uygulamalarda çalışsın diye.',
      'perm.cam_d':   'Yüzü cihazda yerel olarak izlemek için.',
      'perm.mic_d':   'Sesli giriş ve komutlar için.',
      'perm.note_a':  'İzinleri verdikten sonra',
      'perm.note_b':  'uygulamayı yeniden başlatın.',

      'd.calib_loaded':    'Kayıtlı kalibrasyon yüklendi.',
      'd.no_face':         'Yüz bulunamadı. Kameraya yaklaşın.',
      'd.calibrated':      'Kalibre edildi. Başınızı oynatın — imleç takip eder.',
      'd.calib_first':     'Önce merkezi kalibre edin.',
      'd.calib_in':        'Kalibrasyon',
      'd.calib_in_look':   ' saniye sonra… kameraya bakın',
      'd.autostart_calib': 'Otomatik başlatma açık. İmleç için nötr pozisyonda “Kalibre” düğmesine basın.',
      'd.paused':          '⏸ Duraklatıldı',
      'd.resumed':         '▶ Kontrol etkin',
      'd.face_back':       'Yüz tekrar karede',
      'd.estop':           '🛑 Acil duraklatma (sağ alt köşe)',
      'd.autostart_all':   '▶ Otomatik başlatma: hepsi etkin',
      'd.cmd':             'komut',
      'd.launch':          'başlat',
      'd.precision':       '🎯 Hassas mod',
      'd.calibration':     '🎯 KALİBRASYON',

      'd.mode_drag':   '🖱 SÜRÜKLE',
      'd.mode_scroll': '↕ KAYDIR',
      'd.mode_pause':  '⏸ DURAKLATILDI',
      'd.mode_noface': '👤❌ yüz yok',

      'd.voice_local_missing': 'Local Whisper (model/CLI yok — npm run setup)',
      'd.voice_local_ready':   'Local Whisper (çevrimdışı, {model})',

      'd.mp_loading':         'MediaPipe wasm yükleniyor…',
      'd.mp_gpu_fail':        'GPU kullanılamıyor, CPU’ya geçiliyor…',
      'd.mp_loaded':          'Model yüklendi ({delegate}). Kamera açılıyor…',
      'd.cam_no_avail':       'kullanılabilir kamera yok',
      'd.cam_open_fail':      'Kamera açılamadı → {reason}',
      'd.cam_disconnect':     'Kamera bağlantısı kesildi. Yeniden bağlanılıyor…',
      'd.cam_reconnect_fail': 'Kamera yeniden bağlanamadı: {msg}',
      'd.cam_ready':          'Hazır (kamera {w}×{h}). Merkezi kalibre edin (🎯).',
      'd.init_err':           'Başlatma hatası: {msg}',

      'd.diag_no_frames': '❌ Kamera kare üretmiyor (videoWidth={w}, readyState={r}). Kamera başka uygulamada mı açık? System Settings → Camera’yı kontrol edin.',
      'd.diag_no_face':   '⚠ Kareler geliyor ({n}/5sn) ama yüz tespit edilemedi. Aydınlatma/konum nasıl? detectErrors={e}{tail}',
      'd.diag_ok':        '✓ Çalışıyor: 5sn’de {f}/{n} karede yüz ({d}).',

      'd.chip_no_stream': 'akış yok',
      'd.chip_face':      'yüz {n}/sn',
      'd.chip_no_face':   'yüz yok',

      'd.s_ready':   'Hazır',
      'd.s_paused':  'Duraklatıldı',
      'd.s_noface':  'Yüz yok',
      'd.s_active':  'Etkin',

      'd.ctrl_active':     'Kontrol etkin',
      'd.ready_short':     'Hazır',
      'd.reason_no_video': 'video akışı yok (kamera başka uygulamada mı?)',
      'd.reason_mp_err':   'MediaPipe hatası: {msg}',
      'd.reason_face_out': 'yüz karenin dışında',
      'd.autopause':       'Otomatik duraklatma: {reason}',

      'd.voice_stop':        'Sesi durdur',
      'd.voice_start':       'Sesli girişi başlat',
      'd.webspeech_missing': '[Web Speech API bu Electron sürümünde yok. Local Whisper’a geçin]',
      'd.recog_err':         '[tanıma hatası: {err}]',
      'd.start_fail':        '[başlatılamadı: {err}]',
      'd.send_oai':          '[OpenAI Whisper’a gönderiliyor…]',
      'd.whisper_err':       '[Whisper hatası: {reason}]',
      'd.mic_unavailable':   '[mikrofon kullanılamıyor: {err}]',
      'd.local_no_cli':      '[Local Whisper: whisper-cli bulunamadı. Kurulum: brew install whisper-cpp]',
      'd.local_no_model':    '[Local Whisper: model bulunamadı ({path}). Çalıştırın: npm run setup]',
      'd.local_ready_cont':  '[Local Whisper hazır. Konuşun — her duraklamadan sonra yazacağım.]',
      'd.local_ready_once':  '[Local Whisper: kayıt… tanımak için ⏹ basın.]',
      'd.send_err':          '[gönderme hatası: {err}]',
      'd.cmd_log':           '[komut: {cmd}]',
      'd.launch_log':        '[başlat: {label}]',
      'd.search_label':      '“{q}” ara',
      'd.muted':             '🔇 Sesli yazma kapalı. Devam etmek için “dinle” de.',
      'd.listening':         '🎙 Sesli yazma yine açık.',
      'd.muted_log':         '[atlandı: “{text}”]',
    },
  };

  const SUPPORTED = ['ru', 'en', 'kk', 'tr'];
  let currentLang = 'ru';
  const listeners = new Set();

  function detectInitialLang() {
    try {
      const saved = localStorage.getItem('bmh_lang');
      if (saved && SUPPORTED.includes(saved)) return saved;
      const sys = (navigator.language || 'ru').slice(0, 2).toLowerCase();
      return SUPPORTED.includes(sys) ? sys : 'ru';
    } catch { return 'ru'; }
  }

  function t(key) {
    const tab = DICT[currentLang] || DICT.ru;
    return Object.prototype.hasOwnProperty.call(tab, key) ? tab[key] : (DICT.ru[key] || key);
  }

  // Format helper: tf('d.cam_open_fail', { reason: 'foo' }) → '… → foo'
  function tf(key, params) {
    let s = t(key);
    if (params) {
      for (const k of Object.keys(params)) {
        s = s.split('{' + k + '}').join(String(params[k]));
      }
    }
    return s;
  }

  function applyDom(root = document) {
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      const k = el.getAttribute('data-i18n');
      const v = t(k);
      if (v.includes('<')) el.innerHTML = v; else el.textContent = v;
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
    root.querySelectorAll('[data-i18n-title]').forEach((el) => {
      el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
    });
    document.documentElement.setAttribute('lang', currentLang);
  }

  function setLang(lang) {
    if (!SUPPORTED.includes(lang)) lang = 'ru';
    currentLang = lang;
    try { localStorage.setItem('bmh_lang', lang); } catch {}
    applyDom();
    listeners.forEach((cb) => { try { cb(lang); } catch {} });
  }

  function onChange(cb) { listeners.add(cb); return () => listeners.delete(cb); }
  function getLang() { return currentLang; }
  function supported() { return SUPPORTED.slice(); }

  // Auto-init on DOMContentLoaded
  currentLang = detectInitialLang();
  document.addEventListener('DOMContentLoaded', () => applyDom());

  window.i18n = { t, tf, setLang, getLang, onChange, supported, applyDom };
})();

