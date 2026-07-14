"use client";

import { useRef, useState } from "react";
import { useSelfPlayer } from "@/components/SelfPlayerProvider";
import { positionLabel } from "@/lib/positions";

export default function SelfPlayerTopBar() {
  const { selfPlayer } = useSelfPlayer();
  const [isOpen, setIsOpen] = useState(false);
  const openedAtRef = useRef(0);

  if (!selfPlayer) return null;

  const openInfo = () => {
    openedAtRef.current = Date.now();
    setIsOpen(true);
  };

  const closeInfo = () => setIsOpen(false);

  const handleBackdropClick = () => {
    if (Date.now() - openedAtRef.current < 400) return;
    closeInfo();
  };

  return (
    <>
      <div
        className="sticky top-0 z-30 w-full border-b border-gray-200 bg-background/95 backdrop-blur"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <button
          type="button"
          className="w-full cursor-pointer bg-transparent px-4 py-3 text-left text-sm font-semibold text-foreground [touch-action:manipulation]"
          onClick={openInfo}
        >
          {selfPlayer.name}さん
        </button>
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 z-[1001] flex items-end justify-center bg-black/50 sm:items-center"
          onClick={handleBackdropClick}
          role="presentation"
        >
          <div
            className="w-full max-w-[400px] rounded-t-2xl bg-background p-6 text-foreground shadow-[0_-4px_24px_rgba(0,0,0,0.2)] sm:rounded-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="self-player-info-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="self-player-info-title" className="text-lg">
                自分の情報
              </h2>
              <button
                type="button"
                className="cursor-pointer border-none bg-transparent px-2 py-1 text-[22px] leading-none text-inherit"
                onClick={closeInfo}
                aria-label="閉じる"
              >
                ×
              </button>
            </div>

            <dl className="flex flex-col gap-3 text-sm">
              <div>
                <dt className="text-xs text-gray-500">名前</dt>
                <dd className="text-base font-semibold">{selfPlayer.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">学年</dt>
                <dd className="text-base font-semibold">{selfPlayer.currentGrade}年</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">ポジション</dt>
                <dd className="text-base font-semibold">
                  {selfPlayer.positions.map(positionLabel).join("、")}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">登録番号</dt>
                <dd className="text-2xl font-semibold tracking-[0.3em]">{selfPlayer.pin}</dd>
                <p className="mt-1 text-xs text-gray-500">
                  他の端末の「登録」→「登録番号」からこの番号を入力すると、その端末でも自分として欠席連絡できます。
                </p>
              </div>
            </dl>
          </div>
        </div>
      )}
    </>
  );
}
