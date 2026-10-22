import {
  addLocalDays,
  formatCourseDateTime,
  isValidTimeZone,
  quarterDeadline,
  zonedTimeToUtc,
} from './courseTime';

const NY = 'America/New_York';

describe('course time', () => {
  it('knows real IANA zones and refuses others', () => {
    expect(isValidTimeZone(NY)).toBe(true);
    expect(isValidTimeZone('Asia/Kolkata')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('Eastern')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
    expect(isValidTimeZone(undefined)).toBe(false);
  });

  it('turns a local time into the right instant, summer and winter', () => {
    expect(zonedTimeToUtc(2026, 10, 21, 23, 59, NY).toISOString()).toBe(
      '2026-10-22T03:59:00.000Z',
    );
    expect(zonedTimeToUtc(2026, 12, 1, 23, 59, NY).toISOString()).toBe(
      '2026-12-02T04:59:00.000Z',
    );
  });

  it('closes a quarter at 11:59 PM local, N calendar days after it opens', () => {
    // Opens 9:15 AM EDT on 7 Oct 2026; 14 days later is 21 Oct.
    const start = new Date('2026-10-07T13:15:00Z');
    const end = quarterDeadline(start, 14, NY);
    expect(formatCourseDateTime(end, NY)).toBe('21 Oct 2026, 11:59 PM EDT');
  });

  it('keeps 11:59 PM local across the daylight-saving change', () => {
    // Opens 26 Oct (EDT); closes 9 Nov (EST, after 1 Nov fall-back).
    const start = new Date('2026-10-26T14:00:00Z');
    const end = quarterDeadline(start, 14, NY);
    expect(formatCourseDateTime(end, NY)).toBe('9 Nov 2026, 11:59 PM EST');
    expect(end.toISOString()).toBe('2026-11-10T04:59:00.000Z');
  });

  it('extends by calendar days, not by 24-hour blocks', () => {
    const end = new Date('2026-10-29T03:59:00Z'); // 28 Oct 11:59 PM EDT
    const later = addLocalDays(end, 7, NY);
    expect(formatCourseDateTime(later, NY)).toBe('4 Nov 2026, 11:59 PM EST');
  });

  it('uses the date on the course calendar, not the server calendar', () => {
    // 2:30 AM UTC on 22 Oct is still 21 Oct in New York.
    const start = new Date('2026-10-22T02:30:00Z');
    const end = quarterDeadline(start, 1, NY);
    expect(formatCourseDateTime(end, NY)).toBe('22 Oct 2026, 11:59 PM EDT');
  });

  it('shows an offset where the zone has no abbreviation', () => {
    const t = new Date('2026-10-21T18:29:00Z');
    expect(formatCourseDateTime(t, 'Asia/Kolkata')).toBe(
      '21 Oct 2026, 11:59 PM GMT+5:30',
    );
  });

  it('lands on the first valid minute in the spring-forward gap', () => {
    // 2:30 AM on 8 Mar 2026 doesn't exist in New York.
    const t = zonedTimeToUtc(2026, 3, 8, 2, 30, NY);
    expect(formatCourseDateTime(t, NY)).toBe('8 Mar 2026, 3:30 AM EDT');
  });

  it('takes the first reading in the fall-back overlap', () => {
    // 1:30 AM on 1 Nov 2026 happens twice in New York; use the EDT one.
    const t = zonedTimeToUtc(2026, 11, 1, 1, 30, NY);
    expect(formatCourseDateTime(t, NY)).toBe('1 Nov 2026, 1:30 AM EDT');
  });
});
