"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { rememberLastPage } from "@/lib/deviceStorage";
import { useSelfPlayer } from "@/components/SelfPlayerProvider";
import TodayAbsenceLink from "@/components/TodayAbsenceLink";

export default function AbsencePage() {
  const { selfPlayer, isChecking } = useSelfPlayer();

  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const dateFieldId = useId();
  const reasonFieldId = useId();

  useEffect(() => {
    rememberLastPage("absence");
  }, []);

  const isDateValid = date.trim().length > 0;
  const isReasonValid = reason.trim().length > 0;

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);
    setFormError(null);
    setSuccessMessage(null);

    if (!selfPlayer) {
      setFormError("先に登録を行ってください");
      return;
    }

    if (!isDateValid || !isReasonValid) return;
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/absences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: selfPlayer.id,
          date,
          reason,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setFormError(data?.error ?? "送信に失敗しました。もう一度お試しください。");
        return;
      }

      setDate("");
      setReason("");
      setSubmitted(false);
      setSuccessMessage("送信しました");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch {
      setFormError("送信に失敗しました。もう一度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center bg-[#fafafa] px-4 pt-10 pb-40 dark:bg-black">
      <div className="w-full max-w-[480px] rounded-2xl bg-background p-6 text-foreground shadow-[0_1px_8px_rgba(0,0,0,0.08)]">
        <TodayAbsenceLink />

        {selfPlayer && (
          <p className="mb-6 text-sm">
            自分: <span className="font-semibold">{selfPlayer.name}</span>
          </p>
        )}

        <h1 className="mb-6 text-xl font-semibold">欠席連絡</h1>

        {!isChecking && !selfPlayer && (
          <p className="mb-6 rounded-lg border border-gray-200 p-4 text-sm text-red-600">
            まだ登録されていません。右下の「登録」から登録するか、他の端末で発行された登録番号でログインしてください。
          </p>
        )}

        {successMessage && (
          <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700" role="status">
            {successMessage}
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-5">
            <label htmlFor={dateFieldId} className="mb-1.5 block text-sm font-semibold">
              日付
              <span className="ml-1 text-xs font-normal text-red-600">必須</span>
            </label>
            <input
              id={dateFieldId}
              type="date"
              className="w-full rounded-lg border border-gray-300 bg-background px-3 py-2.5 text-base text-foreground focus:outline-2 focus:outline-offset-1 focus:outline-blue-600"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            {submitted && !isDateValid && (
              <p className="mt-1 text-xs text-red-600">日付を入力してください</p>
            )}
          </div>

          <div className="mb-5">
            <label htmlFor={reasonFieldId} className="mb-1.5 block text-sm font-semibold">
              理由
              <span className="ml-1 text-xs font-normal text-red-600">必須</span>
            </label>
            <textarea
              id={reasonFieldId}
              rows={4}
              className="w-full rounded-lg border border-gray-300 bg-background px-3 py-2.5 text-base text-foreground focus:outline-2 focus:outline-offset-1 focus:outline-blue-600"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            {submitted && !isReasonValid && (
              <p className="mt-1 text-xs text-red-600">理由を入力してください</p>
            )}
          </div>

          {formError && (
            <p className="mb-3 text-sm text-red-600" role="alert">
              {formError}
            </p>
          )}

          <button
            type="submit"
            className="w-full cursor-pointer rounded-lg bg-blue-600 py-3 text-base font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-400"
            disabled={isSubmitting}
          >
            {isSubmitting ? "送信中..." : "送信"}
          </button>
        </form>

        <Link
          href="/schedule"
          className="mt-4 block w-full rounded-lg border border-gray-300 py-3 text-center text-base font-semibold text-foreground hover:bg-gray-50 dark:hover:bg-white/5"
        >
          予定表へ
        </Link>
      </div>
    </div>
  );
}
