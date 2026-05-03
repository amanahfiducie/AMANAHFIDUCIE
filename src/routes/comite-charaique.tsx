import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpenCheck, ClipboardCheck, Scale } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { SectionHeading } from "@/components/site/SectionHeading";
import { Button } from "@/components/ui/button";
import governanceMeeting from "@/assets/governance-meeting.jpg";

export const Route = createFileRoute("/comite-charaique")({
  head: () => ({
    meta: [
      { title: "Comité charaïque — Amanah Fiducie" },
      {
        name: "description",
        content:
          "Comité indépendant : validation des contrats, placements et opérations, audits de conformité charaïque (référence AAOIFI).",
      },
    ],
  }),
  component: ComiteCharaiquePage,
});

function ComiteCharaiquePage() {
  return (
    <SiteLayout>
      <section className="relative pt-36 pb-20 overflow-hidden">
        <img
          src={governanceMeeting}
          alt="Gouvernance et comité charaïque"
          className="absolute inset-0 h-full w-full object-cover"
          width={1600}
          height={1100}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/82 to-primary/45" />
        <div className="relative mx-auto max-w-4xl px-5 lg:px-8 text-primary-foreground">
          <SectionHeading
            eyebrow="Gouvernance"
            title="Comité charaïque"
            description="Un organe indépendant veille à la conformité des contrats, des placements et des décisions de gestion, avec audits annuels."
            invert
          />
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-3xl px-5 lg:px-8 space-y-8">
          <div className="rounded-xl border border-border bg-card p-6 flex gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-gold/25">
              <BookOpenCheck className="size-5" aria-hidden />
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Le comité charaïque examine les opérations sensibles, les choix de placement et les
              évolutions réglementaires pour garantir une pratique alignée sur les principes
              islamiques et les standards de référence (notamment AAOIFI).
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-6 flex gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-gold/25">
              <Scale className="size-5" aria-hidden />
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Il travaille en complément du conseil d’administration et du comité d’audit, sans
              se substituer aux instances juridiques ou aux mandats confiés par les familles et les
              tribunaux.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-6 flex gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-gold/25">
              <ClipboardCheck className="size-5" aria-hidden />
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Les rapports d’audit charaïque contribuent à la transparence vis-à-vis des parties
              prenantes et renforcent la crédibilité du dispositif fiduciaire.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button asChild variant="hero" size="lg" className="rounded-full">
              <Link to="/contact">
                Nous contacter <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-full">
              <Link to="/a-propos">Voir la gouvernance complète</Link>
            </Button>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
