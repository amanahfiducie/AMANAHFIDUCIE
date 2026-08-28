"use client";

import { PortalCaseLayoutFromParams } from "@/components/portal-case-layout";

export default function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  return (
    <PortalCaseLayoutFromParams kind="juge" params={params}>
      {children}
    </PortalCaseLayoutFromParams>
  );
}
