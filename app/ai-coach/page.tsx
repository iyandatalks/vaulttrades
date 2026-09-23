import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import { getProductAccess } from "../../lib/product-access";
import AICoachClient from "./AICoachClient";

export default async function AICoachPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/ai-coach");

  const access = await getProductAccess(user.id);
  if (!access.anyPaidProduct) redirect("/products");

  return <AICoachClient />;
}
