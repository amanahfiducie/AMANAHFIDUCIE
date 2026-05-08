import zakatHero from "@/assets/zakat-grains-mains.png";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
    ArrowRight,
    Briefcase,
    Building2,
    ClipboardList,
    Coins,
    FileBarChart,
    FileSearch,
    FileStack,
    FileText,
    Gem,
    HandCoins,
    IdCard,
    Layers,
    ListChecks,
    Receipt,
    ScrollText,
    Shield,
    TrendingUp,
    UsersRound,
    Wallet,
    Workflow
} from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export const Route = createFileRoute("/service-zakat-faraid")({
  head: () => ({
    meta: [
      { title: "Zakat & structuration patrimoniale — Amanah Fiducie" },
      {
        name: "description",
        content:
          "Evaluation de la zakat et structuration patrimoniale avec une approche claire, conforme et orientée valorisation saine des actifs.",
      },
    ],
  }),
  component: ServiceZakatFaraidPage,
});

const SECTION_IDS = ["public", "missions", "processus", "prerequis", "documents"] as const;
type SectionId = (typeof SECTION_IDS)[number];

function isSectionId(value: string): value is SectionId {
  return SECTION_IDS.includes(value as SectionId);
}

const toc: { id: SectionId; label: string; icon: LucideIcon }[] = [
  { id: "public", label: "À qui s’adresse ce service ?", icon: UsersRound },
  { id: "missions", label: "Ce que nous faisons", icon: Briefcase },
  { id: "processus", label: "Comment ça se passe ?", icon: Workflow },
  { id: "prerequis", label: "Prérequis", icon: ListChecks },
  { id: "documents", label: "Documents à prévoir", icon: FileStack },
];

const publics = [
  {
    icon: Wallet,
    title: "Particuliers disposant d’un patrimoine",
    detail: "Liquidités, épargne, or, biens commerciaux, investissements ou actifs à évaluer.",
  },
  {
    icon: UsersRound,
    title: "Familles souhaitant organiser leurs biens",
    detail:
      "Pour clarifier leur situation patrimoniale, anticiper la transmission et mieux structurer leurs obligations.",
  },
  {
    icon: Briefcase,
    title: "Commerçants et entrepreneurs",
    detail:
      "Qui doivent évaluer leur stock, leurs créances, leurs dettes et leurs actifs professionnels.",
  },
  {
    icon: Building2,
    title: "Entreprises familiales",
    detail:
      "Qui souhaitent établir un audit zakat plus structuré, notamment sur les actifs commerciaux, financiers ou productifs.",
  },
  {
    icon: Layers,
    title: "Détenteurs de patrimoine complexe",
    detail:
      "Immobilier, parts sociales, commerce, agriculture, élevage, or, liquidités ou actifs divers.",
  },
];

const missions: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: FileSearch,
    title: "L’identification des biens concernés",
    desc: "Analyse des liquidités, stocks, marchandises, créances, dettes, or, actifs financiers et biens productifs.",
  },
  {
    icon: Coins,
    title: "L’évaluation de la zakat",
    desc: "Calcul structuré à partir des informations fournies, selon une méthodologie claire et conforme.",
  },
  {
    icon: Layers,
    title: "L’organisation patrimoniale",
    desc: "Aide à mieux distinguer les biens personnels, familiaux, professionnels et successoraux pour orienter une valorisation adaptée à chaque catégorie d'actifs.",
  },
  {
    icon: ScrollText,
    title: "La clarification des obligations",
    desc: "Explication des éléments pris en compte, des exclusions éventuelles et des points à valider.",
  },
  {
    icon: TrendingUp,
    title: "La structuration à long terme",
    desc: "Recommandations pour mieux organiser le patrimoine : transmission, waqf, gestion fiduciaire ou conseil successoral si nécessaire.",
  },
];

const etapes: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: UsersRound,
    title: "Analyse de la situation",
    desc: "Nous échangeons sur la nature du patrimoine : personnel, familial, commercial, professionnel ou mixte.",
  },
  {
    icon: ClipboardList,
    title: "Collecte des informations",
    desc: "Les actifs, revenus, dettes, créances, stocks, liquidités et biens concernés sont recensés.",
  },
  {
    icon: Layers,
    title: "Classification des biens",
    desc: "Chaque élément est distingué selon sa nature : liquidités, or, commerce, immobilier, parts sociales, créances ou dettes.",
  },
  {
    icon: Gem,
    title: "Évaluation patrimoniale",
    desc: "Les biens concernés sont évalués afin d’obtenir une base claire pour le calcul.",
  },
  {
    icon: HandCoins,
    title: "Calcul de la zakat",
    desc: "AMANAH FIDUCIE établit une estimation structurée de la zakat due, selon les principes applicables.",
  },
  {
    icon: FileBarChart,
    title: "Remise d’un rapport clair",
    desc: "Le client reçoit une synthèse comprenant les éléments analysés, la base retenue, le calcul effectué et les recommandations.",
  },
  {
    icon: Shield,
    title: "Recommandations de structuration",
    desc: "Si nécessaire, des pistes sont proposées pour mieux organiser le patrimoine : succession, waqf, gestion fiduciaire ou séparation des actifs.",
  },
];

const prerequis: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: ListChecks,
    title: "Disposer d’une vision minimale du patrimoine",
    desc: "Même approximative, la liste des biens, liquidités, dettes et actifs doit être identifiable.",
  },
  {
    icon: FileText,
    title: "Être prêt à fournir les informations financières nécessaires",
    desc: "Le calcul dépend de la qualité des données transmises.",
  },
  {
    icon: Layers,
    title: "Distinguer patrimoine personnel et professionnel",
    desc: "Surtout pour les commerçants, entrepreneurs et entreprises familiales.",
  },
  {
    icon: ScrollText,
    title: "Accepter une approche documentée",
    desc: "L’objectif est d’éviter l’approximation et de produire une évaluation claire, traçable et justifiée.",
  },
];

const documents: { icon: LucideIcon; title: string; items: string[] }[] = [
  {
    icon: IdCard,
    title: "Pour les particuliers et familles",
    items: [
      "Pièce d’identité, relevés bancaires, montant de l’épargne, or détenu, créances, dettes, biens générant des revenus.",
    ],
  },
  {
    icon: Briefcase,
    title: "Pour les commerçants",
    items: [
      "État du stock, valeur des marchandises, créances clients, dettes fournisseurs, trésorerie, charges en cours.",
    ],
  },
  {
    icon: Building2,
    title: "Pour les entreprises",
    items: [
      "États financiers, bilan, compte de résultat, inventaire des stocks, trésorerie, créances, dettes, actifs financiers.",
    ],
  },
  {
    icon: Layers,
    title: "Pour les patrimoines complexes",
    items: [
      "Documents immobiliers, parts sociales, contrats, titres de propriété, revenus locatifs, investissements, biens agricoles ou productifs.",
    ],
  },
  {
    icon: Receipt,
    title: "Documents complémentaires",
    items: [
      "Toute information utile sur les donations, transmissions prévues, waqf envisagé ou organisation familiale du patrimoine.",
    ],
  },
];

function readHashSection(): SectionId {
  if (typeof window === "undefined") return "public";
  const raw = window.location.hash.replace(/^#/, "");
  return isSectionId(raw) ? raw : "public";
}

function ServiceZakatFaraidPage() {
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
          src={zakatHero}
          alt="Récolte et subsistance — référence à la zakat et au partage des provisions"
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
              Service 05
            </p>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold leading-[1.08] text-balance max-w-4xl">
            Zakat & structuration patrimoniale
          </h1>
          <p className="mt-6 text-xl sm:text-2xl lg:text-[1.65rem] font-display font-medium text-white/95 leading-snug text-balance max-w-3xl border-l-[3px] border-gold/70 pl-5 sm:pl-6">
            Évaluer la zakat, organiser et valoriser le patrimoine en conformité
          </p>
          <p className="mt-8 max-w-3xl text-base sm:text-lg text-primary-foreground/90 leading-relaxed">
            La zakat nécessite une identification claire des biens, des liquidités, des actifs
            commerciaux, de l’or, des créances et des dettes, pour permettre une décision patrimoniale plus juste et plus performante dans le temps.
          </p>
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
                      "inline-flex items-center justify-center gap-2 rounded-full border px-3 py-2.5 text-center text-xs sm:text-sm font-medium transition-all duration-200 max-sm:flex-1 max-sm:min-w-[min(100%,9.5rem)]",
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
                    AMANAH FIDUCIE accompagne dans&nbsp;:
                  </p>
                </header>
                <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:gap-6">
                  {missions.map((m, i) => {
                    const MissionIcon = m.icon;
                    return (
                      <div
                        key={m.title}
                        className={cn(
                          "group relative rounded-2xl border border-border/80 bg-gradient-to-b from-cream/90 to-cream/50 p-6 pt-9 ring-1 ring-gold/15 shadow-card transition-all duration-300 hover:border-primary/25 hover:shadow-elegant",
                          i === missions.length - 1 && "sm:col-span-2 sm:max-w-4xl sm:mx-auto",
                        )}
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

            {section === "prerequis" && (
              <article className="relative overflow-hidden rounded-3xl border border-border/70 bg-card p-6 sm:p-8 lg:p-11 shadow-elegant ring-1 ring-gold/12">
                <header className="border-l-[3px] border-gold pl-5 sm:pl-7">
                  <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-semibold text-foreground tracking-tight">
                    Prérequis
                  </h2>
                  <p className="mt-4 max-w-3xl text-base text-muted-foreground leading-relaxed">
                    Avant d’engager la mission, il faut généralement&nbsp;:
                  </p>
                </header>
                <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:gap-6">
                  {prerequis.map((pr) => {
                    const PrIcon = pr.icon;
                    return (
                      <div
                        key={pr.title}
                        className="group relative rounded-2xl border border-border/80 bg-gradient-to-b from-cream/90 to-cream/50 p-6 ring-1 ring-gold/15 shadow-card transition-all duration-300 hover:border-primary/25 hover:shadow-elegant"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-gold/25">
                            <PrIcon className="size-5" aria-hidden />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-display text-lg font-semibold text-foreground leading-snug">
                              {pr.title}
                            </h3>
                            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                              {pr.desc}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
                      Liste indicative selon le profil&nbsp;:
                    </p>
                  </div>
                </header>
                <div className="relative mt-10 grid gap-4 sm:grid-cols-2 lg:gap-5">
                  {documents.map((d, i) => {
                    const DocIcon = d.icon;
                    return (
                      <div
                        key={d.title}
                        className={cn(
                          "rounded-2xl border border-primary-foreground/15 bg-primary-foreground/[0.07] p-5 backdrop-blur-[2px] transition-colors hover:bg-primary-foreground/[0.1]",
                          i === documents.length - 1 && "sm:col-span-2 sm:max-w-4xl sm:mx-auto",
                        )}
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
                Un conseiller peut vous aider à cadrer l’évaluation de la zakat et organiser votre
                patrimoine selon votre profil.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 shrink-0">
                <Button asChild variant="hero" size="lg" className="rounded-full shadow-elegant">
                  <Link to="/contact">
                    Demander une évaluation <ArrowRight className="size-4" />
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
