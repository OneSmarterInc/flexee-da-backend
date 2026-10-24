/**
 * The figure check, run in code after every Ask Claude answer (the same rule as Financial Accounting's U8): each
 * figure in the answer must appear in what Claude was given (its lookups, the guide, the page and the question). A
 * sentence quoting a figure that appears in none of them is dropped, the rest is shown, and the panel says so.
 *
 * Figures are compared as numbers, so "$2,800,000", "2800000" and "2,800,000" match, as do "5%" and "5". A date's
 * day and year are figures too, which is why the lookups hand dates over already written out.
 *
 * Students' own words are a second kind of source: a figure found only there passes only inside quotation marks,
 * so Claude can quote what a team wrote but never state it as fact.
 */
const NUMBER = /(?<![\w.])\$?\d[\d,]*(?:\.\d+)?%?/gu;

export interface FigureCheckResult {
  answer: string;
  dropped: Array<{ sentence: string; figures: string[] }>;
  checked: number;
}

export function normaliseFigure(figure: string) {
  let n = figure.replace(/,$/, '').replace(/[$,%]/g, '');
  if (n.includes('.')) n = n.replace(/0+$/, '').replace(/\.$/, '');
  n = n.replace(/^0+/, '');
  return n === '' ? '0' : n;
}

export function figures(sources: string[]) {
  const out = new Set<string>();
  for (const source of sources)
    for (const m of source.matchAll(NUMBER)) out.add(normaliseFigure(m[0]));
  return out;
}

/** Character ranges inside quotation marks, straight or curly. */
function quotedSpans(sentence: string) {
  return [...sentence.matchAll(/"[^"]*"|“[^”]*”/gu)].map(
    (m) => [m.index!, m.index! + m[0].length] as const,
  );
}

export function figureCheck(
  answer: string,
  sources: string[],
  quotable: string[] = [],
): FigureCheckResult {
  const known = figures(sources),
    quoted = figures(quotable);
  const dropped: FigureCheckResult['dropped'] = [];
  let checked = 0;
  const paragraphs: string[] = [];
  for (const paragraph of answer.trim().split(/\n{2,}/)) {
    const kept: string[] = [];
    // A sentence can end inside a closing quotation mark: 'asked: "… last week." There were …' is two sentences.
    for (const sentence of paragraph.split(
      /(?<=[.!?]["”’']?)\s+(?=[A-Z0-9"“(])/u,
    )) {
      const spans = quotedSpans(sentence),
        unknown: string[] = [];
      for (const m of sentence.matchAll(NUMBER)) {
        checked++;
        const key = normaliseFigure(m[0]),
          inQuote = spans.some(([a, b]) => m.index! >= a && m.index! < b);
        if (!known.has(key) && !(inQuote && quoted.has(key)))
          unknown.push(m[0].replace(/,$/, ''));
      }
      if (unknown.length === 0) kept.push(sentence);
      else dropped.push({ sentence: sentence.trim(), figures: unknown });
    }
    if (kept.length) paragraphs.push(kept.join(' '));
  }
  return { answer: paragraphs.join('\n\n'), dropped, checked };
}
