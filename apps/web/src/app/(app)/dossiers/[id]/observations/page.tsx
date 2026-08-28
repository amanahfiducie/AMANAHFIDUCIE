import { redirect } from "next/navigation";

export default async function ObservationsIndexPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/dossiers/${id}/observations/partagees`);
}
