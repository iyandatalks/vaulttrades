import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import { getProductAccess } from "../../lib/product-access";
import JournalClient from "./JournalClient";

export default async function JournalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/journal");

  const access = await getProductAccess(user.id);
  if (!access.anyPaidProduct) redirect("/products");

  return <JournalClient />;
}
