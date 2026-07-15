"use client";

import { useEffect, useId, useState } from "react";
import { positionLabel } from "@/lib/positions";
import ScheduleItemsManager from "@/components/ScheduleItemsManager";
import AbsenceDeletionManager from "@/components/AbsenceDeletionManager";
import { SETTINGS_AUTH_DURATION_MS, SETTINGS_AUTH_STORAGE_KEY } from "@/lib/deviceStorage";

type SettingsView = "players" | "schedule" | "absences";

type Player = {
  id: number;
  name: string;
  currentGrade: number;
  positions: string[];
};

type StoredAuth = {
  password: string;
  expiresAt: number;
};

function readStoredAuth(): StoredAuth | null {
  const raw = window.localStorage.getItem(SETTINGS_AUTH_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as StoredAuth;
    if (parsed.expiresAt > Date.now()) return parsed;
  } catch {
    // fall through to null below
  }
  window.localStorage.removeItem(SETTINGS_AUTH_STORAGE_KEY);
  return null;
}

export default function SettingsPanel() {
  const passwordFieldId = useId();

  const [password, setPassword] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isCheckingStoredAuth, setIsCheckingStoredAuth] = useState(true);
  const [view, setView] = useState<SettingsView>("players");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadPlayers = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/players");
      if (!res.ok) throw new Error("failed to load players");
      const data = (await res.json()) as { players: Player[] };
      setPlayers(data.players);
    } catch {
      setLoadError("選手一覧の取得に失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const stored = readStoredAuth();
    if (stored) {
      setPassword(stored.password);
      setIsUnlocked(true);
      loadPlayers();
    }
    setIsCheckingStoredAuth(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleVerify = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setVerifyError(null);
    if (isVerifying) return;

    setIsVerifying(true);
    try {
      const res = await fetch("/api/settings/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        setVerifyError("パスワードが違います");
        return;
      }

      const auth: StoredAuth = { password, expiresAt: Date.now() + SETTINGS_AUTH_DURATION_MS };
      window.localStorage.setItem(SETTINGS_AUTH_STORAGE_KEY, JSON.stringify(auth));

      setIsUnlocked(true);
      await loadPlayers();
    } catch {
      setVerifyError("通信に失敗しました。もう一度お試しください。");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDelete = async (player: Player) => {
    if (!window.confirm(`${player.name}を削除します。よろしいですか？(この操作は取り消せません)`)) {
      return;
    }

    setDeletingId(player.id);
    try {
      const res = await fetch(`/api/players/${player.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        window.alert("削除に失敗しました。もう一度お試しください。");
        return;
      }

      setPlayers((prev) => prev.filter((p) => p.id !== player.id));
    } catch {
      window.alert("削除に失敗しました。もう一度お試しください。");
    } finally {
      setDeletingId(null);
    }
  };

  if (isCheckingStoredAuth) {
    return null;
  }

  if (!isUnlocked) {
    return (
      <form onSubmit={handleVerify} noValidate>
        <div className="mb-5">
          <label htmlFor={passwordFieldId} className="mb-1.5 block text-sm font-semibold">
            パスワード
            <span className="ml-1 text-xs font-normal text-red-600">必須</span>
          </label>
          <input
            id={passwordFieldId}
            type="password"
            className="w-full rounded-lg border border-gray-300 bg-background px-3 py-2.5 text-base text-foreground focus:outline-2 focus:outline-offset-1 focus:outline-blue-600"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {verifyError && (
          <p className="mb-3 text-sm text-red-600" role="alert">
            {verifyError}
          </p>
        )}

        <button
          type="submit"
          className="w-full cursor-pointer rounded-lg bg-blue-600 py-3 text-base font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-400"
          disabled={isVerifying}
        >
          {isVerifying ? "確認中..." : "入る"}
        </button>
      </form>
    );
  }

  return (
    <div>
      <div className="mb-5 flex gap-4 border-b border-gray-200 text-sm">
        <button
          type="button"
          className={`cursor-pointer border-b-2 px-1 pb-2 font-semibold ${
            view === "players"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500"
          }`}
          onClick={() => setView("players")}
        >
          選手
        </button>
        <button
          type="button"
          className={`cursor-pointer border-b-2 px-1 pb-2 font-semibold ${
            view === "schedule"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500"
          }`}
          onClick={() => setView("schedule")}
        >
          予定を追加
        </button>
        <button
          type="button"
          className={`cursor-pointer border-b-2 px-1 pb-2 font-semibold ${
            view === "absences"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500"
          }`}
          onClick={() => setView("absences")}
        >
          欠席削除
        </button>
      </div>

      {view === "schedule" && <ScheduleItemsManager />}
      {view === "absences" && <AbsenceDeletionManager password={password} />}

      {view === "players" && (
        <>
          {loadError && <p className="text-sm text-red-600">{loadError}</p>}

          {!isLoading && !loadError && players.length === 0 && (
            <p className="text-sm text-gray-500">登録されている選手はいません。</p>
          )}

          {!isLoading && !loadError && players.length > 0 && (
            <ul className="flex flex-col gap-2">
              {players.map((player) => (
                <li
                  key={player.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5"
                >
                  <div className="text-sm">
                    <p className="font-semibold">
                      {player.currentGrade}年 {player.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {player.positions.map(positionLabel).join("、") || "ポジション未設定"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="cursor-pointer rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => handleDelete(player)}
                    disabled={deletingId === player.id}
                  >
                    {deletingId === player.id ? "削除中..." : "削除"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
