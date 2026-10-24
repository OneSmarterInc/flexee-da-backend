import { figureCheck, normaliseFigure } from './figure-check';

describe('the figure check', () => {
  it('keeps sentences whose figures a lookup gave, as numbers, and drops the rest', () => {
    const r = figureCheck(
      'Quarter 4 is open. The budget is $2,800,000 for each firm. About 37 firms are late.',
      ['{"quarter":4}', 'Each firm starts with 2800000.'],
    );
    expect(r.answer).toBe(
      'Quarter 4 is open. The budget is $2,800,000 for each firm.',
    );
    expect(r.dropped).toEqual([
      { sentence: 'About 37 firms are late.', figures: ['37'] },
    ]);
    expect(r.checked).toBe(3);
  });

  it('matches "$2,800,000", "2800000" and "2,800,000" as one figure', () => {
    expect(normaliseFigure('$2,800,000')).toBe(normaliseFigure('2800000'));
    expect(normaliseFigure('2,800,000')).toBe(normaliseFigure('2800000'));
    expect(normaliseFigure('5%')).toBe(normaliseFigure('5'));
  });

  it('treats Quarter 6, Q6, Firm 2, Region 2 and P1 as names in the sources, not figures to drop', () => {
    const r = figureCheck('Q6 and P1 are fine for Firm 2 in Region 2.', []);
    // "6", "1" and "2" are inside names: Q6 and P1 are not figures; Firm 2 and Region 2 are.
    expect(r.dropped.map((d) => d.figures).flat()).toEqual(['2', '2']);
  });

  it('drops a sentence with an unknown figure and keeps the rest', () => {
    const r = figureCheck(
      'Firm 3 filled 96.5% of orders. Firm 1 has submitted.',
      ['96.5%', 'Firm 3', 'Firm 1'],
    );
    expect(r.answer).toBe(
      'Firm 3 filled 96.5% of orders. Firm 1 has submitted.',
    );
    const r2 = figureCheck(
      'Firm 3 filled 91% of orders. Nothing else changed.',
      ['3'],
    );
    expect(r2.answer).toBe('Nothing else changed.');
    expect(r2.dropped).toHaveLength(1);
  });

  it('leaves nothing when every sentence is dropped', () => {
    const r = figureCheck(
      'Revenue was $9,999,999. Net income was $8,888,888.',
      [],
    );
    expect(r.answer).toBe('');
    expect(r.dropped).toHaveLength(2);
  });

  it('lets a figure through inside quotation marks only when it is quotable', () => {
    const r = figureCheck(
      'The note said "save 40% by June". They save 40%.',
      [],
      ['save 40% by June'],
    );
    expect(r.answer).toBe('The note said "save 40% by June".');
  });
});

describe('signs', () => {
  it('treats "-$50,000" and "$50,000" as different figures', () => {
    expect(normaliseFigure('-$50,000')).toBe('-50000');
    expect(normaliseFigure('$50,000')).toBe('50000');
    const r = figureCheck('Net income was $50,000.', [
      'Net income was -$50,000.',
    ]);
    expect(r.answer).toBe('');
    expect(figureCheck('Net income was -$50,000.', ['-50000']).answer).toBe(
      'Net income was -$50,000.',
    );
  });

  it('a range or a date does not read as a negative figure', () => {
    const r = figureCheck('Quarters 4-7 closed on 2026-10-30.', [
      '4',
      '7',
      '2026',
      '10',
      '30',
    ]);
    expect(r.dropped).toEqual([]);
  });
});
