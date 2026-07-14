"use client";

import { useRef, useState } from "react";
import SettingsPanel from "@/components/SettingsPanel";

export default function SettingsButton() {
  const [isOpen, setIsOpen] = useState(false);
  const openedAtRef = useRef(0);

  const openModal = () => {
    openedAtRef.current = Date.now();
    setIsOpen(true);
  };

  // WebKit on iOS can be inconsistent about synthesizing a "click" from a
  // tap on elements it doesn't otherwise treat as scroll-interactive.
  const handleTouchEnd = (e: React.TouchEvent<HTMLButtonElement>) => {
    e.preventDefault();
    openModal();
  };

  const closeModal = () => setIsOpen(false);

  const handleBackdropClick = () => {
    // Some mobile browsers replay a delayed "ghost" click at the same
    // coordinates shortly after the tap that opened the modal.
    if (Date.now() - openedAtRef.current < 400) return;
    closeModal();
  };

  return (
    <>
      <button
        type="button"
        className="absolute right-6 bottom-6 z-40 flex h-12 [touch-action:manipulation] cursor-pointer items-center justify-center rounded-full border border-gray-300 bg-background px-5 text-sm font-semibold leading-none text-foreground shadow-lg transition-transform duration-100 hover:bg-gray-50 active:scale-90 dark:hover:bg-white/10"
        onClick={openModal}
        onTouchEnd={handleTouchEnd}
      >
        設定
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-[1001] flex items-end justify-center bg-black/50 sm:items-center"
          onClick={handleBackdropClick}
          role="presentation"
        >
          <div
            className="max-h-[90vh] w-full max-w-[480px] overflow-y-auto rounded-t-2xl bg-background p-6 text-foreground shadow-[0_-4px_24px_rgba(0,0,0,0.2)] sm:rounded-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="settings-title" className="text-lg">
                設定
              </h2>
              <button
                type="button"
                className="cursor-pointer border-none bg-transparent px-2 py-1 text-[22px] leading-none text-inherit"
                onClick={closeModal}
                aria-label="閉じる"
              >
                ×
              </button>
            </div>

            <SettingsPanel />
          </div>
        </div>
      )}
    </>
  );
}
