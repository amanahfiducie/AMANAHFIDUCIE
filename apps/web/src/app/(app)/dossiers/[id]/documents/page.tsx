import { redirect } from "next/navigation";

/** Ancien onglet Documents — redirection vers la vue d'ensemble du dossier. */
export default async function CaseDocumentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/dossiers/${id}`);
}
