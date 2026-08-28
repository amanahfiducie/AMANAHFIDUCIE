import heritageMineurs from "@/assets/heritage-mineurs.png";
import heroImg from "@/assets/hero-office.jpg";
import seal from "@/assets/logo-seal.png";
import justice from "@/assets/services-justice.jpg";
import waqfCroissance from "@/assets/waqf-croissance-xof.png";
import zakatGrains from "@/assets/zakat-grains-mains.png";
import { SectionHeading } from "@/components/site/SectionHeading";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
    ArrowRight,
    Baby,
    BookOpenCheck,
    Briefcase,
    ClipboardCheck,
    Coins,
    FileBarChart,
    FileSearch,
    FileSignature,
    Gavel,
    HeartHandshake,
    Landmark,
    Lock,
    Scale,
    ScanSearch,
    ShieldCheck,
    UsersRound,
} from "lucide-react";

export const Route = createFileRoute("/services")({
  head: () => ({
    meta: [
      { title: "Nos services — Amanah Fiducie" },
      {
        name: "description",
        content:
          "Tous les services AMANAH FIDUCIE : fiducie, mandats, waqf, conseil successoral islamique, zakat, valorisation d’actifs halal et reporting.",
      },
      { property: "og:title", content: "Nos services — Amanah Fiducie" },
      { property: "og:image", content: justice },
    ],
  }),
  component: ServicesPage,
});

const serviceHighlights: {
  category: string;
  title: string;
  desc: string;
  image: string;
  alt: string;
  to: string;
  icon: LucideIcon;
}[] = [
  {
    category: "Service 01",
    title: "Gestion fiduciaire du patrimoine",
    desc: "Protection, administration et valorisation des biens confiés : immobilier, foncier, liquidités, commerce, parts sociales ou autres actifs familiaux.",
    image: justice,
    alt: "Gestion fiduciaire du patrimoine",
    to: "/service-mandat-fiduciaire",
    icon: Briefcase,
  },
  {
    category: "Service 02",
    title: "Sécurisation des héritages des mineurs",
    desc: "Cadre professionnel encadré et conforme à la Charia pour sécuriser les biens des mineurs, organiser leur gestion et préserver leur valeur jusqu'à la transmission.",
    image: heritageMineurs,
    alt: "Sécurisation des héritages des mineurs",
    to: "/service-cantonnement-actifs",
    icon: Baby,
  },
  {
    category: "Service 03",
    title: "Conseil successoral islamique",
    desc: "Accompagnement dans le partage des héritages, le calcul des parts successorales et la transmission conforme aux principes de la Charia.",
    image: heroImg,
    alt: "Conseil successoral islamique",
    to: "/service-conseil-successoral-islamique",
    icon: Scale,
  },
  {
    category: "Service 04",
    title: "Waqf familial & waqf productif",
    desc: "Structuration et administration de waqf pour protéger le capital familial, organiser les revenus et soutenir les bénéficiaires sur plusieurs générations.",
    image: waqfCroissance,
    alt: "Patrimoine en croissance — francs CFA et investissement conforme au waqf",
    to: "/service-waqf-familial",
    icon: Landmark,
  },
  {
    category: "Service 05",
    title: "Zakat & structuration patrimoniale",
    desc: "Évaluation de la zakat et accompagnement des familles, particuliers ou entreprises dans l'organisation conforme de leur patrimoine.",
    image: zakatGrains,
    alt: "Zakat et partage — céréales en mains, symbole de subsistance et de générosité",
    to: "/service-zakat-faraid",
    icon: Coins,
  },
];

const engagements = [
  {
    icon: Lock,
    title: "Comptes séparés",
    desc: "Chaque patrimoine est cantonné dans un compte fiduciaire dédié au bénéficiaire.",
  },
  {
    icon: ScanSearch,
    title: "Traçabilité complète",
    desc: "Toutes les opérations sont documentées et auditables à tout moment.",
  },
  {
    icon: BookOpenCheck,
    title: "Supervision charaïque",
    desc: "Validation indépendante des contrats, placements et décisions de gestion.",
  },
  {
    icon: FileBarChart,
    title: "Reporting régulier",
    desc: "Comptes rendus périodiques aux familles, juges, notaires et autorités.",
  },
];

const audiences = [
  {
    icon: UsersRound,
    title: "Familles & héritiers",
    desc: "Familles disposant d'un patrimoine successoral et représentants légaux.",
  },
  {
    icon: Gavel,
    title: "Juges & juridictions",
    desc: "Tribunaux et juges des tutelles confrontés à des dossiers complexes.",
  },
  {
    icon: FileSignature,
    title: "Notaires & professions juridiques",
    desc: "Notaires en charge de successions et cabinets de conseil.",
  },
  {
    icon: Landmark,
    title: "Institutions & organisations",
    desc: "Waqf familiaux, ONG, fondations et institutions partenaires.",
  },
];

const process = [
  {
    icon: FileSearch,
    title: "Origination & audit",
    desc: "Réception du mandat, vérification de la base légale, inventaire et cartographie des risques.",
  },
  {
    icon: ShieldCheck,
    title: "Cadre & gestion",
    desc: "Comptes cantonnés, plan de gestion, règles d'usage des revenus et placements halal.",
  },
  {
    icon: ClipboardCheck,
    title: "Pilotage & reporting",
    desc: "Suivi budgétaire, double signature, reporting trimestriel, semestriel et annuel.",
  },
  {
    icon: FileSignature,
    title: "Clôture & transmission",
    desc: "Restitution des actifs à la majorité, rapport final certifié, archivage sécurisé.",
  },
];

function ServicesPage() {
  return (
    <SiteLayout>
      {/* HERO */}
      <section className="relative pt-40 pb-24 overflow-hidden">
        <img
          src={justice}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          width={1600}
          height={1100}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/85 to-primary/55" />
        <div className="relative mx-auto max-w-7xl px-5 lg:px-8 grid lg:grid-cols-12 gap-10 items-center text-primary-foreground">
          <div className="lg:col-span-8">
            <span className="inline-flex items-center gap-2 rounded-full bg-gold/15 ring-1 ring-gold/40 px-3 py-1 text-xs uppercase tracking-[0.22em] text-gold mb-5">
              <Briefcase className="size-3.5" />
              Nos services
            </span>
            <h1 className="font-display text-[2.125rem] sm:text-5xl md:text-6xl lg:text-7xl font-semibold leading-[1.08] sm:leading-[1.05] max-w-3xl">
              Une gamme complète au service du{" "}
              <span className="italic font-normal">patrimoine</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-primary-foreground/90">
              AMANAH FIDUCIE accompagne les familles, tuteurs, notaires et institutions dans
              la gestion fiduciaire, le conseil successoral islamique, la structuration de
              waqf, l'évaluation de la zakat et la valorisation responsable d'actifs halal.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="hero" size="lg" className="rounded-full">
                <Link to="/contact">
                  Démarrer un mandat <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="heroOutline" size="lg" className="rounded-full">
                <Link to="/a-propos">À propos d'Amanah Fiducie</Link>
              </Button>
            </div>
          </div>

          <div className="lg:col-span-4 hidden lg:flex justify-end">
            <img
              src={seal}
              alt="Sceau Amanah Fiducie SARL"
              className="w-44 h-44 object-contain drop-shadow-xl"
              width={176}
              height={176}
            />
          </div>
        </div>
      </section>

      {/* Intro liste services */}
      <section className="py-16 lg:py-20 bg-background">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <SectionHeading
            eyebrow="Offre intégrée"
            title="Les services que nous proposons"
            description="Cinq blocs d'expertise pour sécuriser, piloter et valoriser durablement le patrimoine familial."
            align="center"
          />
        </div>
      </section>

      {/* Chaque service : section pleine largeur — vert si texte clair, crème si texte foncé */}
      {serviceHighlights.map((s, i) => {
        const isPrimary = i % 2 === 0;
        const imageRight = i % 2 === 1;

        return (
          <section
            key={s.title}
            className={
              isPrimary
                ? "bg-primary py-16 lg:py-24 text-white paper-grain"
                : "bg-cream py-16 lg:py-24 text-foreground"
            }
            aria-labelledby={`service-heading-${i}`}
          >
            <div className="mx-auto max-w-7xl px-5 lg:px-8">
              <div
                className={`grid lg:grid-cols-2 gap-8 lg:gap-12 items-center ${
                  imageRight ? "lg:[&>div:first-child]:order-2" : ""
                }`}
              >
                <div>
                  <div
                    className={
                      isPrimary
                        ? "overflow-hidden rounded-2xl ring-1 ring-white/15 shadow-card"
                        : "overflow-hidden rounded-2xl ring-1 ring-black/5 shadow-card"
                    }
                  >
                    <img
                      src={s.image}
                      alt={s.alt}
                      loading="lazy"
                      className="w-full aspect-[4/3] object-cover"
                      width={800}
                      height={600}
                    />
                  </div>
                </div>

                <div>
                  <span
                    className={
                      isPrimary
                        ? "inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-gold font-semibold"
                        : "inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-primary font-semibold"
                    }
                  >
                    <s.icon className="size-4 shrink-0 opacity-90" aria-hidden />
                    {s.category}
                  </span>
                  <h3
                    id={`service-heading-${i}`}
                    className={
                      isPrimary
                        ? "mt-3 font-display text-2xl sm:text-3xl lg:text-4xl font-semibold leading-tight text-white text-balance"
                        : "mt-3 font-display text-2xl sm:text-3xl lg:text-4xl font-semibold leading-tight text-foreground text-balance"
                    }
                  >
                    {s.title}
                  </h3>
                  <p
                    className={
                      isPrimary
                        ? "mt-4 text-base text-white/90 leading-relaxed"
                        : "mt-4 text-base text-muted-foreground leading-relaxed"
                    }
                  >
                    {s.desc}
                  </p>
                  <Button
                    asChild
                    variant={isPrimary ? "heroOutline" : "hero"}
                    size="lg"
                    className="mt-7 rounded-full"
                  >
                    <Link to={s.to}>
                      En savoir plus <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </section>
        );
      })}

      {/* AUDIENCES — Pour qui ? */}
      <section className="relative py-24 lg:py-28 overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute -top-32 left-1/2 -translate-x-1/2 size-[640px] rounded-full bg-gold/10 blur-3xl"
        />
        <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <span className="inline-flex items-center gap-2 rounded-full bg-gold/10 ring-1 ring-gold/35 px-3 py-1 text-[10px] sm:text-[11px] uppercase tracking-[0.22em] sm:tracking-[0.28em] text-primary font-semibold mb-5">
              <HeartHandshake className="size-3.5 text-gold" />
              Pour qui ?
            </span>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-semibold leading-[1.12] sm:leading-tight text-foreground text-balance">
              Quatre publics au cœur de notre{" "}
              <span className="text-gold italic font-normal">mission</span>
            </h2>
            <p className="mt-4 sm:mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed">
              Une offre conçue pour les familles, les juridictions, les notaires et les
              institutions partenaires qui recherchent une gestion traçable et une valorisation conforme des biens.
            </p>
          </div>

          <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {audiences.map((a, i) => (
              <article
                key={a.title}
                className="group relative bg-card border border-border rounded-2xl p-6 shadow-card hover:border-gold/50 hover:shadow-elegant hover:-translate-y-1 transition-all duration-300"
              >
                <span className="absolute top-4 right-5 font-display text-3xl text-gold/20 group-hover:text-gold/45 transition-colors leading-none">
                  {String(i + 1).padStart(2, "0")}
                </span>

                <div className="flex items-center justify-center size-12 rounded-xl bg-primary/5 ring-1 ring-gold/20 group-hover:bg-gold group-hover:ring-gold transition-colors mb-5">
                  <a.icon className="size-6 text-primary group-hover:text-gold-foreground transition-colors" />
                </div>

                <h3 className="font-display text-lg font-semibold text-foreground">
                  {a.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {a.desc}
                </p>

                <div className="mt-5 h-px w-10 bg-gold/40 group-hover:w-16 transition-all" />
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* PROCESS */}
      <section className="py-24 lg:py-32 bg-primary text-primary-foreground paper-grain">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <SectionHeading
            eyebrow="Notre méthode"
            title="Quatre étapes simples"
            description="Un parcours fiduciaire clair, traçable, conforme à la Charia et orienté valorisation des actifs."
            align="center"
            invert
          />
          <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {process.map((p, i) => (
              <div
                key={p.title}
                className="relative bg-primary-foreground/5 backdrop-blur border border-primary-foreground/10 rounded-xl p-7 hover:border-gold/40 hover:bg-primary-foreground/8 transition-all"
              >
                <div className="flex items-center justify-between mb-5">
                  <div className="size-12 rounded-lg bg-gold/15 flex items-center justify-center">
                    <p.icon className="size-6 text-gold" />
                  </div>
                  <span className="font-display text-3xl text-gold/40">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="font-display text-xl font-semibold text-primary-foreground">
                  {p.title}
                </h3>
                <p className="mt-3 text-sm text-primary-foreground/75 leading-relaxed">
                  {p.desc}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-14 text-center">
            <Button asChild variant="hero" size="xl" className="rounded-full">
              <Link to="/contact">
                Démarrer un mandat <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ENGAGEMENT — transparence & conformité */}
      <section className="py-20 lg:py-24 bg-cream">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <span className="inline-flex items-center gap-2 rounded-full bg-gold/10 ring-1 ring-gold/35 px-3 py-1 text-[10px] sm:text-[11px] uppercase tracking-[0.22em] sm:tracking-[0.28em] text-primary font-semibold mb-5">
              <ShieldCheck className="size-3.5 text-gold" />
              Notre engagement
            </span>
            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-semibold leading-[1.12] sm:leading-tight text-foreground text-balance">
              Transparence et{" "}
              <span className="text-gold italic font-normal">conformité</span>
            </h2>
            <p className="mt-4 sm:mt-5 text-sm sm:text-base lg:text-lg text-muted-foreground leading-relaxed">
              Chaque mission repose sur des comptes séparés, une traçabilité complète,
              une supervision charaïque et un reporting régulier.
            </p>
          </div>

          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl mx-auto">
            {engagements.map((e) => (
              <div
                key={e.title}
                className="rounded-xl border border-border bg-card p-5 shadow-card hover:border-gold/50 transition-colors"
              >
                <div className="flex items-center justify-center size-10 rounded-lg bg-gold/10 text-gold mb-4">
                  <e.icon className="size-5" />
                </div>
                <h3 className="font-display text-base font-semibold text-foreground">
                  {e.title}
                </h3>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                  {e.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
