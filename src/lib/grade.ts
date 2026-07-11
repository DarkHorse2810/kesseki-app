const FISCAL_YEAR_START_MONTH = 3; // April, 0-indexed

function getFiscalYear(date: Date): number {
  const year = date.getFullYear();
  const month = date.getMonth();
  return month >= FISCAL_YEAR_START_MONTH ? year : year - 1;
}

export function calculateCurrentGrade(
  baseGrade: number,
  baseYear: number,
  asOf: Date = new Date(),
): number {
  const elapsedYears = getFiscalYear(asOf) - baseYear;
  return baseGrade + elapsedYears;
}
