import zakatHero from "@/assets/zakat-grains-mains.png";
import { SectionHeading } from "@/components/site/SectionHeading";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Coins, Scale, ScrollText } from "lucide-react";

export const Route = createFileRoute("/service-zakat-faraid")({
  head: () => ({
    meta: [
      { title: "Service Zakat et Fara'id — Amanah Fiducie" },
      {
        name: "description",
        content:
          "Evaluation de la zakat et calcul des parts successorales islamiques (fara'id).",
      },
    ],
  }),
  component: ServiceZakatFaraidPage,
});

const bullets: { icon: LucideIcon; text: string }[] = [
  {
    icon: Coins,
    text: "Evaluation zakat pour personnes physiques et morales.",
  },
  {
    icon: Scale,
    text: "Calcul des parts successorales selon les regles retenues.",
  },
  {
    icon: ScrollText,
    text: "Restitution claire pour faciliter la decision familiale.",
  },
];

function ServiceZakatFaraidPage() {
  return (
    <SiteLayout>
      <section className="relative pt-36 pb-24 overflow-hidden">
        <img
          src={zakatHero}
          alt="Récolte et subsistance — référence à la zakat et au partage des provisions"
          className="absolute inset-0 h-full w-full object-cover"
          width={1600}
          height={1100}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/80 to-primary/35" />
        <div className="relative mx-auto max-w-5xl px-5 lg:px-8 text-primary-foreground">
          <SectionHeading
            eyebrow="Service"
            title="Zakat et fara'id"
            description="Evaluation de la zakat et partage successoral islamique dans un cadre methodique."
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
              Demander une evaluation <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>
    </SiteLayout>
  );
}
