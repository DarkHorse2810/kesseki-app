"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { rememberLastPage } from "@/lib/deviceStorage";
import TodayAbsenceLink from "@/components/TodayAbsenceLink";

const NON_PLAYER_POSITIONS = new Set(["MANAGER", "ANALYST"]);

type AbsenceEntry = {
  id: number;
  player: {
    id: number;
    name: string;
    currentGrade: number;
    positions: string[];
  };
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function todayDateKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

export default function TodayAbsencePage() {
  const [absences, setAbsences] = useState<AbsenceEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    rememberLastPage("today");
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    fetch(`/api/absences?date=${todayDateKey()}`)
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
  }, []);

  const nonPlayerCount = useMemo(
    () =>
      absences.filter((absence) =>
        absence.player.positions.some((position) => NON_PLAYER_POSITIONS.has(position)),
      ).length,
    [absences],
  );

  return (
    <div className="flex min-h-dvh flex-col items-center bg-[#fafafa] px-4 pt-10 pb-40 dark:bg-black">
      <div className="w-full max-w-[480px] rounded-2xl bg-background p-6 text-foreground shadow-[0_1px_8px_rgba(0,0,0,0.08)]">
        <TodayAbsenceLink />

        <h1 className="mb-4 text-xl font-semibold">
          今日の欠席　{absences.length}名（{nonPlayerCount}名）
        </h1>

        {isLoading && <p className="text-sm text-gray-500">読み込み中...</p>}
        {loadError && <p className="text-sm text-red-600">{loadError}</p>}

        {!isLoading && !loadError && absences.length === 0 && (
          <p className="text-sm text-gray-500">本日の欠席者はいません。</p>
        )}

        {!isLoading && !loadError && absences.length > 0 && (
          <ul className="mb-6 flex flex-col gap-1.5">
            {absences.map((absence) => (
              <li key={absence.id} className="text-base">
                {absence.player.currentGrade}年{absence.player.name}
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-3">
          <Link
            href="/absence"
            className="block w-full rounded-lg border border-gray-300 py-3 text-center text-base font-semibold text-foreground hover:bg-gray-50 dark:hover:bg-white/5"
          >
            欠席連絡
          </Link>
          <Link
            href="/schedule"
            className="block w-full rounded-lg border border-gray-300 py-3 text-center text-base font-semibold text-foreground hover:bg-gray-50 dark:hover:bg-white/5"
          >
            予定表
          </Link>
        </div>
      </div>
    </div>
  );
}
