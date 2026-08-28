"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { UsersSubNav } from "@/components/admin/users-sub-nav";
import { PageHeader } from "@/components/ui/page-header";
import { LoadingState } from "@/components/ui/loading";
import { userCanManageUsers } from "@/lib/role-access";
import { useAuth } from "@/providers/auth-provider";

export default function AdminUtilisateursLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!userCanManageUsers(user)) {
      router.replace("/dashboard");
    }
  }, [loading, user, router]);

  if (loading || !userCanManageUsers(user)) {
    return <LoadingState label="Chargement…" />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Utilisateurs"
        description="Gestion des comptes SOFIGEPAM Connect — équipe interne, parties prenantes et demandes d'accès issues des dossiers."
      />
      <UsersSubNav />
      {children}
    </div>
  );
}
