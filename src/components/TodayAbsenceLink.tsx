import Link from "next/link";

export default function TodayAbsenceLink() {
  return (
    <Link
      href="/today"
      className="mb-6 block w-full rounded-lg border border-gray-300 py-2.5 text-center text-sm font-semibold text-foreground hover:bg-gray-50 dark:hover:bg-white/5"
    >
      今日の欠席
    </Link>
  );
}
