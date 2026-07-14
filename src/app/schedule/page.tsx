"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { rememberLastPage } from "@/lib/deviceStorage";
import { isJapaneseHoliday } from "@/lib/japaneseHolidays";
import TodayAbsenceLink from "@/components/TodayAbsenceLink";

const POSITION_ORDER = [
  "PITCHER",
  "CATCHER",
  "INFIELDER",
  "OUTFIELDER",
  "MANAGER",
  "ANALYST",
] as const;

const POSITION_COLOR: Record<string, string> = {
  PITCHER: "bg-red-200",
  CATCHER: "bg-cyan-200",
  INFIELDER: "bg-yellow-200",
  OUTFIELDER: "bg-green-300",
  MANAGER: "bg-purple-200",
  ANALYST: "bg-orange-200",
};

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

type AbsenceEntry = {
  id: number;
  date: string;
  reason: string;
  player: {
    id: number;
    name: string;
    currentGrade: number;
    positions: string[];
  };
};

type ScheduleItemEntry = {
  id: number;
  date: string;
  text: string;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export default function SchedulePage() {
  const [viewYear, setViewYear] = useState<number>(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(() => new Date().getMonth() + 1);

  const [absences, setAbsences] = useState<AbsenceEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [scheduleItems, setScheduleItems] = useState<ScheduleItemEntry[]>([]);

  const [selectedAbsence, setSelectedAbsence] = useState<AbsenceEntry | null>(null);

  useEffect(() => {
    rememberLastPage("schedule");
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    fetch(`/api/absences?year=${viewYear}&month=${viewMonth}`)
      .then((res) => {
        if (!res.ok) throw new Error("failed to load absences");
        return res.json() as Promise<{ absences: AbsenceEntry[] }>;
      })
      .then((data) => {
        if (!cancelled) setAbsences(data.absences);
      })
      .catch(() => {
        if (!cancelled) setLoadError("欠席情報の取得に失敗しました");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [viewYear, viewMonth]);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/schedule-items?year=${viewYear}&month=${viewMonth}`)
      .then((res) => {
        if (!res.ok) throw new Error("failed to load schedule items");
        return res.json() as Promise<{ items: ScheduleItemEntry[] }>;
      })
      .then((data) => {
        if (!cancelled) setScheduleItems(data.items);
      })
      .catch(() => {
        if (!cancelled) setScheduleItems([]);
      });

    return () => {
      cancelled = true;
    };
  }, [viewYear, viewMonth]);

  const scheduleItemsByDate = useMemo(() => {
    const map = new Map<string, ScheduleItemEntry[]>();
    for (const item of scheduleItems) {
      const key = item.date.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return map;
  }, [scheduleItems]);

  const absencesByDate = useMemo(() => {
    const map = new Map<string, AbsenceEntry[]>();
    for (const absence of absences) {
      const key = absence.date.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(absence);
      map.set(key, list);
    }
    return map;
  }, [absences]);

  const calendarCells = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth - 1, 1);
    const startOffset = firstOfMonth.getDay();
    const gridStart = new Date(viewYear, viewMonth - 1, 1 - startOffset);

    return Array.from({ length: 42 }, (_, i) => {
      const cellDate = new Date(
        gridStart.getFullYear(),
        gridStart.getMonth(),
        gridStart.getDate() + i,
      );
      const isCurrentMonth = cellDate.getMonth() === viewMonth - 1;
      const dateKey = toDateKey(
        cellDate.getFullYear(),
        cellDate.getMonth() + 1,
        cellDate.getDate(),
      );

      return {
        dateKey,
        day: cellDate.getDate(),
        isCurrentMonth,
        absences: absencesByDate.get(dateKey) ?? [],
        scheduleItems: scheduleItemsByDate.get(dateKey) ?? [],
        dayColor: isJapaneseHoliday(cellDate)
          ? "text-red-600"
          : cellDate.getDay() === 0
            ? "text-red-600"
            : cellDate.getDay() === 6
              ? "text-blue-600"
              : "text-gray-500",
      };
    });
  }, [viewYear, viewMonth, absencesByDate, scheduleItemsByDate]);

  const goPrevMonth = () => {
    if (viewMonth === 1) {
      setViewYear((y) => y - 1);
      setViewMonth(12);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (viewMonth === 12) {
      setViewYear((y) => y + 1);
      setViewMonth(1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  return (
    <div className="min-h-dvh bg-[#fafafa] px-4 pt-10 pb-40 dark:bg-black">
      <div className="mx-auto w-full max-w-[960px] rounded-2xl bg-background p-6 text-foreground shadow-[0_1px_8px_rgba(0,0,0,0.08)]">
        <TodayAbsenceLink />

        <div className="mb-6 flex items-center justify-between">
          <button
            type="button"
            className="cursor-pointer rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100"
            onClick={goPrevMonth}
          >
            ← 前月
          </button>
          <h1 className="text-lg font-semibold">
            {viewYear}年{viewMonth}月
          </h1>
          <button
            type="button"
            className="cursor-pointer rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100"
            onClick={goNextMonth}
          >
            翌月 →
          </button>
        </div>

        {isLoading && <p className="mb-4 text-sm text-gray-500">読み込み中...</p>}
        {loadError && <p className="mb-4 text-sm text-red-600">{loadError}</p>}

        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-gray-200 bg-gray-200 text-xs">
          {WEEKDAY_LABELS.map((label, index) => (
            <div
              key={label}
              className={`bg-gray-50 py-2 text-center font-semibold ${
                index === 0 ? "text-red-600" : index === 6 ? "text-blue-600" : "text-gray-600"
              }`}
            >
              {label}
            </div>
          ))}

          {calendarCells.map((cell) => (
            <div
              key={cell.dateKey}
              className={`min-h-[96px] bg-background p-1 ${
                cell.isCurrentMonth ? "" : "opacity-40"
              }`}
            >
              <div className="mb-1 flex items-baseline justify-between gap-1">
                <span className="truncate text-[11px] text-foreground">
                  {cell.scheduleItems.map((item) => item.text).join("、")}
                </span>
                <span className={`shrink-0 text-[11px] ${cell.dayColor}`}>{cell.day}</span>
              </div>
              <div className="flex flex-col gap-1">
                {cell.absences.map((absence) => (
                  <PlayerBanner
                    key={absence.id}
                    absence={absence}
                    onClick={() => setSelectedAbsence(absence)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <Link
          href="/absence"
          className="mt-6 block w-full rounded-lg border border-gray-300 py-3 text-center text-base font-semibold text-foreground hover:bg-gray-50 dark:hover:bg-white/5"
        >
          欠席連絡へ
        </Link>
      </div>

      {selectedAbsence && (
        <ReasonModal absence={selectedAbsence} onClose={() => setSelectedAbsence(null)} />
      )}
    </div>
  );
}

function PlayerBanner({
  absence,
  onClick,
}: {
  absence: AbsenceEntry;
  onClick: () => void;
}) {
  const segments = POSITION_ORDER.filter((position) =>
    absence.player.positions.includes(position),
  );

  return (
    <button
      type="button"
      className="relative flex h-6 w-full cursor-pointer overflow-hidden rounded text-[11px] font-medium text-black"
      onClick={onClick}
    >
      {(segments.length > 0 ? segments : ["UNKNOWN"]).map((position, index) => (
        <span
          key={index}
          className={`h-full flex-1 ${POSITION_COLOR[position] ?? "bg-gray-300"}`}
        />
      ))}
      <span className="absolute inset-0 flex items-center justify-center truncate px-1">
        {absence.player.currentGrade}年 {absence.player.name}
      </span>
    </button>
  );
}

function ReasonModal({
  absence,
  onClose,
}: {
  absence: AbsenceEntry;
  onClose: () => void;
}) {
  const dateLabel = absence.date.slice(0, 10).replaceAll("-", "/");

  return (
    <div
      className="fixed inset-0 z-[1001] flex items-center justify-center bg-black/50"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-[360px] rounded-2xl bg-background p-6 text-foreground shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="absence-reason-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="absence-reason-title" className="text-lg font-semibold">
            欠席理由
          </h2>
          <button
            type="button"
            className="cursor-pointer border-none bg-transparent px-2 py-1 text-[22px] leading-none text-inherit"
            onClick={onClose}
            aria-label="閉じる"
          >
            ×
          </button>
        </div>
        <p className="mb-3 text-sm text-gray-600">
          {dateLabel}・{absence.player.currentGrade}年 {absence.player.name}
        </p>
        <p className="whitespace-pre-wrap text-base">{absence.reason}</p>
      </div>
    </div>
  );
}
