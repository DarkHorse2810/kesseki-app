"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { SELF_PLAYER_CACHE_KEY, SELF_PLAYER_STORAGE_KEY } from "@/lib/deviceStorage";

export type SelfPlayer = {
  id: number;
  name: string;
  currentGrade: number;
  positions: string[];
  pin: string;
};

type SelfPlayerContextValue = {
  selfPlayer: SelfPlayer | null;
  isChecking: boolean;
  setSelfPlayerId: (id: number) => void;
  refreshSelfPlayer: () => void;
};

const SelfPlayerContext = createContext<SelfPlayerContextValue | null>(null);

function readCachedPlayer(id: number): SelfPlayer | null {
  const raw = window.localStorage.getItem(SELF_PLAYER_CACHE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as SelfPlayer;
    return parsed.id === id ? parsed : null;
  } catch {
    return null;
  }
}

function writeCachedPlayer(player: SelfPlayer) {
  window.localStorage.setItem(SELF_PLAYER_CACHE_KEY, JSON.stringify(player));
}

function isSamePlayer(a: SelfPlayer, b: SelfPlayer): boolean {
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.currentGrade === b.currentGrade &&
    a.pin === b.pin &&
    a.positions.length === b.positions.length &&
    a.positions.every((p, i) => p === b.positions[i])
  );
}

export function SelfPlayerProvider({ children }: { children: React.ReactNode }) {
  const [selfPlayer, setSelfPlayer] = useState<SelfPlayer | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  // Fetches the latest data in the background and only triggers a re-render
  // if something actually changed since the cached/displayed value.
  const syncSelfPlayer = useCallback(async (id: number) => {
    try {
      const res = await fetch(`/api/players/${id}`);
      if (!res.ok) {
        window.localStorage.removeItem(SELF_PLAYER_STORAGE_KEY);
        window.localStorage.removeItem(SELF_PLAYER_CACHE_KEY);
        setSelfPlayer(null);
        return;
      }
      const data = (await res.json()) as { player: SelfPlayer };
      writeCachedPlayer(data.player);
      setSelfPlayer((prev) => (prev && isSamePlayer(prev, data.player) ? prev : data.player));
    } catch {
      // Keep whatever is already displayed (cached or previous state) if the
      // background sync fails; the device stays usable offline/on flaky networks.
    }
  }, []);

  useEffect(() => {
    const storedId = window.localStorage.getItem(SELF_PLAYER_STORAGE_KEY);
    const idNumber = storedId ? Number(storedId) : null;

    if (!idNumber) {
      setIsChecking(false);
      return;
    }

    const cached = readCachedPlayer(idNumber);
    if (cached) {
      // Show last-known data immediately, then reconcile with the server.
      setSelfPlayer(cached);
      setIsChecking(false);
      syncSelfPlayer(idNumber);
    } else {
      syncSelfPlayer(idNumber).finally(() => setIsChecking(false));
    }
  }, [syncSelfPlayer]);

  const setSelfPlayerId = useCallback(
    (id: number) => {
      window.localStorage.setItem(SELF_PLAYER_STORAGE_KEY, String(id));
      syncSelfPlayer(id);
    },
    [syncSelfPlayer],
  );

  const refreshSelfPlayer = useCallback(() => {
    if (selfPlayer) syncSelfPlayer(selfPlayer.id);
  }, [selfPlayer, syncSelfPlayer]);

  return (
    <SelfPlayerContext.Provider
      value={{ selfPlayer, isChecking, setSelfPlayerId, refreshSelfPlayer }}
    >
      {children}
    </SelfPlayerContext.Provider>
  );
}

export function useSelfPlayer() {
  const ctx = useContext(SelfPlayerContext);
  if (!ctx) throw new Error("useSelfPlayer must be used within SelfPlayerProvider");
  return ctx;
}
