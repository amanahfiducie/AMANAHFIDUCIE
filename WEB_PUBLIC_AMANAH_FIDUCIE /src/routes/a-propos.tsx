import aboutHero from "@/assets/about-hero.png";
import seal from "@/assets/logo-seal.png";
import { SectionHeading } from "@/components/site/SectionHeading";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
    ArrowRight,
    BadgeCheck,
    BookMarked,
    BookOpenCheck,
    ClipboardCheck,
    ClipboardList,
    FileBarChart,
    FileSpreadsheet,
    Gavel,
    HandHeart,
    Landmark,
    Lock,
    Quote,
    Scale,
    ShieldCheck,
    Users2,
    Vault,
} from "lucide-react";

export const Route = createFileRoute("/a-propos")({
  head: () => ({
    meta: [
      { title: "À propos — Amanah Fiducie SARL" },
      {
        name: "description",
        content:
          "AMANAH FIDUCIE SARL — pionnière de la fiducie islamique au Sénégal. Mission, gouvernance et valeurs au service de la protection et de la valorisation du patrimoine.",
      },
      { property: "og:title", content: "À propos — Amanah Fiducie" },
      { property: "og:image", content: aboutHero },
    ],
  }),
  component: AboutPage,
});

const valeurs: { title: string; desc: string; icon: LucideIcon }[] = [
  {
    title: "Amānah",
    desc: "Gérer les biens confiés comme une responsabilité morale, juridique et spirituelle.",
    icon: HandHeart,
  },
  {
    title: "ʿAdl",
    desc: "Prendre des décisions justes, équilibrées et orientées vers l’intérêt des bénéficiaires.",
    icon: Scale,
  },
  {
    title: "Muḥāsabah",
    desc: "Rendre compte avec transparence aux familles, aux autorités et aux partenaires.",
    icon: ClipboardList,
  },
  {
    title: "Hifẓ al-Māl",
    desc: "Préserver le capital, prévenir la spoliation et assurer une transmission durable.",
    icon: Vault,
  },
];

const piliers = [
  {
    icon: Gavel,
    title: "Cadre juridique",
    desc: "Une gestion encadrée par des mandats judiciaires, notariaux ou familiaux, conformément au droit sénégalais.",
  },
  {
    icon: BookOpenCheck,
    title: "Conformité charaïque",
    desc: "Un comité indépendant veille à la conformité des contrats, placements et décisions de gestion.",
  },
  {
    icon: FileBarChart,
    title: "Reporting transparent",
    desc: "Des rapports réguliers permettent aux familles, tuteurs, juges et notaires de suivre chaque décision et chaque mouvement.",
  },
  {
    icon: Lock,
    title: "Patrimoines cantonnés",
    desc: "Chaque patrimoine est séparé, suivi et tracé afin d’éviter toute confusion entre les biens confiés.",
  },
];

const stats = [
  { k: "1ʳᵉ", v: "Société fiduciaire islamique dédiée aux mineurs au Sénégal" },
  { k: "AAOIFI", v: "Référence de conformité charaïque" },
  { k: "100 %", v: "Des patrimoines cantonnés, suivis et tracés" },
];

function AboutPage() {
  return (
    <SiteLayout>
      {/* HERO */}
      <section className="relative pt-40 pb-24 overflow-hidden">
        <img
          src={aboutHero}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          width={1600}
          height={1100}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/85 to-primary/55" />
        <div className="relative mx-auto max-w-7xl px-5 lg:px-8 grid lg:grid-cols-12 gap-10 items-center text-primary-foreground">
          <div className="lg:col-span-8">
            <span className="inline-flex items-center gap-2 rounded-full bg-gold/15 ring-1 ring-gold/40 px-3 py-1 text-xs uppercase tracking-[0.22em] text-gold mb-5">
              <Landmark className="size-3.5" />
              À propos
            </span>
            <h1 className="font-display text-5xl lg:text-7xl font-semibold leading-[1.05] max-w-3xl">
              La confiance au service du patrimoine
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-primary-foreground/90">
              <span className="font-medium">AMANAH FIDUCIE SARL</span> — pionnière de la fiducie
              islamique au Sénégal. Une triple expertise juridique, financière et charaïque pour
              protéger, valoriser et transmettre le patrimoine avec une vision intergénérationnelle.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="hero" size="lg" className="rounded-full">
                <Link to="/services">
                  Nos services <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="heroOutline" size="lg" className="rounded-full">
                <Link to="/contact">Prendre rendez-vous</Link>
              </Button>
            </div>
          </div>

          <div className="lg:col-span-4 hidden lg:flex justify-end">
            <img
              src={seal}
              alt="Sceau Amanah Fiducie SARL — Société fiduciaire islamique"
              className="w-44 h-44 object-contain drop-shadow-xl"
              width={176}
              height={176}
            />
          </div>
        </div>
      </section>

      {/* MISSION — REDESIGNED */}
      <section className="relative py-24 lg:py-32 overflow-hidden">
        {/* Subtle decorative backdrop */}
        <div
          aria-hidden="true"
          className="absolute -top-32 left-1/2 -translate-x-1/2 size-[640px] rounded-full bg-gold/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute bottom-0 right-0 size-72 rounded-full bg-primary/5 blur-3xl"
        />

        <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
          {/* INTRO — centered */}
          <div className="text-center max-w-3xl mx-auto">
            <span className="inline-flex items-center gap-2 rounded-full bg-gold/10 ring-1 ring-gold/35 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-primary font-semibold mb-5">
              <ShieldCheck className="size-3.5 text-gold" />
              Notre raison d'être
            </span>
            <h2 className="font-display text-4xl lg:text-5xl font-semibold leading-tight text-foreground text-balance">
              Professionnaliser la{" "}
              <span className="text-gold italic font-normal">protection</span> du patrimoine familial
            </h2>
            <p className="mt-5 text-lg text-muted-foreground leading-relaxed">
              La gestion informelle des biens expose souvent les héritiers mineurs à des
              risques de conflits, d’opacité, de mauvaise gestion ou de dilution du
              patrimoine.
            </p>
            <p className="mt-3 text-base text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">AMANAH FIDUCIE</span> apporte
              une réponse professionnelle, encadrée et conforme à la Charia, pour protéger,
              gérer et valoriser les biens confiés dans l’intérêt exclusif des bénéficiaires, avec
              des mécanismes de suivi qui favorisent une croissance patrimoniale saine.
            </p>
          </div>

          {/* PILIERS — 4 cards in a 2x2 grid with numbered design */}
          <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {piliers.map((p, i) => (
              <article
                key={p.title}
                className="group relative bg-card border border-border rounded-2xl p-6 shadow-card hover:border-gold/50 hover:shadow-elegant hover:-translate-y-1 transition-all duration-300"
              >
                {/* Number badge top-right */}
                <span className="absolute top-4 right-5 font-display text-3xl text-gold/20 group-hover:text-gold/45 transition-colors leading-none">
                  {String(i + 1).padStart(2, "0")}
                </span>

                <div className="flex items-center justify-center size-12 rounded-xl bg-primary/5 ring-1 ring-gold/20 group-hover:bg-gold group-hover:ring-gold transition-colors mb-5">
                  <p.icon className="size-6 text-primary group-hover:text-gold-foreground transition-colors" />
                </div>

                <h3 className="font-display text-lg font-semibold text-foreground">
                  {p.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {p.desc}
                </p>

                {/* Bottom accent line */}
                <div className="mt-5 h-px w-10 bg-gold/40 group-hover:w-16 transition-all" />
              </article>
            ))}
          </div>

          {/* TRUST BAR — stats with separators + founder quote */}
          <div className="mt-16 grid lg:grid-cols-12 gap-6 items-stretch">
            {/* Stats card */}
            <div className="lg:col-span-7 bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-card">
              <div className="text-[11px] uppercase tracking-[0.28em] text-gold font-semibold mb-4">
                Chiffres de confiance
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
                {stats.map((s) => (
                  <div
                    key={s.v}
                    className="py-3 sm:py-0 sm:px-4 first:sm:pl-0 last:sm:pr-0"
                  >
                    <div className="font-display text-3xl lg:text-4xl font-semibold text-primary">
                      {s.k}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground leading-snug">
                      {s.v}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Founder quote card (compact) */}
            <div className="lg:col-span-5 bg-primary text-primary-foreground rounded-2xl p-6 sm:p-7 shadow-elegant">
              <Quote className="size-6 text-gold mb-3" />
              <p className="font-display text-base lg:text-lg leading-snug italic text-balance">
                « Protéger le patrimoine des générations futures, c'est honorer
                la amanah qui nous est confiée. »
              </p>
              <div className="mt-5 flex items-center gap-3 pt-5 border-t border-primary-foreground/15">
                <img
                  src={seal}
                  alt=""
                  className="size-10 object-contain"
                  width={40}
                  height={40}
                />
                <div>
                  <div className="font-medium text-sm">Abdoulaye Lam</div>
                  <div className="text-[10px] text-primary-foreground/70 uppercase tracking-wider">
                    Fondateur — Global Islamic Finance &amp; Transactions
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* DEDICATED VERSE SECTION — same style as home stats section */}
      <section className="bg-primary text-primary-foreground py-20 paper-grain">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <SectionHeading
            eyebrow="Verset coranique"
            title="L'origine de notre engagement"
            description="Sourate An-Nisāʾ · 4 : 6 — un fondement spirituel à notre mission fiduciaire."
            align="center"
            invert
          />
        </div>

        <div className="mx-auto max-w-3xl px-5 lg:px-8 mt-12">
          <div className="relative">
            {/* Top ornament */}
            <div className="flex items-center justify-center gap-3 mb-5">
              <span aria-hidden="true" className="block h-px w-12 bg-gold/55" />
              <span aria-hidden="true" className="size-1.5 rotate-45 bg-gold shadow-gold" />
              <span aria-hidden="true" className="block h-px w-12 bg-gold/55" />
            </div>

            <p className="font-display text-xl sm:text-2xl lg:text-3xl leading-[1.5] italic text-balance text-center text-primary-foreground">
              « Éprouvez les orphelins jusqu’à ce qu’ils atteignent l’âge du
              mariage ; si vous constatez en eux une bonne capacité,
              remettez-leur alors leurs biens. »
            </p>

            {/* Arabesque divider */}
            <div className="my-9 flex items-center justify-center gap-2">
              <span aria-hidden="true" className="block h-px flex-1 bg-gradient-to-r from-transparent via-gold/45 to-transparent" />
              <span aria-hidden="true" className="size-1 rotate-45 bg-gold/70" />
              <span aria-hidden="true" className="size-1.5 rotate-45 bg-gold" />
              <span aria-hidden="true" className="size-1 rotate-45 bg-gold/70" />
              <span aria-hidden="true" className="block h-px flex-1 bg-gradient-to-l from-transparent via-gold/45 to-transparent" />
            </div>

            {/* Attribution */}
            <div className="flex flex-col items-center gap-2.5">
              <div className="size-16 rounded-full bg-gold-gradient ring-[3px] ring-primary-foreground/30 flex items-center justify-center shadow-gold">
                <span className="font-display text-gold-foreground text-3xl font-semibold leading-none">
                  ﷲ
                </span>
              </div>
              <div className="font-display text-base font-medium text-primary-foreground">
                Le Saint Coran
              </div>
              <div className="text-[11px] text-gold uppercase tracking-[0.3em]">
                Sourate An-Nisāʾ · 4 : 6
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* VALEURS */}
      <section className="py-20 lg:py-24 bg-cream">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <SectionHeading
            eyebrow="Nos valeurs"
            title="Une gouvernance inspirée par l’éthique islamique"
            description="Quatre principes structurent notre action et orientent chaque décision de gestion."
            align="center"
          />
          <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {valeurs.map((v, i) => (
              <div
                key={v.title}
                className="bg-card border border-border rounded-xl p-7 shadow-card text-center hover:border-gold/50 hover:-translate-y-1 transition-all"
              >
                <div className="flex justify-center mb-4">
                  <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/8 ring-1 ring-gold/25">
                    <v.icon className="size-7 text-primary" aria-hidden />
                  </span>
                </div>
                <div className="font-display text-5xl text-gold/30 leading-none mb-3">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <h3 className="font-display text-xl font-semibold">{v.title}</h3>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* GOVERNANCE — REDESIGNED */}
      <section className="relative py-24 lg:py-32 overflow-hidden">
        {/* Subtle decorative backdrop */}
        <div
          aria-hidden="true"
          className="absolute -top-32 right-1/3 size-[420px] rounded-full bg-gold/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-40 left-0 size-72 rounded-full bg-primary/5 blur-3xl"
        />

        <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
          {/* INTRO — centered */}
          <div className="text-center max-w-3xl mx-auto">
            <span className="inline-flex items-center gap-2 rounded-full bg-gold/10 ring-1 ring-gold/35 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-primary font-semibold mb-5">
              <Landmark className="size-3.5 text-gold" />
              Gouvernance
            </span>
            <h2 className="font-display text-4xl lg:text-5xl font-semibold leading-tight text-foreground text-balance">
              Une structure pensée pour la{" "}
              <span className="text-gold italic font-normal">confiance</span>
            </h2>
            <p className="mt-5 text-lg text-muted-foreground leading-relaxed">
              AMANAH FIDUCIE repose sur une gouvernance claire, indépendante et contrôlée,
              associant expertise juridique, conformité charaïque, audit financier et
              contrôle interne.
            </p>
          </div>

          {/* GOVERNANCE BODIES — 3 cards numbered */}
          {(() => {
            const gouvernance = [
              {
                icon: Users2,
                title: "Conseil d'administration",
                desc: "Supervision stratégique, pilotage institutionnel et contrôle de la performance.",
              },
              {
                icon: BookMarked,
                title: "Comité charaïque",
                desc: "Validation des contrats, placements et opérations, avec audit annuel de conformité.",
              },
              {
                icon: ClipboardCheck,
                title: "Comité d'audit & conformité",
                desc: "Contrôle interne, gestion des risques, traçabilité et dispositifs de conformité.",
              },
            ];
            return (
              <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {gouvernance.map((g, i) => (
                  <article
                    key={g.title}
                    className="group relative bg-card border border-border rounded-2xl p-6 shadow-card hover:border-gold/50 hover:shadow-elegant hover:-translate-y-1 transition-all duration-300"
                  >
                    <span className="absolute top-4 right-5 font-display text-3xl text-gold/20 group-hover:text-gold/45 transition-colors leading-none">
                      {String(i + 1).padStart(2, "0")}
                    </span>

                    <div className="flex items-center justify-center size-12 rounded-xl bg-primary/5 ring-1 ring-gold/20 group-hover:bg-gold group-hover:ring-gold transition-colors mb-5">
                      <g.icon className="size-6 text-primary group-hover:text-gold-foreground transition-colors" />
                    </div>

                    <h3 className="font-display text-lg font-semibold text-foreground">
                      {g.title}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                      {g.desc}
                    </p>

                    <div className="mt-5 h-px w-10 bg-gold/40 group-hover:w-16 transition-all" />
                  </article>
                ))}
              </div>
            );
          })()}

          {/* AUDITS BAR */}
          <div className="mt-12 max-w-4xl mx-auto">
            <div className="text-center text-[11px] uppercase tracking-[0.28em] text-gold font-semibold mb-4">
              Audits annuels
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                {
                  icon: FileSpreadsheet,
                  title: "Audit financier indépendant",
                  desc: "Certification par un commissaire aux comptes externe.",
                },
                {
                  icon: BadgeCheck,
                  title: "Audit charaïque public",
                  desc: "Rapport public garantissant transparence et crédibilité.",
                },
              ].map((a) => (
                <div
                  key={a.title}
                  className="flex items-start gap-3 rounded-xl border border-gold/30 bg-gold/5 p-4"
                >
                  <div className="flex items-center justify-center size-9 rounded-lg bg-gold/15 text-gold shrink-0">
                    <a.icon className="size-4" />
                  </div>
                  <div>
                    <div className="font-display text-sm font-semibold text-foreground">
                      {a.title}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                      {a.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

    </SiteLayout>
  );
}
