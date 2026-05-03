import { createFileRoute, Link } from "@tanstack/react-router";
import { Shield, HeartHandshake, Infinity, Quote } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { SectionHeading } from "@/components/site/SectionHeading";
import { Button } from "@/components/ui/button";
import family from "@/assets/impact-family.jpg";

export const Route = createFileRoute("/impact")({
  head: () => ({
    meta: [
      { title: "Impact & conformité — Amanah Fiducie" },
      {
        name: "description",
        content:
          "Impact social & ESG islamique (BP §9) : ODD 1, 8, 10, 16, maqāṣid, indicateurs et fonds waqf social.",
      },
      { property: "og:title", content: "Impact & conformité — Amanah Fiducie" },
      { property: "og:image", content: family },
    ],
  }),
  component: ImpactPage,
});

const piliers = [
  {
    icon: Shield,
    title: "Résultats directs",
    desc: "Patrimoines protégés et valorisés, revenus réguliers au profit des mineurs, réduction des conflits successoraux (BP §9.1).",
  },
  {
    icon: HeartHandshake,
    title: "Impact durable",
    desc: "Autonomisation économique des héritiers, préservation du capital familial, stabilité sociale et économique.",
  },
  {
    icon: Infinity,
    title: "Non externalité",
    desc: "La logique d’impact est intégrée au modèle économique — pas traitée comme une simple communication.",
  },
];

const indicators = [
  { v: "4", l: "ODD ciblés : 1, 8, 10, 16 (BP §9.2.a)" },
  { v: "5+", l: "Maqāṣid mobilisées : hifẓ al-māl, al-nafs, al-nasl, ‘adl, amānah (BP §9.2.b)" },
  { v: "Annuel", l: "Rapport d’impact et rapport charaïque publics visés (BP §9.5)" },
  { v: "FW", l: "Fonds waqf social : dotations, gouvernance cantonnée, reporting distinct (BP §9.4)" },
];

function ImpactPage() {
  return (
    <SiteLayout>
      {/* HERO */}
      <section className="relative pt-40 pb-24 overflow-hidden">
        <img
          src={family}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          width={1600}
          height={1100}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/80 to-primary/30" />
        <div className="relative mx-auto max-w-7xl px-5 lg:px-8 text-primary-foreground">
          <div className="text-xs uppercase tracking-[0.25em] text-gold mb-4">Impact</div>
          <h1 className="font-display text-5xl lg:text-7xl font-semibold leading-[1.05] max-w-4xl">
            Impact &amp; conformité islamique
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-primary-foreground/85">
            Approche ESG islamique : maqāṣid al-sharīʿa et ODD pour cadrer protection des
            vulnérables et préservation intergénérationnelle du patrimoine (BP §9).
          </p>
        </div>
      </section>

      {/* MAQASID */}
      <section className="py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <SectionHeading
            eyebrow="Chaîne d’impact (BP §9.1)"
            title="Du problème social aux effets de long terme"
            description="Mauvaise gestion des successions → intervention SOFIGEPAM (gestion halal, reporting, supervision) → résultats mesurables puis contribution sociétale."
            align="center"
          />
          <div className="mt-14 grid md:grid-cols-3 gap-6">
            {piliers.map((p) => (
              <div
                key={p.title}
                className="bg-card border border-border rounded-2xl p-8 shadow-card hover:shadow-elegant transition-shadow"
              >
                <div className="size-14 rounded-xl bg-gold-gradient flex items-center justify-center mb-6 shadow-gold">
                  <p.icon className="size-7 text-gold-foreground" />
                </div>
                <h3 className="font-display text-2xl font-semibold">{p.title}</h3>
                <p className="mt-4 text-muted-foreground leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* INDICATEURS */}
      <section className="py-20 bg-cream">
        <div className="mx-auto max-w-7xl px-5 lg:px-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-8 text-center">
          {indicators.map((i) => (
            <div key={i.l} className="border-l-2 border-gold pl-5 text-left">
              <div className="font-display text-5xl text-primary font-semibold">{i.v}</div>
              <div className="mt-2 text-sm text-muted-foreground">{i.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* QUOTE */}
      <section className="py-24 bg-primary text-primary-foreground paper-grain">
        <div className="mx-auto max-w-4xl px-5 lg:px-8 text-center">
          <Quote className="size-10 text-gold mx-auto mb-6" />
          <p className="font-display text-3xl lg:text-4xl leading-snug italic text-balance">
            « SOFIGEPAM : investir avec foi, gouverner avec justice, bâtir pour les générations
            futures. »
          </p>
          <p className="mt-6 text-sm text-primary-foreground/70 max-w-2xl mx-auto">
            Formule de clôture du business plan — ambition éthique et institutionnelle du projet.
          </p>
          <Button asChild variant="hero" size="xl" className="mt-10">
            <Link to="/contact">Échanger avec nous</Link>
          </Button>
        </div>
      </section>
    </SiteLayout>
  );
}
