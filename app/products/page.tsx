import { redirect } from "next/navigation";

export default function ProductsRedirect() {
  redirect("/subscription?promo=1");
}
