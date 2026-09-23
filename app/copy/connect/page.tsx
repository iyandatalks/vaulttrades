import { redirect } from "next/navigation";
import CopyConnectClient from "./CopyConnectClient";
import { createClient } from "@/lib/supabase/server";
import { getCopyAccess } from "@/lib/copy-access";

export default async function CopyConnectPage() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) redirect("/products?product=copy");

  const access = await getCopyAccess(user.id);
  if (!access.active) redirect("/products?product=copy");

  return <CopyConnectClient />;
}
