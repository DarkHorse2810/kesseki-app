"use client";

import { useEffect, useState } from "react";

type TargetRow = { id: number; lineId: string; label: string | null };

export default function RealtimeTargetManager({ password }: { password: string }) {
  const [targets, setTargets] = useState<TargetRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [newId, setNewId] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/notification-schedule/realtime-targets")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setTargets(data.targets as TargetRow[]);
      })
      .catch(() => {
        if (!cancelled) setLoadError("取得に失敗しました");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleAdd = async () => {
    setAddError(null);
    setIsAdding(true);
    try {
      const res = await fetch("/api/notification-schedule/realtime-targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, lineId: newId, label: newLabel || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setAddError(data?.error ?? "追加に失敗しました。もう一度お試しください。");
        return;
      }
      const data = (await res.json()) as { target: TargetRow };
      setTargets((prev) => [...prev, data.target]);
      setNewId("");
      setNewLabel("");
    } catch {
      setAddError("追加に失敗しました。もう一度お試しください。");
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/notification-schedule/realtime-targets/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        window.alert("削除に失敗しました。もう一度お試しください。");
        return;
      }
      setTargets((prev) => prev.filter((t) => t.id !== id));
    } catch {
      window.alert("削除に失敗しました。もう一度お試しください。");
    }
  };

  if (isLoading) return null;
  if (loadError) return <p className="text-sm text-red-600">{loadError}</p>;

  return (
    <div>
      <p className="mb-3 text-xs text-gray-500">
        欠席連絡が送信された瞬間に、ここに登録したLINEグループ/個人へ即時に内容が送られます。botをグループに招待して何かメッセージを送ると、そのグループのIDが返信されるので、それをここに登録してください。
      </p>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          className="flex-1 rounded-lg border border-gray-300 bg-background px-2 py-1.5 text-sm text-foreground"
          value={newId}
          onChange={(e) => setNewId(e.target.value)}
          placeholder="グループID / User ID"
        />
        <input
          type="text"
          className="w-full rounded-lg border border-gray-300 bg-background px-2 py-1.5 text-sm text-foreground sm:w-28"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="名前(任意)"
        />
        <button
          type="button"
          className="shrink-0 cursor-pointer rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-400"
          onClick={handleAdd}
          disabled={!newId || isAdding}
        >
          追加
        </button>
      </div>

      {addError && <p className="mb-2 text-xs text-red-600">{addError}</p>}

      {targets.length === 0 ? (
        <p className="text-xs text-gray-500">送信先が登録されていません。</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {targets.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate">
                {t.label && <span className="font-semibold">{t.label}　</span>}
                <span className="text-xs text-gray-500">{t.lineId}</span>
              </span>
              <button
                type="button"
                className="shrink-0 cursor-pointer rounded-lg border border-red-300 px-2.5 py-1 text-xs font-semibold text-red-600"
                onClick={() => handleDelete(t.id)}
              >
                削除
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
