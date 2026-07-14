export const POSITION_OPTIONS = [
  { value: "PITCHER", label: "投手" },
  { value: "CATCHER", label: "捕手" },
  { value: "INFIELDER", label: "内野手" },
  { value: "OUTFIELDER", label: "外野手" },
  { value: "MANAGER", label: "マネージャー" },
  { value: "ANALYST", label: "アナリスト" },
] as const;

export type PositionValue = (typeof POSITION_OPTIONS)[number]["value"];

const LABEL_BY_VALUE = new Map(POSITION_OPTIONS.map((o) => [o.value, o.label]));

export function positionLabel(value: string): string {
  return LABEL_BY_VALUE.get(value as PositionValue) ?? value;
}
