"use client";

import { useId, useRef, useState } from "react";
import { useSelfPlayer } from "@/components/SelfPlayerProvider";
import { POSITION_OPTIONS, type PositionValue } from "@/lib/positions";

type FormMode = "create" | "pin";

export default function PlayerRegistrationModal() {
  const { selfPlayer, isChecking, setSelfPlayerId, refreshSelfPlayer } = useSelfPlayer();
  const isEditing = selfPlayer !== null;

  const [isOpen, setIsOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");

  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [positions, setPositions] = useState<PositionValue[]>([]);
  const [isPositionListOpen, setIsPositionListOpen] = useState(false);
  const [pin, setPin] = useState("");

  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const nameFieldId = useId();
  const gradeFieldId = useId();
  const pinFieldId = useId();
  const openedAtRef = useRef(0);

  const isNameValid = name.trim().length > 0;
  const isGradeValid = grade.trim().length > 0;
  const isPositionsValid = positions.length > 0;
  const isFormValid = isNameValid && isGradeValid && isPositionsValid;
  const isPinValid = /^\d{4}$/.test(pin);

  const resetForm = () => {
    setName("");
    setGrade("");
    setPositions([]);
    setIsPositionListOpen(false);
    setPin("");
    setFormMode("create");
    setSubmitted(false);
    setIsSubmitting(false);
    setSubmitError(null);
  };

  const openModal = () => {
    openedAtRef.current = Date.now();
    if (selfPlayer) {
      setName(selfPlayer.name);
      setGrade(String(selfPlayer.currentGrade));
      setPositions(selfPlayer.positions as PositionValue[]);
    }
    setIsOpen(true);
  };

  // WebKit on iOS can be inconsistent about synthesizing a "click" from a
  // tap on elements it doesn't otherwise treat as scroll-interactive.
  // Handling the raw touch event directly removes that dependency.
  const handleFabTouchEnd = (e: React.TouchEvent<HTMLButtonElement>) => {
    e.preventDefault();
    openModal();
  };

  const closeModal = () => {
    setIsOpen(false);
    resetForm();
  };

  const handleBackdropClick = () => {
    // Some mobile browsers replay a delayed "ghost" click at the same
    // coordinates shortly after the tap that opened the modal. Since the
    // backdrop now occupies that spot, an unguarded handler here would
    // immediately close the modal the instant it opens.
    if (Date.now() - openedAtRef.current < 400) return;
    closeModal();
  };

  const togglePosition = (value: PositionValue) => {
    setPositions((prev) =>
      prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value],
    );
  };

  const handleGradeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGrade(e.target.value.replace(/[^0-9]/g, ""));
  };

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 4));
  };

  const submitPinLogin = async () => {
    const res = await fetch("/api/players/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setSubmitError(data?.error ?? "登録番号が見つかりません。もう一度お試しください。");
      return;
    }

    const data = (await res.json()) as { player: { id: number } };
    setSelfPlayerId(data.player.id);
    closeModal();
  };

  const submitProfileForm = async () => {
    const payload = {
      name,
      baseGrade: Number(grade),
      positions,
    };

    const res = await fetch(
      isEditing ? `/api/players/${selfPlayer.id}` : "/api/players",
      {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setSubmitError(data?.error ?? "登録に失敗しました。もう一度お試しください。");
      return;
    }

    if (isEditing) {
      refreshSelfPlayer();
    } else {
      const data = (await res.json()) as { player: { id: number } };
      setSelfPlayerId(data.player.id);
    }
    closeModal();
  };

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);
    setSubmitError(null);

    const isPinFlow = !isEditing && formMode === "pin";
    if (isPinFlow ? !isPinValid : !isFormValid) return;
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (isPinFlow) {
        await submitPinLogin();
      } else {
        await submitProfileForm();
      }
    } catch {
      setSubmitError("通信に失敗しました。もう一度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalTitle = isEditing ? "登録変更" : formMode === "pin" ? "登録番号でログイン" : "登録";

  return (
    <>
      {!isChecking && (
        <button
          type="button"
          className="absolute right-6 bottom-24 z-40 flex h-12 [touch-action:manipulation] cursor-pointer items-center justify-center rounded-full bg-blue-600 px-5 text-sm font-semibold leading-none text-white shadow-lg transition-transform duration-100 hover:bg-blue-700 active:scale-90 active:bg-blue-800"
          onClick={openModal}
          onTouchEnd={handleFabTouchEnd}
        >
          {isEditing ? "登録変更" : "登録"}
        </button>
      )}

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
            aria-labelledby="player-registration-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="player-registration-title" className="text-lg">
                {modalTitle}
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

            {!isEditing && (
              <div className="mb-5 flex gap-4 border-b border-gray-200 text-sm">
                <button
                  type="button"
                  className={`cursor-pointer border-b-2 px-1 pb-2 font-semibold ${
                    formMode === "create"
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500"
                  }`}
                  onClick={() => {
                    setFormMode("create");
                    setSubmitError(null);
                  }}
                >
                  新規登録
                </button>
                <button
                  type="button"
                  className={`cursor-pointer border-b-2 px-1 pb-2 font-semibold ${
                    formMode === "pin"
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500"
                  }`}
                  onClick={() => {
                    setFormMode("pin");
                    setSubmitError(null);
                  }}
                >
                  登録番号
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              {!isEditing && formMode === "pin" ? (
                <div className="mb-5">
                  <label htmlFor={pinFieldId} className="mb-1.5 block text-sm font-semibold">
                    登録番号(4桁)
                    <span className="ml-1 text-xs font-normal text-red-600">必須</span>
                  </label>
                  <p className="mb-2 text-xs text-gray-500">
                    別の端末で登録した際に発行された4桁の番号を入力すると、この端末でも同じ選手として欠席連絡できます。
                  </p>
                  <input
                    id={pinFieldId}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="w-full rounded-lg border border-gray-300 bg-background px-3 py-2.5 text-center text-2xl tracking-[0.5em] text-foreground focus:outline-2 focus:outline-offset-1 focus:outline-blue-600"
                    value={pin}
                    onChange={handlePinChange}
                    placeholder="0000"
                  />
                  {submitted && !isPinValid && (
                    <p className="mt-1 text-xs text-red-600">4桁の数字を入力してください</p>
                  )}
                </div>
              ) : (
                <>
                  <div className="mb-5">
                    <label htmlFor={nameFieldId} className="mb-1.5 block text-sm font-semibold">
                      名前
                      <span className="ml-1 text-xs font-normal text-red-600">必須</span>
                    </label>
                    <input
                      id={nameFieldId}
                      type="text"
                      className="w-full rounded-lg border border-gray-300 bg-background px-3 py-2.5 text-base text-foreground focus:outline-2 focus:outline-offset-1 focus:outline-blue-600"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="例）山田 太郎"
                    />
                    {submitted && !isNameValid && (
                      <p className="mt-1 text-xs text-red-600">名前を入力してください</p>
                    )}
                  </div>

                  <div className="mb-5">
                    <label htmlFor={gradeFieldId} className="mb-1.5 block text-sm font-semibold">
                      学年
                      <span className="ml-1 text-xs font-normal text-red-600">必須</span>
                    </label>
                    <input
                      id={gradeFieldId}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="w-full rounded-lg border border-gray-300 bg-background px-3 py-2.5 text-base text-foreground focus:outline-2 focus:outline-offset-1 focus:outline-blue-600"
                      value={grade}
                      onChange={handleGradeChange}
                      placeholder="例）1"
                    />
                    {submitted && !isGradeValid && (
                      <p className="mt-1 text-xs text-red-600">学年を入力してください</p>
                    )}
                  </div>

                  <div className="mb-5">
                    <span className="mb-1.5 block text-sm font-semibold">ポジション</span>
                    <button
                      type="button"
                      className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-gray-300 bg-background px-3 py-2.5 text-base text-foreground"
                      onClick={() => setIsPositionListOpen((prev) => !prev)}
                      aria-expanded={isPositionListOpen}
                    >
                      <span>
                        {positions.length > 0
                          ? `${positions.length}件選択中`
                          : "ポジションを選択"}
                      </span>
                      <span
                        className={`text-xs transition-transform duration-150 ${
                          isPositionListOpen ? "rotate-180" : ""
                        }`}
                      >
                        ▼
                      </span>
                    </button>

                    {isPositionListOpen && (
                      <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg border border-gray-200 p-3">
                        {POSITION_OPTIONS.map((option) => (
                          <label
                            key={option.value}
                            className="flex cursor-pointer items-center gap-2 text-sm"
                          >
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={positions.includes(option.value)}
                              onChange={() => togglePosition(option.value)}
                            />
                            {option.label}
                          </label>
                        ))}
                      </div>
                    )}
                    {submitted && !isPositionsValid && (
                      <p className="mt-1 text-xs text-red-600">
                        ポジションを1つ以上選択してください
                      </p>
                    )}
                  </div>
                </>
              )}

              {submitError && (
                <p className="mb-3 text-sm text-red-600" role="alert">
                  {submitError}
                </p>
              )}

              <button
                type="submit"
                className="w-full cursor-pointer rounded-lg bg-blue-600 py-3 text-base font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-400"
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? "処理中..."
                  : !isEditing && formMode === "pin"
                    ? "ログイン"
                    : isEditing
                      ? "変更する"
                      : "登録する"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
