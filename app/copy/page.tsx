import { redirect } from "next/navigation";
import CopyClient from "./CopyClient";
import { createClient } from "@/lib/supabase/server";
import { getCopyAccess } from "@/lib/copy-access";

export default async function CopyPage() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) redirect("/products?product=copy");

  const access = await getCopyAccess(user.id);
  if (!access.active) redirect("/products?product=copy");

  return <CopyClient />;
}
