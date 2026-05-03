import { createFileRoute, Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Baby,
  Briefcase,
  Building2,
  ClipboardList,
  FileBarChart,
  FileSignature,
  FileSearch,
  FileStack,
  FileText,
  Gavel,
  HeartHandshake,
  IdCard,
  KeyRound,
  Layers,
  PackageSearch,
  Receipt,
  Scale,
  Shield,
  TrendingUp,
  Workflow,
} from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import heritageMineurs from "@/assets/heritage-mineurs.png";

export const Route = createFileRoute("/service-cantonnement-actifs")({
  head: () => ({
    meta: [
      { title: "Sécurisation des héritages des mineurs — Amanah Fiducie" },
      {
        name: "description",
        content:
          "Cadre professionnel encadré et conforme à la Charia pour sécuriser les biens des mineurs, organiser leur gestion et préserver leur valeur jusqu'à la transmission.",
      },
    ],
  }),
  component: ServiceSecurisationHeritagesMineursPage,
});

const SECTION_IDS = ["public", "missions", "processus", "documents"] as const;
type SectionId = (typeof SECTION_IDS)[number];

function isSectionId(value: string): value is SectionId {
  return SECTION_IDS.includes(value as SectionId);
}

const toc: { id: SectionId; label: string; icon: LucideIcon }[] = [
  { id: "public", label: "À qui s’adresse ce service ?", icon: Baby },
  { id: "missions", label: "Ce que nous faisons", icon: Briefcase },
  { id: "processus", label: "Comment ça se passe ?", icon: Workflow },
  { id: "documents", label: "Documents à prévoir", icon: FileStack },
];

const publics = [
  {
    icon: Baby,
    title: "Familles concernées par une succession avec enfants mineurs",
    detail:
      "Lorsqu’un parent décède en laissant des biens à des enfants qui ne peuvent pas encore les gérer eux-mêmes.",
  },
  {
    icon: HeartHandshake,
    title: "Tuteurs et représentants légaux",
    detail:
      "Qui souhaitent être accompagnés dans la gestion rigoureuse des biens appartenant à un mineur.",
  },
  {
    icon: Scale,
    title: "Veuves, héritiers et ayants droit",
    detail:
      "Qui veulent éviter les conflits, clarifier la gestion des biens et protéger l’intérêt des enfants.",
  },
  {
    icon: Gavel,
    title: "Juges des tutelles et juridictions",
    detail:
      "Lorsqu’un patrimoine nécessite un gestionnaire professionnel, traçable et capable de rendre compte.",
  },
  {
    icon: FileSignature,
    title: "Notaires et professionnels du droit",
    detail:
      "Dans les successions sensibles, complexes ou impliquant plusieurs héritiers, dont des mineurs.",
  },
];

const missions: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: PackageSearch,
    title: "Sécuriser les biens hérités",
    desc: "Identification, inventaire et protection des biens transmis aux mineurs.",
  },
  {
    icon: Scale,
    title: "Prévenir les conflits successoraux",
    desc: "Mise en place d’un cadre clair pour éviter les décisions arbitraires, la confusion des rôles ou les tensions familiales.",
  },
  {
    icon: HeartHandshake,
    title: "Administrer les actifs dans l’intérêt du mineur",
    desc: "Les revenus peuvent être affectés aux besoins essentiels : éducation, santé, entretien et accompagnement du bénéficiaire.",
  },
  {
    icon: TrendingUp,
    title: "Préserver et valoriser le patrimoine",
    desc: "Les biens sont suivis, entretenus et orientés vers des usages licites et productifs lorsque cela est possible.",
  },
  {
    icon: FileBarChart,
    title: "Rendre compte avec transparence",
    desc: "Rapports réguliers aux familles, tuteurs, juges, notaires ou autorités concernées.",
  },
];

const etapes: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: FileSearch,
    title: "Étude de la situation successorale",
    desc: "Nous analysons la succession, les héritiers concernés, la présence de mineurs, la nature des biens et les risques éventuels.",
  },
  {
    icon: Gavel,
    title: "Vérification du cadre légal",
    desc: "La mission est encadrée par un jugement, un acte notarié, un mandat familial ou tout document autorisant l’intervention.",
  },
  {
    icon: ClipboardList,
    title: "Inventaire des biens hérités",
    desc: "Les actifs sont recensés : immobilier, terrains, comptes bancaires, liquidités, parts sociales, commerce, or ou autres biens familiaux.",
  },
  {
    icon: Layers,
    title: "Mise en place du cadre de protection",
    desc: "Des règles de gestion sont définies : séparation des biens, suivi des revenus, affectation des dépenses, responsabilités des parties.",
  },
  {
    icon: Briefcase,
    title: "Gestion et sécurisation des revenus",
    desc: "Les revenus générés par les biens peuvent être utilisés pour les besoins du mineur, tout en préservant le capital.",
  },
  {
    icon: FileBarChart,
    title: "Reporting régulier",
    desc: "Un suivi clair est transmis aux parties concernées afin de garantir transparence, traçabilité et reddition de comptes.",
  },
  {
    icon: KeyRound,
    title: "Restitution ou transmission finale",
    desc: "À la majorité du bénéficiaire ou à la fin du mandat, les biens sont restitués avec un rapport final de gestion.",
  },
];

const documents: {
  icon: LucideIcon;
  title: string;
  items: string[];
}[] = [
  {
    icon: IdCard,
    title: "Documents d’état civil",
    items: [
      "Acte de décès, actes de naissance des mineurs, pièce d’identité du tuteur ou représentant légal, livret de famille ou document équivalent.",
    ],
  },
  {
    icon: FileText,
    title: "Documents successoraux",
    items: [
      "Certificat d’hérédité, acte de notoriété, jugement de tutelle, décision judiciaire, acte notarié ou document de partage existant.",
    ],
  },
  {
    icon: Building2,
    title: "Documents patrimoniaux",
    items: [
      "Titres fonciers, actes de propriété, baux, documents immobiliers, relevés bancaires, documents relatifs aux parts sociales, commerces ou activités familiales.",
    ],
  },
  {
    icon: Receipt,
    title: "Documents financiers",
    items: [
      "Revenus locatifs, dettes éventuelles, charges liées aux biens, taxes, dépenses déjà engagées pour les bénéficiaires.",
    ],
  },
  {
    icon: Shield,
    title: "Documents de mandat",
    items: [
      "Mandat familial, mandat notarial, décision judiciaire ou tout document autorisant AMANAH FIDUCIE à intervenir.",
    ],
  },
];

function readHashSection(): SectionId {
  if (typeof window === "undefined") return "public";
  const raw = window.location.hash.replace(/^#/, "");
  return isSectionId(raw) ? raw : "public";
}

function ServiceSecurisationHeritagesMineursPage() {
  const panelRef = useRef<HTMLDivElement>(null);
  const [section, setSection] = useState<SectionId>("public");

  const selectSection = useCallback((id: SectionId) => {
    setSection(id);
    window.history.replaceState(null, "", `#${id}`);
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  useLayoutEffect(() => {
    setSection(readHashSection());
  }, []);

  useEffect(() => {
    const onHashChange = () => setSection(readHashSection());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const navSectionTone = (id: SectionId) =>
    section === id
      ? "bg-primary text-primary-foreground border-primary shadow-elegant ring-1 ring-gold/35"
      : "border-border/80 bg-card/90 text-foreground/90 hover:border-primary/45 hover:bg-primary/8 hover:text-foreground shadow-sm";

  return (
    <SiteLayout>
      <section className="relative pt-36 pb-24 lg:pb-28 overflow-hidden">
        <img
          src={heritageMineurs}
          alt="Sécurisation des héritages des mineurs"
          className="absolute inset-0 h-full w-full object-cover scale-105"
          width={1600}
          height={1100}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/78 to-primary/42" />
        <div
          className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none"
          aria-hidden
        />
        <div className="relative mx-auto w-full max-w-7xl px-5 lg:px-8 xl:px-10 text-primary-foreground">
          <div className="flex items-center gap-3 mb-5">
            <span className="h-px w-12 bg-gradient-to-r from-gold/90 to-gold/30" aria-hidden />
            <p className="text-[11px] uppercase tracking-[0.28em] text-gold font-semibold">
              Service
            </p>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold leading-[1.08] text-balance max-w-4xl">
            Sécurisation des héritages des mineurs
          </h1>
          <p className="mt-6 text-xl sm:text-2xl lg:text-[1.65rem] font-display font-medium text-white/95 leading-snug text-balance max-w-3xl border-l-[3px] border-gold/70 pl-5 sm:pl-6">
            Protéger les biens des enfants héritiers jusqu’à leur transmission
          </p>
          <div className="mt-8 grid gap-5 lg:gap-6 lg:grid-cols-2 lg:items-start max-w-6xl">
            <p className="text-base sm:text-lg text-primary-foreground/90 leading-relaxed">
              Lorsqu’une succession implique des enfants mineurs, les biens transmis peuvent être
              exposés à des conflits familiaux, à une mauvaise gestion, à la spoliation ou à la
              dilution du patrimoine.
            </p>
            <p className="text-base text-primary-foreground/85 leading-relaxed rounded-xl bg-primary-foreground/5 border border-primary-foreground/10 px-5 py-4 backdrop-blur-sm">
              AMANAH FIDUCIE met en place un cadre professionnel, encadré et conforme à la Charia
              pour sécuriser les biens des mineurs, organiser leur gestion et préserver leur valeur
              jusqu’à leur restitution ou transmission.
            </p>
          </div>
        </div>
      </section>

      <nav
        aria-label="Sections du service"
        className="sticky top-20 z-40 sm:top-24 lg:top-28 border-b border-gold/15 bg-gradient-to-b from-cream/90 via-background to-background backdrop-blur-md supports-[backdrop-filter]:bg-background/90 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.08)]"
      >
        <div className="mx-auto w-full max-w-7xl px-5 lg:px-8 xl:px-10 py-4">
          <p className="sr-only">
            Choisissez une rubrique pour afficher le contenu correspondant.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-semibold shrink-0 text-center sm:text-left">
              Rubriques
            </p>
            <div className="flex flex-1 flex-wrap justify-center sm:justify-end gap-2 sm:gap-2.5">
              {toc.map((item) => {
                const NavIcon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectSection(item.id)}
                    aria-current={section === item.id ? "page" : undefined}
                    className={cn(
                      "inline-flex items-center justify-center gap-2 rounded-full border px-3.5 py-2.5 text-center text-xs sm:text-sm font-medium transition-all duration-200 max-sm:flex-1 max-sm:min-w-[min(100%,11rem)]",
                      navSectionTone(item.id),
                    )}
                  >
                    <NavIcon
                      className={cn(
                        "size-3.5 shrink-0 sm:size-4",
                        section === item.id ? "text-gold" : "text-primary/65",
                      )}
                      aria-hidden
                    />
                    <span className="leading-snug">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </nav>

      <div
        ref={panelRef}
        className="py-12 lg:py-20 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--muted)_55%,transparent)_0%,var(--background)_18rem)] scroll-mt-24"
      >
        <div className="mx-auto w-full max-w-7xl px-5 lg:px-8 xl:px-10">
          <div
            key={section}
            role="region"
            aria-live="polite"
            aria-label={toc.find((t) => t.id === section)?.label ?? "Contenu"}
            className="min-w-0 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300"
          >
            {section === "public" && (
              <article className="relative overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-card via-card to-cream/35 p-6 sm:p-8 lg:p-11 shadow-elegant ring-1 ring-gold/15">
                <div
                  className="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full bg-primary/[0.07] blur-3xl"
                  aria-hidden
                />
                <header className="relative border-l-[3px] border-gold pl-5 sm:pl-7">
                  <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-semibold text-foreground tracking-tight">
                    À qui s’adresse ce service ?
                  </h2>
                  <p className="mt-3 text-base text-muted-foreground leading-relaxed max-w-3xl">
                    Ce service s’adresse aux&nbsp;:
                  </p>
                </header>
                <ul className="relative mt-10 grid gap-4 sm:grid-cols-2 lg:gap-5">
                  {publics.map((p, idx) => (
                    <li
                      key={p.title}
                      className={cn(
                        "group flex gap-4 rounded-2xl border border-border/65 bg-background/95 p-5 sm:p-6 shadow-card transition-all duration-300 hover:border-primary/30 hover:shadow-elegant hover:-translate-y-0.5",
                        idx === publics.length - 1 && "sm:col-span-2 sm:max-w-4xl sm:mx-auto",
                      )}
                    >
                      <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/12 to-primary/5 text-primary ring-1 ring-gold/30 shadow-sm transition-transform duration-300 group-hover:scale-105">
                        <p.icon className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-display text-lg sm:text-xl font-semibold text-foreground leading-snug">
                          {p.title}
                        </h3>
                        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                          {p.detail}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </article>
            )}

            {section === "missions" && (
              <article className="relative overflow-hidden rounded-3xl border border-border/70 bg-card p-6 sm:p-8 lg:p-11 shadow-elegant ring-1 ring-gold/12">
                <header className="border-l-[3px] border-gold pl-5 sm:pl-7">
                  <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-semibold text-foreground tracking-tight">
                    Ce que nous faisons
                  </h2>
                  <p className="mt-4 max-w-3xl text-base text-muted-foreground leading-relaxed">
                    AMANAH FIDUCIE intervient pour&nbsp;:
                  </p>
                </header>
                <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:gap-6">
                  {missions.map((m, i) => {
                    const MissionIcon = m.icon;
                    return (
                      <div
                        key={m.title}
                        className="group relative rounded-2xl border border-border/80 bg-gradient-to-b from-cream/90 to-cream/50 p-6 pt-9 ring-1 ring-gold/15 shadow-card transition-all duration-300 hover:border-primary/25 hover:shadow-elegant"
                      >
                        <span className="absolute right-5 top-4 font-display text-4xl leading-none text-gold/20 transition-colors group-hover:text-gold/35">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <div className="flex items-start gap-3 pr-10">
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-gold/25">
                            <MissionIcon className="size-5" aria-hidden />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-display text-lg font-semibold text-foreground leading-snug">
                              {m.title}
                            </h3>
                            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                              {m.desc}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            )}

            {section === "processus" && (
              <article className="relative overflow-hidden rounded-3xl border border-border/70 bg-card p-6 sm:p-8 lg:p-11 shadow-elegant ring-1 ring-gold/12">
                <header className="border-l-[3px] border-gold pl-5 sm:pl-7">
                  <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-semibold text-foreground tracking-tight">
                    Comment ça se passe ?
                  </h2>
                </header>
                <div className="relative mt-12">
                  <div
                    className="absolute left-[22px] top-4 bottom-10 hidden w-1 rounded-full bg-gradient-to-b from-gold/70 via-primary/50 to-gold/60 sm:block pointer-events-none"
                    aria-hidden
                  />
                  <ol className="relative space-y-0">
                    {etapes.map((e, i) => (
                      <li
                        key={e.title}
                        className="relative grid gap-3 pb-12 pl-0 sm:grid-cols-[auto_1fr] sm:gap-8 sm:pb-14 last:pb-0 sm:[&>div:first-child]:pt-1"
                      >
                        <div className="flex justify-center sm:block sm:w-[52px] shrink-0">
                          <span className="relative z-[1] flex size-11 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/85 text-primary-foreground font-display text-sm font-semibold shadow-lg ring-4 ring-card">
                            {i + 1}
                          </span>
                        </div>
                        <div
                          className={cn(
                            "min-w-0 pb-12 sm:pb-14",
                            i < etapes.length - 1 && "border-b border-border/40",
                          )}
                        >
                          <h3 className="font-display text-lg sm:text-xl font-semibold text-foreground flex items-start gap-3">
                            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-gold/20">
                              <e.icon className="size-4" aria-hidden />
                            </span>
                            <span>{e.title}</span>
                          </h3>
                          <p className="mt-2 text-sm sm:text-base text-muted-foreground leading-relaxed max-w-3xl">
                            {e.desc}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </article>
            )}

            {section === "documents" && (
              <article className="relative overflow-hidden rounded-3xl border border-gold/25 bg-primary text-primary-foreground p-6 sm:p-8 lg:p-11 shadow-elegant paper-grain ring-1 ring-gold/30">
                <div
                  className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.04] to-transparent"
                  aria-hidden
                />
                <header className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
                  <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gold/15 ring-1 ring-gold/40">
                    <FileStack className="size-7 text-gold" />
                  </div>
                  <div>
                    <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-semibold">
                      Documents à prévoir
                    </h2>
                    <p className="mt-2 text-sm sm:text-base text-primary-foreground/85">
                      Liste indicative selon la situation&nbsp;:
                    </p>
                  </div>
                </header>
                <div className="relative mt-10 grid gap-4 sm:grid-cols-2 lg:gap-5">
                  {documents.map((d) => {
                    const DocIcon = d.icon;
                    return (
                      <div
                        key={d.title}
                        className="rounded-2xl border border-primary-foreground/15 bg-primary-foreground/[0.07] p-5 backdrop-blur-[2px] transition-colors hover:bg-primary-foreground/[0.1]"
                      >
                        <div className="flex gap-4">
                          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold ring-1 ring-gold/30">
                            <DocIcon className="size-5" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-display text-base font-semibold text-gold">
                              {d.title}
                            </h3>
                            <ul className="mt-3 space-y-2">
                              {d.items.map((line) => (
                                <li
                                  key={line}
                                  className="flex gap-2 text-sm text-primary-foreground/88 leading-relaxed"
                                >
                                  <span className="text-gold shrink-0 mt-1">•</span>
                                  <span>{line}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            )}
          </div>

          <div className="mt-12 rounded-3xl border border-gold/25 bg-gradient-to-br from-cream/95 via-cream/80 to-background p-8 lg:p-10 shadow-card ring-1 ring-gold/15">
            <div className="flex flex-col items-center justify-between gap-6 text-center sm:flex-row sm:text-left">
              <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
                Un conseiller peut vous aider à sécuriser la succession et à préparer la liste des
                pièces selon votre situation.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 shrink-0">
                <Button asChild variant="hero" size="lg" className="rounded-full shadow-elegant">
                  <Link to="/contact">
                    Parler de votre dossier <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="rounded-full border-primary/30">
                  <Link to="/services">Tous nos services</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
