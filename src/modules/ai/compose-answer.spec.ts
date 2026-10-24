import { compose, withoutSteps } from './compose-answer';

describe('compose', () => {
  it('gives the last turn alone when the earlier ones only open it', () => {
    const last =
      'Only Quarter 4 has closed, so the comparison is thin. Firm 1 is at 59 on the Financial score, Firm 2 is at 59 and Firm 3 is at 59, and every other measure is level across the course so far, so there is nothing to separate them yet.';
    expect(last.length).toBeGreaterThanOrEqual(200);
    const answer = compose([
      'The course is on Quarter 5, so I’ll read the latest closed quarter.',
      'Only Quarter 4 has closed, so there is little to compare yet. I’ll show the table so you can see the figures.',
      last,
    ]);
    expect(answer).toBe(last);
  });

  it('removes "I\'ll look at the latest quarter" and never leaves the answer empty', () => {
    expect(withoutSteps("I'll look at the latest quarter.")).toBe('');
    expect(compose(["I'll show the table."])).toBe("I'll show the table.");
  });

  it('keeps a sentence with a figure, and treats Quarter, Q, Firm, Region and P numbers as names', () => {
    expect(withoutSteps('Firm 1 is at 59. I’ll check Firm 2 too.')).toBe(
      'Firm 1 is at 59.',
    );
    expect(withoutSteps("I'll show the table: Firm 1 is at 59.")).toBe(
      "I'll show the table: Firm 1 is at 59.",
    );
    expect(withoutSteps("I'll check Q6, Firm 2, Region 2 and P1.")).toBe('');
  });

  it('drops a short opener before a full answer', () => {
    const full =
      'Firm 2 submitted on time and Firm 3 did not, so Firm 3 was played on last quarter’s decisions. '.repeat(
        3,
      );
    expect(compose(['Let me check the close history.', full])).toBe(
      full.trim(),
    );
  });
});
