import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LAST_PAGE_COOKIE_NAME } from "@/lib/deviceStorage";

export default async function Home() {
  const cookieStore = await cookies();
  const lastPage = cookieStore.get(LAST_PAGE_COOKIE_NAME)?.value;

  if (lastPage === "schedule") redirect("/schedule");
  if (lastPage === "today") redirect("/today");
  redirect("/absence");
}
