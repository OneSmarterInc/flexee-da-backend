// A student sees their own firm's outcome and the tests behind it, never
// another firm's. Faculty and admin see every firm's.

/** Keeps `outcome` on the student's own firm and nulls it on the others. */
export function redactOtherOutcomes<T extends { outcome?: unknown }>(
  rows: T[],
  ownFirmId: string | null,
  firmIdOf: (row: T) => string | null | undefined,
): T[] {
  return rows.map((row) =>
    ownFirmId !== null && String(firmIdOf(row) ?? '') === ownFirmId
      ? row
      : { ...row, outcome: null },
  );
}
