"use client";

import { useEffect, useMemo, useState } from "react";

type ScheduleItemEntry = {
  id: number;
  date: string;
  text: string;
};

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export default function ScheduleItemsManager() {
  const now = useMemo(() => new Date(), []);
  const months = useMemo(() => {
    const first = { year: now.getFullYear(), month: now.getMonth() + 1 };
    const nextMonth = now.getMonth() + 1 === 12 ? 1 : now.getMonth() + 2;
    const nextYear = now.getMonth() + 1 === 12 ? now.getFullYear() + 1 : now.getFullYear();
    return [first, { year: nextYear, month: nextMonth }];
  }, [now]);

  const [itemsByDate, setItemsByDate] = useState<Map<string, ScheduleItemEntry[]>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [addingDate, setAddingDate] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all(
      months.map(({ year, month }) =>
        fetch(`/api/schedule-items?year=${year}&month=${month}`).then((res) => {
          if (!res.ok) throw new Error("failed to load schedule items");
          return res.json() as Promise<{ items: ScheduleItemEntry[] }>;
        }),
      ),
    )
      .then((results) => {
        if (cancelled) return;
        const map = new Map<string, ScheduleItemEntry[]>();
        for (const { items } of results) {
          for (const item of items) {
            const key = item.date.slice(0, 10);
            const list = map.get(key) ?? [];
            list.push(item);
            map.set(key, list);
          }
        }
        setItemsByDate(map);
      })
      .catch(() => {
        if (!cancelled) setLoadError("予定の取得に失敗しました");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [months]);

  const handleAdd = async (dateKey: string) => {
    const text = (drafts[dateKey] ?? "").trim();
    if (!text) return;

    setAddingDate(dateKey);
    try {
      const res = await fetch("/api/schedule-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dateKey, text }),
      });

      if (!res.ok) {
        window.alert("予定の追加に失敗しました。もう一度お試しください。");
        return;
      }

      const data = (await res.json()) as { item: ScheduleItemEntry };
      setItemsByDate((prev) => {
        const next = new Map(prev);
        next.set(dateKey, [...(next.get(dateKey) ?? []), data.item]);
        return next;
      });
      setDrafts((prev) => ({ ...prev, [dateKey]: "" }));
    } catch {
      window.alert("予定の追加に失敗しました。もう一度お試しください。");
    } finally {
      setAddingDate(null);
    }
  };

  if (isLoading) return <p className="text-sm text-gray-500">読み込み中...</p>;
  if (loadError) return <p className="text-sm text-red-600">{loadError}</p>;

  return (
    <div className="flex flex-col gap-4">
      {months.map(({ year, month }) => (
        <div key={`${year}-${month}`}>
          <h3 className="mb-2 text-sm font-semibold">
            {year}年{month}月
          </h3>
          <ul className="flex flex-col gap-1.5">
            {Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1).map((day) => {
              const dateKey = toDateKey(year, month, day);
              const weekday = new Date(year, month - 1, day).getDay();
              const existing = itemsByDate.get(dateKey) ?? [];

              return (
                <li
                  key={dateKey}
                  className="flex items-center gap-2 border-b border-gray-100 py-1.5 text-sm"
                >
                  <span
                    className={`w-14 shrink-0 ${
                      weekday === 0 ? "text-red-600" : weekday === 6 ? "text-blue-600" : "text-gray-600"
                    }`}
                  >
                    {month}/{day}({WEEKDAY_LABELS[weekday]})
                  </span>
                  <span className="flex-1 truncate text-xs text-gray-500">
                    {existing.map((item) => item.text).join("、")}
                  </span>
                  <input
                    type="text"
                    className="w-28 rounded-lg border border-gray-300 bg-background px-2 py-1 text-xs text-foreground focus:outline-2 focus:outline-offset-1 focus:outline-blue-600"
                    value={drafts[dateKey] ?? ""}
                    onChange={(e) =>
                      setDrafts((prev) => ({ ...prev, [dateKey]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAdd(dateKey);
                      }
                    }}
                    placeholder="予定を入力"
                  />
                  <button
                    type="button"
                    className="shrink-0 cursor-pointer rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-400"
                    onClick={() => handleAdd(dateKey)}
                    disabled={addingDate === dateKey || !(drafts[dateKey] ?? "").trim()}
                  >
                    追加
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
