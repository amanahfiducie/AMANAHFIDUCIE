import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ShieldCheck,
  Scale,
  FileBarChart,
  Landmark,
  UsersRound,
  BookOpenCheck,
  ClipboardCheck,
  Lock,
} from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { SectionHeading } from "@/components/site/SectionHeading";
import { Button } from "@/components/ui/button";
import impactMosqueeDakar from "@/assets/impact-mosquee-dakar.png";

export const Route = createFileRoute("/impact")({
  head: () => ({
    meta: [
      { title: "Impact & conformité — Amanah Fiducie" },
      {
        name: "description",
        content:
          "Impact social & ESG islamique (BP §9) : ODD 1, 8, 10, 16, maqāṣid, valorisation des biens et fonds waqf social.",
      },
      { property: "og:title", content: "Impact & conformité — Amanah Fiducie" },
      { property: "og:image", content: impactMosqueeDakar },
    ],
  }),
  component: ImpactPage,
});

const impactItems = [
  {
    icon: ShieldCheck,
    title: "Protéger les héritiers vulnérables",
    desc: "Nous sécurisons les patrimoines transmis aux mineurs afin d’éviter la spoliation, la mauvaise gestion ou la dilution des biens familiaux.",
  },
  {
    icon: Landmark,
    title: "Préserver le patrimoine familial",
    desc: "Chaque actif confié est administré avec rigueur pour préserver sa valeur et, lorsque cela est possible, le valoriser de manière licite et prudente.",
  },
  {
    icon: Scale,
    title: "Réduire les conflits successoraux",
    desc: "Grâce à un cadre professionnel, documenté et transparent, nous aidons les familles à prévenir les tensions liées à la gestion des héritages.",
  },
  {
    icon: UsersRound,
    title: "Transmettre dans de meilleures conditions",
    desc: "Notre objectif est que les bénéficiaires reçoivent, au moment venu, un patrimoine identifié, protégé, documenté et valorisé.",
  },
];

const complianceItems = [
  {
    icon: BookOpenCheck,
    title: "Comité charaïque indépendant",
    desc: "Un comité dédié veille à la conformité des opérations et accompagne la validation des produits, contrats et placements.",
  },
  {
    icon: ClipboardCheck,
    title: "Validation préalable des opérations",
    desc: "Les décisions sensibles peuvent faire l’objet d’une analyse juridique et charaïque avant leur mise en œuvre.",
  },
  {
    icon: Lock,
    title: "Exclusion des pratiques non conformes",
    desc: "Les opérations impliquant riba, gharar excessif, spéculation illicite ou activités non conformes sont exclues.",
  },
  {
    icon: FileBarChart,
    title: "Audit charaïque annuel",
    desc: "Un suivi régulier permet d’évaluer la conformité des opérations et de formuler, si nécessaire, des recommandations correctives.",
  },
];

function ImpactPage() {
  return (
    <SiteLayout>
      {/* HERO */}
      <section className="relative pt-32 sm:pt-36 lg:pt-40 pb-20 sm:pb-24 overflow-hidden">
        <img
          src={impactMosqueeDakar}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          width={1600}
          height={1100}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/80 to-primary/30" />
        <div className="relative mx-auto max-w-7xl px-5 lg:px-8 text-primary-foreground">
          <div className="text-xs uppercase tracking-[0.25em] text-gold mb-4">Impact</div>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-7xl font-semibold leading-[1.05] max-w-4xl">
            Impact &amp; conformité islamique
          </h1>
          <p className="mt-5 sm:mt-6 max-w-3xl text-base sm:text-lg text-primary-foreground/90 leading-relaxed">
            Une gestion qui protège, valorise et rend compte.
          </p>
          <p className="mt-4 max-w-3xl text-base text-primary-foreground/80 leading-relaxed">
            AMANAH FIDUCIE place l’impact social et la conformité islamique au cœur de sa mission.
            Notre rôle ne se limite pas à gérer un patrimoine : nous protégeons les intérêts des
            bénéficiaires, préservons les biens confiés et veillons à ce que chaque décision
            respecte les principes de la Charia, du droit et de la transparence.
          </p>
        </div>
      </section>

      {/* IMPACT */}
      <section className="py-16 sm:py-20 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <SectionHeading
            eyebrow="Notre impact"
            title="Protéger, préserver et transmettre"
            description="Notre approche associe protection juridique, gestion rigoureuse et valorisation prudente des actifs familiaux."
            align="center"
          />
          <div className="mt-12 sm:mt-14 grid sm:grid-cols-2 gap-5 sm:gap-6">
            {impactItems.map((p) => (
              <div
                key={p.title}
                className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-card hover:shadow-elegant transition-shadow"
              >
                <div className="size-14 rounded-xl bg-gold/20 ring-1 ring-primary/25 flex items-center justify-center mb-6 shadow-gold">
                  <p.icon className="size-7 text-primary" />
                </div>
                <h3 className="font-display text-2xl font-semibold">{p.title}</h3>
                <p className="mt-4 text-muted-foreground leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONFORMITÉ */}
      <section className="py-16 sm:py-20 lg:py-24 bg-cream">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <SectionHeading
            eyebrow="Conformité islamique"
            title="Une conformité islamique encadrée"
            description="AMANAH FIDUCIE s’appuie sur une gouvernance charaïque structurée afin de garantir que les contrats, les placements et les décisions de gestion respectent les principes de la finance islamique."
            align="center"
          />
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {complianceItems.map((item, idx) => (
              <article
                key={item.title}
                className={`rounded-2xl border border-border bg-card p-6 sm:p-7 shadow-card hover:shadow-elegant transition-shadow ${
                  idx === complianceItems.length - 1 ? "sm:col-span-2 lg:col-span-1" : ""
                }`}
              >
                <div className="flex size-11 items-center justify-center rounded-xl bg-gold/20 text-primary ring-1 ring-primary/25 mb-5">
                  <item.icon className="size-5" aria-hidden />
                </div>
                <h3 className="font-display text-xl font-semibold text-foreground">{item.title}</h3>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-20 lg:py-24 bg-primary text-primary-foreground paper-grain">
        <div className="mx-auto max-w-4xl px-5 lg:px-8 text-center">
          <p className="font-display text-2xl sm:text-3xl lg:text-4xl leading-snug italic text-balance">
            « Une gestion conforme, transparente et orientée vers l’intérêt des bénéficiaires. »
          </p>
          <p className="mt-6 text-sm text-primary-foreground/70 max-w-2xl mx-auto">
            Échangeons sur votre situation pour structurer une gestion patrimoniale sécurisée et
            conforme.
          </p>
          <Button asChild variant="hero" size="xl" className="mt-8 sm:mt-10 w-full sm:w-auto">
            <Link to="/contact">Échanger avec nous</Link>
          </Button>
        </div>
      </section>
    </SiteLayout>
  );
}
