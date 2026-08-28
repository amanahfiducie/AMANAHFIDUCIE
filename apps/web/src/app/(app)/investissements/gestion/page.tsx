import { redirect } from "next/navigation";

export default function LegacyGestionRedirect() {
  redirect("/investissements/liste");
}
