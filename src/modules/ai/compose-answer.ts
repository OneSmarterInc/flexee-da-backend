// An answer that starts once. Claude narrates its steps in the turns before the one that answers
// ("I'll read the latest closed quarter…") and sometimes says its first point twice; only the answer should reach the faculty.
const VERBS =
  '(?:show|look|check|pull|try|use|start|get|find|compare|fetch|run|call|open|see|gather|draw|put|bring|read|include|list)';
const STARTS = new RegExp(
  `^\\s*(?:(?:First|Now|Next|Then),?\\s+)?(?:I'll|I will|I'm going to|Let me|I need to|I'd better)\\s+(?:also\\s+|now\\s+|first\\s+)?${VERBS}\\b`,
  'i',
);
const REPORTS = new RegExp(
  `,?\\s+so\\s+(?:I'll|I will|let me)\\s+${VERBS}\\b|\\b(?:came back empty|returned nothing)\\b`,
  'i',
);
/** "Quarter 6", "Q6", "Firm 2", "Region 2", "R2", "P1", "P2" and "P3" are names, not figures. */
const quotesFigure = (s: string) =>
  /\d/.test(s.replace(/\b(?:Quarter|Q|Firm|Region|R|P)\s?\d{1,2}\b/g, ''));
const SPLIT = /(?:(?<=[.!?])|(?<=[.!?]["”]))\s+(?=[A-Z0-9"“(])/u;

/** The text less its sentences about what Claude is doing. A sentence with a figure or a quotation always stays. */
export function withoutSteps(text: string) {
  const paragraphs: string[] = [];
  for (const paragraph of text.trim().split(/\n{2,}/)) {
    const lines: string[] = [];
    for (const line of paragraph.split('\n')) {
      const kept = line.split(SPLIT).filter((sentence) => {
        const plain = sentence.replace(/[’‘]/g, "'");
        return (
          quotesFigure(sentence) ||
          /["“”]/.test(sentence) ||
          !(STARTS.test(plain) || REPORTS.test(plain))
        );
      });
      if (kept.length) lines.push(kept.join(' '));
    }
    if (lines.length) paragraphs.push(lines.join('\n'));
  }
  return paragraphs.join('\n\n').trim();
}

const PREAMBLE = 160,
  FULL_ANSWER = 200;
/** Every round's text as one answer. When the last round is a full answer and the earlier ones only open it, the last stands alone. Never empty. */
export function compose(rounds: string[]) {
  const raw = rounds.filter((p) => p.trim() !== '').join('\n\n');
  const parts = rounds.map(withoutSteps).filter((p) => p !== '');
  const last = parts.at(-1) ?? '',
    earlier = parts.slice(0, -1);
  const preamble =
    earlier.length > 0 &&
    earlier.every((p) => p.length <= PREAMBLE && !quotesFigure(p));
  const answer =
    preamble && last.length >= FULL_ANSWER ? last : parts.join('\n\n');
  return answer !== '' ? answer : raw;
}
