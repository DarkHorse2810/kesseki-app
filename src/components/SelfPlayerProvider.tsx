"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { SELF_PLAYER_STORAGE_KEY } from "@/lib/deviceStorage";

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

export function SelfPlayerProvider({ children }: { children: React.ReactNode }) {
  const [selfPlayer, setSelfPlayer] = useState<SelfPlayer | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  const fetchSelfPlayer = useCallback(async (id: number) => {
    try {
      const res = await fetch(`/api/players/${id}`);
      if (!res.ok) {
        window.localStorage.removeItem(SELF_PLAYER_STORAGE_KEY);
        setSelfPlayer(null);
        return;
      }
      const data = (await res.json()) as { player: SelfPlayer };
      setSelfPlayer(data.player);
    } catch {
      setSelfPlayer(null);
    }
  }, []);

  useEffect(() => {
    const storedId = window.localStorage.getItem(SELF_PLAYER_STORAGE_KEY);
    const idNumber = storedId ? Number(storedId) : null;
    if (idNumber) {
      fetchSelfPlayer(idNumber).finally(() => setIsChecking(false));
    } else {
      setIsChecking(false);
    }
  }, [fetchSelfPlayer]);

  const setSelfPlayerId = useCallback(
    (id: number) => {
      window.localStorage.setItem(SELF_PLAYER_STORAGE_KEY, String(id));
      fetchSelfPlayer(id);
    },
    [fetchSelfPlayer],
  );

  const refreshSelfPlayer = useCallback(() => {
    if (selfPlayer) fetchSelfPlayer(selfPlayer.id);
  }, [selfPlayer, fetchSelfPlayer]);

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
