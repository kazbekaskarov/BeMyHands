'use strict';

/**
 * Семантические намерения для классификации голоса по смыслу.
 *
 * Каждое намерение → набор примеров на разных языках (RU/EN/KZ/TR + перифразы).
 * При классификации мы считаем эмбеддинг входной фразы и сравниваем с
 * усреднённым эмбеддингом каждого намерения (cosine similarity).
 *
 * Имя `intent` соответствует:
 *   - voice  → исполняется как VOICE_COMMANDS в renderer.js (executeVoiceCommand)
 *   - editor → выполняется горячая клавиша (см. EDITOR_COMMANDS)
 *
 * Тип `kind` помогает renderer понять, как диспатчить.
 */

const INTENTS = [
  // ============== VOICE / system ==============
  {
    intent: 'pause', kind: 'voice',
    examples: [
      'пауза', 'останови курсор', 'остановись', 'прекрати следить', 'замри', 'не двигайся',
      'pause', 'pause cursor', 'stop tracking', 'freeze', 'hold on',
      'кідір', 'тоқта', 'тоқтат',
      'duraklat', 'imleci durdur', 'beklet',
    ],
  },
  {
    intent: 'resume', kind: 'voice',
    examples: [
      'продолжи', 'продолжай', 'возобнови', 'старт', 'поехали', 'снова работай',
      'resume', 'continue', 'start tracking', 'go on', 'keep going',
      'жалғастыр', 'бастау', 'іске қос',
      'devam', 'devam et', 'başla',
    ],
  },
  {
    intent: 'voiceMute', kind: 'voice',
    examples: [
      'стоп', 'стой', 'молчи', 'хватит', 'тихо', 'не пиши больше', 'перестань печатать',
      'отключи голос', 'выключи микрофон', 'не слушай меня',
      'stop', 'mute', 'shut up', 'stop typing', 'stop listening', 'silence',
      'тоқта', 'үндеме', 'тыңдама', 'жазба', 'микрофонды өшір',
      'dur', 'sus', 'yazma', 'dinleme',
    ],
  },
  {
    intent: 'voiceListen', kind: 'voice',
    examples: [
      'слушай', 'слышишь меня', 'включи микрофон', 'продолжай печатать', 'я говорю',
      'listen', 'unmute', 'start listening', 'i am talking', 'mic on',
      'тыңда', 'тыңдашы', 'микрофонды қос',
      'dinle', 'beni dinle',
    ],
  },
  {
    intent: 'recalibrate', kind: 'voice',
    examples: [
      'калибровка', 'откалибруй', 'центрируй', 'центр', 'я смотрю в центр', 'сбрось положение',
      'recalibrate', 'recenter', 'calibrate', 'reset center', 'i am looking at center',
      'калибрле', 'ортаға', 'қайта калибрле',
      'kalibre et', 'merkez', 'merkeze al',
    ],
  },
  {
    intent: 'click', kind: 'voice',
    examples: [
      'клик', 'нажми', 'кликни', 'тыкни', 'выбери',
      'click', 'tap', 'press it', 'select',
      'бас', 'басу', 'шерт',
      'tıkla', 'tıklat',
    ],
  },
  {
    intent: 'rightClick', kind: 'voice',
    examples: [
      'правый клик', 'правая кнопка', 'контекстное меню', 'меню',
      'right click', 'context menu', 'secondary click',
      'оң басу', 'оң шерт', 'контекст мәзірі',
      'sağ tıkla', 'bağlam menüsü',
    ],
  },
  {
    intent: 'doubleClick', kind: 'voice',
    examples: [
      'двойной клик', 'двойной', 'два клика', 'дабл клик',
      'double click', 'double tap',
      'екі рет басу', 'қос шерт',
      'çift tıkla', 'çift dokun',
    ],
  },
  {
    intent: 'scrollUp', kind: 'voice',
    examples: [
      'вверх', 'прокрути вверх', 'листай вверх', 'выше',
      'scroll up', 'go up', 'page up',
      'жоғары', 'жоғары айналдыр',
      'yukarı', 'yukarı kaydır',
    ],
  },
  {
    intent: 'scrollDown', kind: 'voice',
    examples: [
      'вниз', 'прокрути вниз', 'листай вниз', 'ниже',
      'scroll down', 'go down', 'page down',
      'төмен', 'төмен айналдыр',
      'aşağı', 'aşağı kaydır',
    ],
  },
  {
    intent: 'enter', kind: 'voice',
    examples: [
      'ввод', 'энтер', 'отправь', 'подтверди', 'нажми ввод',
      'enter', 'return', 'submit', 'confirm',
      'енгізу', 'жібер', 'растау',
      'giriş', 'gönder', 'onayla',
    ],
  },
  {
    intent: 'delete', kind: 'voice',
    examples: [
      'удали', 'стереть', 'бэкспейс', 'сотри', 'удалить',
      'backspace', 'delete', 'erase',
      'жою', 'өшір', 'жоғарғыны өшір',
      'sil', 'geri sil',
    ],
  },
  {
    intent: 'space', kind: 'voice',
    examples: [
      'пробел', 'поставь пробел',
      'space', 'spacebar',
      'бос орын',
      'boşluk',
    ],
  },
  {
    intent: 'showWindow', kind: 'voice',
    examples: [
      'покажи окно', 'настройки', 'открой настройки', 'параметры', 'показать панель',
      'show window', 'show settings', 'open settings', 'preferences',
      'параметрлер', 'терезе', 'баптауларды аш',
      'ayarlar', 'pencere', 'tercihleri aç',
    ],
  },
  {
    intent: 'quit', kind: 'voice',
    examples: [
      'выход', 'выйти', 'закрой приложение', 'выруби', 'завершить',
      'quit', 'exit', 'close app',
      'шығу', 'қолданбаны жап',
      'çık', 'kapat', 'uygulamayı kapat',
    ],
  },

  // ============== EDITOR shortcuts ==============
  // Только самые востребованные — для остального достаточно регексов.
  {
    intent: 'save', kind: 'editor', key: 'S', mods: ['cmd'], label: '💾 Save (⌘S)',
    examples: [
      'сохрани', 'сохранить', 'сейв', 'сохрани файл',
      'save', 'save it', 'save file',
      'сақта', 'файлды сақта',
      'kaydet', 'dosyayı kaydet',
    ],
  },
  {
    intent: 'undo', kind: 'editor', key: 'Z', mods: ['cmd'], label: '↶ Undo (⌘Z)',
    examples: [
      'отмени', 'отмена', 'верни как было', 'отмени последнее',
      'undo', 'revert', 'undo that',
      'болдырмау', 'қайтар',
      'geri al',
    ],
  },
  {
    intent: 'redo', kind: 'editor', key: 'Z', mods: ['cmd', 'shift'], label: '↷ Redo (⇧⌘Z)',
    examples: [
      'верни', 'повтори', 'повтори действие', 'возврати',
      'redo', 'redo that',
      'қайтадан', 'қайталап жаса',
      'yinele', 'tekrar yap',
    ],
  },
  {
    intent: 'copy', kind: 'editor', key: 'C', mods: ['cmd'], label: '⎘ Copy (⌘C)',
    examples: [
      'скопируй', 'копировать', 'копируй', 'забери в буфер',
      'copy', 'copy that', 'copy to clipboard',
      'көшір',
      'kopyala',
    ],
  },
  {
    intent: 'paste', kind: 'editor', key: 'V', mods: ['cmd'], label: '⎗ Paste (⌘V)',
    examples: [
      'вставь', 'вставить', 'вставь из буфера',
      'paste', 'paste it',
      'қой', 'кірістір',
      'yapıştır',
    ],
  },
  {
    intent: 'cut', kind: 'editor', key: 'X', mods: ['cmd'], label: '✂ Cut (⌘X)',
    examples: [
      'вырежи', 'вырезать',
      'cut', 'cut it',
      'қию',
      'kes',
    ],
  },
  {
    intent: 'selectAll', kind: 'editor', key: 'A', mods: ['cmd'], label: '⌷ Select All (⌘A)',
    examples: [
      'выдели всё', 'выделить всё', 'выбрать всё',
      'select all', 'pick all',
      'барлығын таңда',
      'tümünü seç',
    ],
  },
  {
    intent: 'find', kind: 'editor', key: 'F', mods: ['cmd'], label: '🔍 Find (⌘F)',
    examples: [
      'найди', 'поиск', 'ищи', 'найди в тексте',
      'find', 'search', 'find in page',
      'тап', 'іздеу',
      'bul', 'ara',
    ],
  },
  {
    intent: 'commandPalette', kind: 'editor', key: 'P', mods: ['cmd', 'shift'], label: '⌘ Command Palette (⇧⌘P)',
    examples: [
      'команда', 'палитра', 'командная палитра', 'покажи команды',
      'command palette', 'show commands',
      'әмір', 'команда палитрасы',
      'komut paleti',
    ],
  },
  {
    intent: 'quickOpen', kind: 'editor', key: 'P', mods: ['cmd'], label: '📂 Quick Open (⌘P)',
    examples: [
      'открой файл', 'открой', 'найди файл',
      'open file', 'quick open', 'go to file',
      'файл аш', 'файлды аш',
      'dosya aç', 'dosyayı aç',
    ],
  },
  {
    intent: 'comment', kind: 'editor', key: 'Slash', mods: ['cmd'], label: '// Toggle comment (⌘/)',
    examples: [
      'закомментируй', 'комментарий', 'закоменть',
      'comment', 'toggle comment',
      'түсініктеме',
      'yorum',
    ],
  },
  {
    intent: 'closeTab', kind: 'editor', key: 'W', mods: ['cmd'], label: '✕ Close tab (⌘W)',
    examples: [
      'закрой вкладку', 'закрой окно',
      'close tab', 'close window',
      'қойынды жабу', 'терезені жап',
      'sekmeyi kapat', 'pencereyi kapat',
    ],
  },
  {
    intent: 'newTab', kind: 'editor', key: 'T', mods: ['cmd'], label: '➕ New tab (⌘T)',
    examples: [
      'новая вкладка', 'открой вкладку',
      'new tab',
      'жаңа қойынды',
      'yeni sekme',
    ],
  },
  {
    intent: 'reload', kind: 'editor', key: 'R', mods: ['cmd'], label: '↻ Reload (⌘R)',
    examples: [
      'обнови', 'перезагрузи страницу',
      'reload', 'refresh',
      'жаңарт',
      'yenile',
    ],
  },
  {
    intent: 'spotlight', kind: 'editor', key: 'Space', mods: ['cmd'], label: '🔎 Spotlight (⌘Space)',
    examples: [
      'спотлайт', 'прожектор', 'открой spotlight',
      'spotlight', 'open spotlight',
    ],
  },
  {
    intent: 'screenshot', kind: 'editor', key: '4', mods: ['cmd', 'shift'], label: '📸 Screenshot (⇧⌘4)',
    examples: [
      'скриншот', 'сделай скриншот', 'снимок экрана',
      'screenshot', 'take screenshot', 'capture screen',
      'экран суреті',
      'ekran görüntüsü', 'ekran görüntüsü al',
    ],
  },
  {
    intent: 'precision', kind: 'editor', action: 'precision', label: '🎯 Precision mode',
    examples: [
      'точно', 'точность', 'прицел', 'включи точность', 'дай прицел',
      'precision', 'precise mode', 'aim mode', 'targeting',
      'дәл', 'нысан',
      'hassas', 'nişan',
    ],
  },
];

module.exports = { INTENTS };

