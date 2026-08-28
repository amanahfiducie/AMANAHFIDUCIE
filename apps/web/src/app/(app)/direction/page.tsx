import { redirect } from "next/navigation";

/** Ancienne vue d'ensemble Direction — remplacée par le tableau de bord. */
export default function DirectionOverviewPage() {
  redirect("/dashboard");
}
