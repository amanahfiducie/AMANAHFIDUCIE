import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, Users, ScanSearch } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { SectionHeading } from "@/components/site/SectionHeading";
import { Button } from "@/components/ui/button";
import governanceMeeting from "@/assets/governance-meeting.jpg";

export const Route = createFileRoute("/service-reporting")({
  head: () => ({
    meta: [
      { title: "Service Reporting — Amanah Fiducie" },
      {
        name: "description",
        content:
          "Reporting periodique et reddition de comptes pour piloter la protection et la valorisation des biens avec les familles, notaires et autres parties prenantes.",
      },
    ],
  }),
  component: ServiceReportingPage,
});

const bullets: { icon: LucideIcon; text: string }[] = [
  {
    icon: BarChart3,
    text: "Suivi periodique des actifs, des revenus et des decisions de valorisation.",
  },
  {
    icon: Users,
    text: "Comptes rendus adaptes au profil des destinataires.",
  },
  {
    icon: ScanSearch,
    text: "Traçabilite et transparence sur tout le cycle du mandat fiduciaire.",
  },
];

function ServiceReportingPage() {
  return (
    <SiteLayout>
      <section className="relative pt-36 pb-24 overflow-hidden">
        <img
          src={governanceMeeting}
          alt="Reporting periodique et pilotage des dossiers"
          className="absolute inset-0 h-full w-full object-cover"
          width={1600}
          height={1100}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/80 to-primary/35" />
        <div className="relative mx-auto max-w-5xl px-5 lg:px-8 text-primary-foreground">
          <SectionHeading
            eyebrow="Service"
            title="Reporting"
            description="Une information reguliere, claire et exploitable pour piloter la performance patrimoniale avec toutes les parties prenantes."
            invert
          />
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-4xl px-5 lg:px-8 grid gap-4">
          {bullets.map(({ icon: Icon, text }) => (
            <div
              key={text}
              className="flex items-start gap-3 rounded-xl border border-border bg-card p-4"
            >
              <Icon className="size-5 shrink-0 text-gold mt-0.5" aria-hidden />
              <p className="text-sm text-foreground/85">{text}</p>
            </div>
          ))}

          <Button asChild variant="hero" size="lg" className="mt-3 w-fit rounded-full">
            <Link to="/contact">
              Demander une demonstration <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>
    </SiteLayout>
  );
}
