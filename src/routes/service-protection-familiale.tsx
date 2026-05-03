import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Shield, HeartHandshake, UsersRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { SectionHeading } from "@/components/site/SectionHeading";
import { Button } from "@/components/ui/button";
import heritageMineurs from "@/assets/heritage-mineurs.png";

export const Route = createFileRoute("/service-protection-familiale")({
  head: () => ({
    meta: [
      { title: "Service Protection familiale — Amanah Fiducie" },
      {
        name: "description",
        content:
          "Protection familiale et accompagnement patrimonial pour securiser les interets des heritiers mineurs.",
      },
    ],
  }),
  component: ServiceProtectionFamilialePage,
});

const bullets: { icon: LucideIcon; text: string }[] = [
  {
    icon: Shield,
    text: "Protection des actifs contre les risques de dilution et de conflit.",
  },
  {
    icon: HeartHandshake,
    text: "Gestion orientee vers les besoins reels des beneficiaires.",
  },
  {
    icon: UsersRound,
    text: "Coordination continue avec les representants familiaux.",
  },
];

function ServiceProtectionFamilialePage() {
  return (
    <SiteLayout>
      <section className="relative pt-36 pb-24 overflow-hidden">
        <img
          src={heritageMineurs}
          alt="Protection familiale du patrimoine des mineurs"
          className="absolute inset-0 h-full w-full object-cover"
          width={1600}
          height={1100}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/80 to-primary/35" />
        <div className="relative mx-auto max-w-5xl px-5 lg:px-8 text-primary-foreground">
          <SectionHeading
            eyebrow="Service"
            title="Protection familiale"
            description="Une organisation de confiance pour proteger l'interet des mineurs et soutenir les familles."
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
              Organiser un echange <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>
    </SiteLayout>
  );
}
