'use strict';
const { classify, loadPipeline, getStatus } = require('../intent-engine');

(async () => {
  console.log('Loading model…');
  await loadPipeline();
  console.log('Status:', getStatus());

  const phrases = [
    'останови всё пожалуйста',         // pause
    'погоди не пиши',                  // voiceMute
    'снова работай',                   // resume
    'дай я говорю',                    // voiceListen
    'я смотрю прямо в центр',          // recalibrate
    'кликни сюда',                     // click
    'покажи контекстное меню',         // rightClick
    'листай немного вниз',             // scrollDown
    'отправь это',                     // enter
    'сделай скрин экрана',             // screenshot
    'сохрани изменения',               // save
    'отмени последнее',                // undo
    'закоменть строку',                // comment
    'открой spotlight',                // spotlight
    'привет как дела',                 // none → должно быть below-threshold
  ];

  for (const p of phrases) {
    const r = await classify(p);
    if (r.ok) console.log(`✓ "${p}"  →  ${r.intent.intent} [${r.intent.kind}] score=${r.score.toFixed(3)} second=${r.second.toFixed(3)}`);
    else console.log(`× "${p}"  →  ${r.reason}${r.score ? ` (best=${r.score.toFixed(3)})` : ''}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });

