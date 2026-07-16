"use client";

import { useEffect, useState } from "react";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

type WeekdayRow = { weekday: number; time: string | null };
type OverrideRow = { date: string; time: string | null };
type RecipientRow = { id: number; lineUserId: string; label: string | null };
type BulkRow = { date: string; weekday: number; time: string; skip: boolean };

// "Today" as a JST calendar date, independent of the browser's own timezone.
function jstTodayDateKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Every date from `startDateKey` through the end of the following month
// (i.e. "this month + next month").
function buildTwoMonthDateRange(startDateKey: string): string[] {
  const [year, month, day] = startDateKey.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day));
  const endExclusive = new Date(Date.UTC(year, month + 1, 1));

  const dates: string[] = [];
  for (let cur = start; cur < endExclusive; cur = new Date(cur.getTime() + 24 * 60 * 60 * 1000)) {
    dates.push(cur.toISOString().slice(0, 10));
  }
  return dates;
}

// Seeds each date with its existing override if one is already saved,
// otherwise falls back to that weekday's default send time.
function buildBulkRows(
  dates: string[],
  weekdayRows: WeekdayRow[],
  overrides: OverrideRow[],
): BulkRow[] {
  const weekdayTimeByWeekday = new Map(weekdayRows.map((r) => [r.weekday, r.time]));
  const overrideTimeByDate = new Map(overrides.map((o) => [o.date.slice(0, 10), o.time]));

  return dates.map((date) => {
    const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
    const hasOverride = overrideTimeByDate.has(date);
    const time = hasOverride ? overrideTimeByDate.get(date)! : weekdayTimeByWeekday.get(weekday) ?? null;

    return { date, weekday, time: time ?? "07:00", skip: time === null };
  });
}

export default function NotificationScheduleManager({ password }: { password: string }) {
  const [weekdayRows, setWeekdayRows] = useState<WeekdayRow[]>([]);
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [recipients, setRecipients] = useState<RecipientRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [overrideDate, setOverrideDate] = useState("");
  const [overrideTime, setOverrideTime] = useState("07:00");
  const [overrideSkip, setOverrideSkip] = useState(false);
  const [isAddingOverride, setIsAddingOverride] = useState(false);

  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [isSavingBulk, setIsSavingBulk] = useState(false);
  const [bulkSaveMessage, setBulkSaveMessage] = useState<string | null>(null);

  const [newRecipientId, setNewRecipientId] = useState("");
  const [newRecipientLabel, setNewRecipientLabel] = useState("");
  const [isAddingRecipient, setIsAddingRecipient] = useState(false);
  const [recipientError, setRecipientError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch("/api/notification-schedule/weekday").then((res) => res.json()),
      fetch("/api/notification-schedule/overrides").then((res) => res.json()),
      fetch("/api/notification-schedule/recipients").then((res) => res.json()),
    ])
      .then(([weekdayData, overrideData, recipientData]) => {
        if (cancelled) return;
        const schedule = (weekdayData.schedule as WeekdayRow[]).sort(
          (a, b) => a.weekday - b.weekday,
        );
        const overrideRows = overrideData.overrides as OverrideRow[];
        setWeekdayRows(schedule);
        setOverrides(overrideRows);
        setRecipients(recipientData.recipients as RecipientRow[]);
        setBulkRows(
          buildBulkRows(buildTwoMonthDateRange(jstTodayDateKey()), schedule, overrideRows),
        );
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

  const handleAddRecipient = async () => {
    setRecipientError(null);
    setIsAddingRecipient(true);
    try {
      const res = await fetch("/api/notification-schedule/recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          lineUserId: newRecipientId,
          label: newRecipientLabel || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setRecipientError(data?.error ?? "追加に失敗しました。もう一度お試しください。");
        return;
      }
      const data = (await res.json()) as { recipient: RecipientRow };
      setRecipients((prev) => [...prev, data.recipient]);
      setNewRecipientId("");
      setNewRecipientLabel("");
    } catch {
      setRecipientError("追加に失敗しました。もう一度お試しください。");
    } finally {
      setIsAddingRecipient(false);
    }
  };

  const handleDeleteRecipient = async (id: number) => {
    try {
      const res = await fetch(`/api/notification-schedule/recipients/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        window.alert("削除に失敗しました。もう一度お試しください。");
        return;
      }
      setRecipients((prev) => prev.filter((r) => r.id !== id));
    } catch {
      window.alert("削除に失敗しました。もう一度お試しください。");
    }
  };

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

  const updateBulkRow = (date: string, patch: Partial<Pick<BulkRow, "time" | "skip">>) => {
    setBulkRows((prev) => prev.map((r) => (r.date === date ? { ...r, ...patch } : r)));
  };

  const handleRegenerateBulkRows = () => {
    setBulkRows(buildBulkRows(buildTwoMonthDateRange(jstTodayDateKey()), weekdayRows, overrides));
  };

  const handleSaveBulk = async () => {
    setIsSavingBulk(true);
    setBulkSaveMessage(null);
    try {
      const res = await fetch("/api/notification-schedule/overrides/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          overrides: bulkRows.map((r) => ({ date: r.date, time: r.skip ? null : r.time })),
        }),
      });
      if (!res.ok) {
        window.alert("保存に失敗しました。もう一度お試しください。");
        return;
      }
      const data = (await res.json()) as { overrides: OverrideRow[] };
      setOverrides((prev) => {
        const savedDates = new Set(data.overrides.map((o) => o.date.slice(0, 10)));
        return [...prev.filter((o) => !savedDates.has(o.date.slice(0, 10))), ...data.overrides].sort(
          (a, b) => a.date.localeCompare(b.date),
        );
      });
      setBulkSaveMessage("保存しました");
      setTimeout(() => setBulkSaveMessage(null), 3000);
    } catch {
      window.alert("保存に失敗しました。もう一度お試しください。");
    } finally {
      setIsSavingBulk(false);
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
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">今月・来月分をまとめて設定</h3>
          <button
            type="button"
            className="shrink-0 cursor-pointer text-xs font-semibold text-blue-600"
            onClick={handleRegenerateBulkRows}
          >
            曜日設定から作り直す
          </button>
        </div>
        <p className="mb-2 text-xs text-gray-500">
          「曜日ごとの送信時刻」を元に、今日から来月末までの送信時刻をまとめて用意します。個別の日付だけ時刻を変えたり「送信しない」にしたうえで、まとめて保存できます。
        </p>

        <div className="mb-3 max-h-80 overflow-y-auto rounded-lg border border-gray-200">
          <ul className="flex flex-col divide-y divide-gray-200">
            {bulkRows.map((row) => (
              <li key={row.date} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="w-20 shrink-0">
                  {row.date.slice(5).replace("-", "/")}({WEEKDAY_LABELS[row.weekday]})
                </span>
                <input
                  type="time"
                  className="rounded-lg border border-gray-300 bg-background px-2 py-1.5 text-sm text-foreground disabled:opacity-40"
                  value={row.time}
                  disabled={row.skip}
                  onChange={(e) => updateBulkRow(row.date, { time: e.target.value })}
                />
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={row.skip}
                    onChange={(e) => updateBulkRow(row.date, { skip: e.target.checked })}
                  />
                  送信しない
                </label>
              </li>
            ))}
          </ul>
        </div>

        {bulkSaveMessage && (
          <p className="mb-2 text-xs text-green-700" role="status">
            {bulkSaveMessage}
          </p>
        )}

        <button
          type="button"
          className="w-full cursor-pointer rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-400"
          onClick={handleSaveBulk}
          disabled={isSavingBulk || bulkRows.length === 0}
        >
          {isSavingBulk ? "保存中..." : "まとめて保存する"}
        </button>
      </div>

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
        <h3 className="mb-2 text-sm font-semibold">日付ごとの設定</h3>

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
          <p className="text-xs text-gray-500">設定はありません。</p>
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

      <div>
        <h3 className="mb-2 text-sm font-semibold">通知先(LINE)</h3>
        <p className="mb-2 text-xs text-gray-500">
          追加したい方に、botを友だち追加のうえ何かメッセージを送ってもらってください。返信されるUser
          IDをここに登録すると、その方にも毎日の通知が届くようになります。
        </p>

        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="text"
            className="flex-1 rounded-lg border border-gray-300 bg-background px-2 py-1.5 text-sm text-foreground"
            value={newRecipientId}
            onChange={(e) => setNewRecipientId(e.target.value)}
            placeholder="U から始まるLINE User ID"
          />
          <input
            type="text"
            className="w-full rounded-lg border border-gray-300 bg-background px-2 py-1.5 text-sm text-foreground sm:w-28"
            value={newRecipientLabel}
            onChange={(e) => setNewRecipientLabel(e.target.value)}
            placeholder="名前(任意)"
          />
          <button
            type="button"
            className="shrink-0 cursor-pointer rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-400"
            onClick={handleAddRecipient}
            disabled={!newRecipientId || isAddingRecipient}
          >
            追加
          </button>
        </div>

        {recipientError && <p className="mb-2 text-xs text-red-600">{recipientError}</p>}

        {recipients.length === 0 ? (
          <p className="text-xs text-gray-500">通知先が登録されていません。</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {recipients.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate">
                  {r.label && <span className="font-semibold">{r.label}　</span>}
                  <span className="text-xs text-gray-500">{r.lineUserId}</span>
                </span>
                <button
                  type="button"
                  className="shrink-0 cursor-pointer rounded-lg border border-red-300 px-2.5 py-1 text-xs font-semibold text-red-600"
                  onClick={() => handleDeleteRecipient(r.id)}
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
