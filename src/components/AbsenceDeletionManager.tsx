"use client";

import { useEffect, useState } from "react";

type AbsenceEntry = {
  id: number;
  date: string;
  reason: string;
  player: {
    id: number;
    name: string;
    currentGrade: number;
  };
};

export default function AbsenceDeletionManager({ password }: { password: string }) {
  const [absences, setAbsences] = useState<AbsenceEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/absences")
      .then((res) => {
        if (!res.ok) throw new Error("failed to load absences");
        return res.json() as Promise<{ absences: AbsenceEntry[] }>;
      })
      .then((data) => {
        if (!cancelled) setAbsences(data.absences);
      })
      .catch(() => {
        if (!cancelled) setLoadError("欠席一覧の取得に失敗しました");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleDelete = async (absence: AbsenceEntry) => {
    const dateLabel = absence.date.slice(0, 10).replaceAll("-", "/");
    if (
      !window.confirm(
        `${dateLabel}・${absence.player.currentGrade}年${absence.player.name}の欠席記録を削除します。よろしいですか？`,
      )
    ) {
      return;
    }

    setDeletingId(absence.id);
    try {
      const res = await fetch(`/api/absences/${absence.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        window.alert("削除に失敗しました。もう一度お試しください。");
        return;
      }

      setAbsences((prev) => prev.filter((a) => a.id !== absence.id));
    } catch {
      window.alert("削除に失敗しました。もう一度お試しください。");
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) return <p className="text-sm text-gray-500">読み込み中...</p>;
  if (loadError) return <p className="text-sm text-red-600">{loadError}</p>;
  if (absences.length === 0) {
    return <p className="text-sm text-gray-500">欠席記録はありません。</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {absences.map((absence) => (
        <li
          key={absence.id}
          className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2.5"
        >
          <div className="min-w-0 text-sm">
            <p className="font-semibold">
              {absence.date.slice(0, 10).replaceAll("-", "/")}・{absence.player.currentGrade}年
              {absence.player.name}
            </p>
            <p className="truncate text-xs text-gray-500">{absence.reason}</p>
          </div>
          <button
            type="button"
            className="shrink-0 cursor-pointer rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => handleDelete(absence)}
            disabled={deletingId === absence.id}
          >
            {deletingId === absence.id ? "削除中..." : "削除"}
          </button>
        </li>
      ))}
    </ul>
  );
}
