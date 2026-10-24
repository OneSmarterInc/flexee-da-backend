import { rewordCheck } from './reword-check';

const engine =
  'Demand in Region 2 rose from 12,400 to 14,100 units. 4 firms submitted.';
const names = ['Firm 1', 'Firm 2', 'Region 2', 'Region 3'];

describe('the reword check', () => {
  it('keeps a faithful rewording', () => {
    const r = rewordCheck(
      engine,
      'In Region 2, demand went up from 12,400 to 14,100 units, and 4 firms submitted.',
      names,
    );
    expect(r).toEqual({ ok: true });
  });

  it('drops one that is too long', () => {
    expect(rewordCheck(engine, `${engine} ${engine} ${engine}`, names)).toEqual(
      { ok: false, reason: 'length' },
    );
    expect(rewordCheck('Short text.', 'x'.repeat(701), names)).toEqual({
      ok: false,
      reason: 'length',
    });
  });

  it('drops one with a new digit', () => {
    expect(
      rewordCheck(
        engine,
        'Demand in Region 2 rose from 12,400 to 14,100 units and 5 firms submitted.',
        names,
      ),
    ).toEqual({ ok: false, reason: 'figure' });
  });

  it('drops "$2.8 million" against "$2,800,000"', () => {
    expect(
      rewordCheck(
        'Your cash was $2,800,000.',
        'Your cash was $2.8 million.',
        names,
      ),
    ).toEqual({ ok: false, reason: 'figure' });
    expect(
      rewordCheck(
        'Your cash was $2,800,000.',
        'Your cash was 2800000 dollars.',
        names,
      ),
    ).toEqual({ ok: true });
  });

  it('drops a new number word, and allows one the engine text has', () => {
    expect(
      rewordCheck(
        engine,
        'Demand in Region 2 rose from 12,400 to 14,100 units; half the firms submitted, 4 of them.',
        names,
      ),
    ).toEqual({ ok: false, reason: 'number_word' });
    expect(
      rewordCheck(
        'Half the firms submitted: 4 firms.',
        'Half the firms, 4 firms, submitted.',
        names,
      ),
    ).toEqual({ ok: true });
  });

  it("drops another firm's name or an unmentioned region", () => {
    expect(
      rewordCheck(
        'Your fill rate fell from 96.0% to 88.5%.',
        'Your fill rate fell from 96.0% to 88.5%, below Firm 2.',
        names,
      ),
    ).toEqual({ ok: false, reason: 'figure' });
    expect(
      rewordCheck(
        'Your fill rate fell.',
        'Your fill rate fell, unlike Meridian.',
        ['Meridian'],
      ),
    ).toEqual({ ok: false, reason: 'name' });
    expect(
      rewordCheck(
        engine,
        'Demand rose in Region 3 and 4 firms submitted, with 12,400 and 14,100.',
        names,
      ),
    ).toEqual({ ok: false, reason: 'figure' });
  });

  it.each([
    'should',
    'must',
    'best',
    'worst',
    'better than',
    'grade',
    'failed',
    'winner',
    'leverage',
    'delve',
    'moat',
  ])('drops the banned word "%s"', (word) => {
    expect(
      rewordCheck(
        '4 firms submitted.',
        `4 firms submitted, ${word} noted.`,
        names,
      ),
    ).toEqual({ ok: false, reason: 'banned_word' });
  });
});
