import heroOffice from "@/assets/hero-office.jpg";
import { SectionHeading } from "@/components/site/SectionHeading";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, BookOpenCheck, Route as RouteLine, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/service-conformite-charaique")({
  head: () => ({
    meta: [
      { title: "Service Conformite charaique — Amanah Fiducie" },
      {
        name: "description",
        content:
          "Conformite charaique avec supervision, controles et transparence sur les operations fiduciaires et les strategies de valorisation des biens.",
      },
    ],
  }),
  component: ServiceConformiteCharaiquePage,
});

const bullets: { icon: LucideIcon; text: string }[] = [
  {
    icon: BookOpenCheck,
    text: "Verification des choix de gestion, des placements et des leviers de valorisation licites.",
  },
  {
    icon: ShieldCheck,
    text: "Cadre de controle avec avis et recommandations.",
  },
  {
    icon: RouteLine,
    text: "Trajectoire de conformite continue dans le temps.",
  },
];

function ServiceConformiteCharaiquePage() {
  return (
    <SiteLayout>
      <section className="relative pt-36 pb-24 overflow-hidden">
        <img
          src={heroOffice}
          alt="Conformite charaique et rigueur fiduciaire"
          className="absolute inset-0 h-full w-full object-cover"
          width={1600}
          height={1100}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/80 to-primary/40" />
        <div className="relative mx-auto max-w-5xl px-5 lg:px-8 text-primary-foreground">
          <SectionHeading
            eyebrow="Service"
            title="Conformite charaique"
            description="Supervision des operations et alignement methodologique pour une fiducie responsable, performante et conforme."
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
            <Link to="/comite-charaique">
              Voir la gouvernance charaique <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>
    </SiteLayout>
  );
}
