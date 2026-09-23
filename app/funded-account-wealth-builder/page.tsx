import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import { getProductAccess } from "../../lib/product-access";
import WealthBuilderClient from "./WealthBuilderClient";

export default async function FundedAccountWealthBuilderPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/funded-account-wealth-builder");

  const access = await getProductAccess(user.id);
  if (!access.anyPaidProduct) redirect("/products");

  return <WealthBuilderClient />;
}
