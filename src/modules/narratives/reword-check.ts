// The reword check: Claude only rewords the engine's text. Any failure drops
// the rewording and the engine text stands. Ported from Flexee BPM's
// conversation checks, in the same order.

import { figures, normaliseFigure } from '../ai/figure-check';

export const MAX_REWORD_CHARS = 700;

const NUMBER_WORDS =
  /\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|half|dozen|twice)\b/gi;
const numberWords = (s: string) =>
  new Set((s.match(NUMBER_WORDS) ?? []).map((w) => w.toLowerCase()));

/**
 * Grading and advice words, then the house list of words we don't write.
 * The house list here is a starting point until the full list is approved.
 */
export const BANNED_WORDS = [
  'should',
  'must',
  'best',
  'worst',
  'better than',
  'grade',
  'graded',
  'failed',
  'winner',
  'leverage',
  'delve',
  'moat',
  'robust',
  'seamless',
  'synergy',
  'game-changer',
  'landscape',
  'tapestry',
  'pivotal',
];
const BANNED = new RegExp(
  `\\b(?:${BANNED_WORDS.map((w) => w.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')})\\b`,
  'i',
);

export type RewordFailure =
  | 'length'
  | 'figure'
  | 'number_word'
  | 'name'
  | 'banned_word';
export type RewordResult = { ok: true } | { ok: false; reason: RewordFailure };

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * @param names Every firm name and region name in the course. A name in the
 *   rewording must also be in the engine text.
 */
export function rewordCheck(
  engine: string,
  reworded: string,
  names: string[] = [],
): RewordResult {
  if (reworded.length > MAX_REWORD_CHARS)
    return { ok: false, reason: 'length' };
  if (reworded.length > Math.max(engine.length * 1.5, engine.length + 60)) {
    return { ok: false, reason: 'length' };
  }
  const allowed = figures([engine]);
  for (const f of figures([reworded])) {
    if (!allowed.has(f)) return { ok: false, reason: 'figure' };
  }
  // Digits inside names count too: "Q9" is as much an invention as "9" when
  // the engine text says "Q8", "Region 2" or "P1".
  const digitRuns = (text: string) =>
    new Set(
      [...text.matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) =>
        normaliseFigure(m[0]),
      ),
    );
  const engineDigits = digitRuns(engine);
  for (const d of digitRuns(reworded)) {
    if (!engineDigits.has(d)) return { ok: false, reason: 'figure' };
  }
  const allowedWords = numberWords(engine);
  if ([...numberWords(reworded)].some((w) => !allowedWords.has(w))) {
    return { ok: false, reason: 'number_word' };
  }
  for (const name of names) {
    const re = new RegExp(`(?<![\\w])${escape(name)}(?![\\w])`, 'i');
    if (re.test(reworded) && !re.test(engine))
      return { ok: false, reason: 'name' };
  }
  if (BANNED.test(reworded)) return { ok: false, reason: 'banned_word' };
  return { ok: true };
}

export { normaliseFigure };
