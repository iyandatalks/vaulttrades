import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import SignalsClient from "./SignalsClient";
import AutomationControls from "./AutomationControls";

export default async function SignalsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/signals");
  return (
    <>
      <AutomationControls />
      <SignalsClient />
    </>
  );
}
