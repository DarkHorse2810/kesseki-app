"use client";

import { useEffect, useState } from "react";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

type WeekdayRow = { weekday: number; time: string | null };
type OverrideRow = { date: string; time: string | null };

export default function NotificationScheduleManager({ password }: { password: string }) {
  const [weekdayRows, setWeekdayRows] = useState<WeekdayRow[]>([]);
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [overrideDate, setOverrideDate] = useState("");
  const [overrideTime, setOverrideTime] = useState("07:00");
  const [overrideSkip, setOverrideSkip] = useState(false);
  const [isAddingOverride, setIsAddingOverride] = useState(false);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch("/api/notification-schedule/weekday").then((res) => res.json()),
      fetch("/api/notification-schedule/overrides").then((res) => res.json()),
    ])
      .then(([weekdayData, overrideData]) => {
        if (cancelled) return;
        setWeekdayRows(
          (weekdayData.schedule as WeekdayRow[]).sort((a, b) => a.weekday - b.weekday),
        );
        setOverrides(overrideData.overrides as OverrideRow[]);
      })
      .catch(() => {
        if (!cancelled) setLoadError("通知設定の取得に失敗しました");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const updateWeekdayTime = (weekday: number, time: string | null) => {
    setWeekdayRows((prev) => prev.map((r) => (r.weekday === weekday ? { ...r, time } : r)));
  };

  const handleSaveWeekday = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch("/api/notification-schedule/weekday", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, schedule: weekdayRows }),
      });
      if (!res.ok) {
        window.alert("保存に失敗しました。もう一度お試しください。");
        return;
      }
      setSaveMessage("保存しました");
      setTimeout(() => setSaveMessage(null), 3000);
    } catch {
      window.alert("保存に失敗しました。もう一度お試しください。");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddOverride = async () => {
    if (!overrideDate) return;
    setIsAddingOverride(true);
    try {
      const res = await fetch("/api/notification-schedule/overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          date: overrideDate,
          time: overrideSkip ? null : overrideTime,
        }),
      });
      if (!res.ok) {
        window.alert("追加に失敗しました。もう一度お試しください。");
        return;
      }
      const data = (await res.json()) as { override: OverrideRow };
      setOverrides((prev) =>
        [...prev.filter((o) => o.date.slice(0, 10) !== data.override.date.slice(0, 10)), data.override].sort(
          (a, b) => a.date.localeCompare(b.date),
        ),
      );
      setOverrideDate("");
    } catch {
      window.alert("追加に失敗しました。もう一度お試しください。");
    } finally {
      setIsAddingOverride(false);
    }
  };

  const handleDeleteOverride = async (dateKey: string) => {
    try {
      const res = await fetch(`/api/notification-schedule/overrides/${dateKey.slice(0, 10)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        window.alert("削除に失敗しました。もう一度お試しください。");
        return;
      }
      setOverrides((prev) => prev.filter((o) => o.date !== dateKey));
    } catch {
      window.alert("削除に失敗しました。もう一度お試しください。");
    }
  };

  if (isLoading) return null;
  if (loadError) return <p className="text-sm text-red-600">{loadError}</p>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="mb-2 text-sm font-semibold">曜日ごとの送信時刻</h3>
        <ul className="flex flex-col gap-2">
          {weekdayRows.map((row) => (
            <li key={row.weekday} className="flex items-center gap-3 text-sm">
              <span className="w-4">{WEEKDAY_LABELS[row.weekday]}</span>
              <input
                type="time"
                className="rounded-lg border border-gray-300 bg-background px-2 py-1.5 text-sm text-foreground disabled:opacity-40"
                value={row.time ?? "07:00"}
                disabled={row.time === null}
                onChange={(e) => updateWeekdayTime(row.weekday, e.target.value)}
              />
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-600">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={row.time === null}
                  onChange={(e) => updateWeekdayTime(row.weekday, e.target.checked ? null : "07:00")}
                />
                送信しない
              </label>
            </li>
          ))}
        </ul>

        {saveMessage && (
          <p className="mt-2 text-xs text-green-700" role="status">
            {saveMessage}
          </p>
        )}

        <button
          type="button"
          className="mt-3 w-full cursor-pointer rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-400"
          onClick={handleSaveWeekday}
          disabled={isSaving}
        >
          {isSaving ? "保存中..." : "保存する"}
        </button>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">日付ごとの例外設定</h3>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            type="date"
            className="rounded-lg border border-gray-300 bg-background px-2 py-1.5 text-sm text-foreground"
            value={overrideDate}
            onChange={(e) => setOverrideDate(e.target.value)}
          />
          <input
            type="time"
            className="rounded-lg border border-gray-300 bg-background px-2 py-1.5 text-sm text-foreground disabled:opacity-40"
            value={overrideTime}
            disabled={overrideSkip}
            onChange={(e) => setOverrideTime(e.target.value)}
          />
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-600">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={overrideSkip}
              onChange={(e) => setOverrideSkip(e.target.checked)}
            />
            送信しない
          </label>
          <button
            type="button"
            className="cursor-pointer rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-400"
            onClick={handleAddOverride}
            disabled={!overrideDate || isAddingOverride}
          >
            追加
          </button>
        </div>

        {overrides.length === 0 ? (
          <p className="text-xs text-gray-500">例外設定はありません。</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {overrides.map((o) => (
              <li
                key={o.date}
                className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                <span>
                  {o.date.slice(0, 10).replaceAll("-", "/")}
                  ・{o.time ? `${o.time} に送信` : "送信しない"}
                </span>
                <button
                  type="button"
                  className="cursor-pointer rounded-lg border border-red-300 px-2.5 py-1 text-xs font-semibold text-red-600"
                  onClick={() => handleDeleteOverride(o.date)}
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
