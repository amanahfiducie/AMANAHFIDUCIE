import waqfHero from "@/assets/waqf-croissance-xof.png";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
    ArrowRight,
    BarChart3,
    BookOpenCheck,
    Briefcase,
    Building2,
    ClipboardList,
    Coins,
    FileBarChart,
    FileSearch,
    FileSignature,
    FileStack,
    FileText,
    HeartHandshake,
    IdCard,
    Landmark,
    Layers,
    ListChecks,
    PackageSearch,
    ScrollText,
    Shield,
    TrendingUp,
    UsersRound,
    Workflow,
} from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export const Route = createFileRoute("/service-waqf-familial")({
  head: () => ({
    meta: [
      { title: "Waqf familial & waqf productif — Amanah Fiducie" },
      {
        name: "description",
        content:
          "Structuration, mise en place et administration de waqf familiaux ou productifs : protection du capital, valorisation d'actifs productifs, organisation des revenus et conformité charaïque.",
      },
    ],
  }),
  component: ServiceWaqfFamilialProductifPage,
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
    icon: Landmark,
    title: "Familles souhaitant protéger un patrimoine",
    detail:
      "Pour éviter la dispersion des biens, préserver un héritage familial et organiser les revenus au profit des descendants.",
  },
  {
    icon: HeartHandshake,
    title: "Parents souhaitant anticiper leur succession",
    detail:
      "Pour structurer une partie du patrimoine avant le décès et réduire les risques de conflits futurs.",
  },
  {
    icon: Briefcase,
    title: "Entrepreneurs et propriétaires d’actifs productifs",
    detail:
      "Qui souhaitent affecter un bien immobilier, agricole, commercial ou financier à une finalité durable.",
  },
  {
    icon: Building2,
    title: "Institutions religieuses, sociales ou éducatives",
    detail:
      "Qui souhaitent mettre en place un waqf pour financer une mission : éducation, santé, orphelins, solidarité ou développement communautaire.",
  },
  {
    icon: FileSignature,
    title: "Notaires, familles et conseils successoraux",
    detail:
      "Dans les situations où un patrimoine doit être protégé, organisé et transmis dans un cadre clair.",
  },
];

const missions: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: Layers,
    title: "La structuration du waqf",
    desc: "Définition du bien concerné, de l’objectif, des bénéficiaires et des règles de gestion.",
  },
  {
    icon: Shield,
    title: "La protection du capital",
    desc: "Le bien affecté au waqf est organisé pour être préservé dans la durée et éviter la vente, la dilution ou la dispersion.",
  },
  {
    icon: Coins,
    title: "L’administration des revenus",
    desc: "Les revenus générés peuvent être destinés aux descendants, à des bénéficiaires définis ou à une cause sociale.",
  },
  {
    icon: BookOpenCheck,
    title: "La conformité charaïque",
    desc: "Les contrats, règles de distribution et modalités de gestion sont analysés pour rester conformes aux principes islamiques.",
  },
  {
    icon: FileBarChart,
    title: "Le suivi et la reddition de comptes",
    desc: "Reporting, traçabilité, suivi des revenus et transparence envers les parties concernées.",
  },
];

const etapes: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: FileSearch,
    title: "Étude de l’intention du waqf",
    desc: "Nous clarifions l’objectif : protection familiale, transmission, solidarité, éducation, soutien aux orphelins ou valorisation d’un actif productif.",
  },
  {
    icon: Landmark,
    title: "Identification du bien à affecter",
    desc: "Le bien peut être immobilier, foncier, agricole, commercial, financier ou tout autre actif pouvant générer ou préserver de la valeur.",
  },
  {
    icon: BookOpenCheck,
    title: "Analyse juridique et charaïque",
    desc: "Nous vérifions que le bien, l’objectif, les bénéficiaires et les règles envisagées peuvent être structurés dans un cadre conforme.",
  },
  {
    icon: UsersRound,
    title: "Définition des bénéficiaires",
    desc: "Les bénéficiaires sont identifiés : descendants, enfants, héritiers, orphelins, institution, communauté ou cause spécifique.",
  },
  {
    icon: ClipboardList,
    title: "Rédaction du cadre de gestion",
    desc: "Les règles sont formalisées : administration du bien, utilisation des revenus, responsabilités, durée, contrôle et reporting.",
  },
  {
    icon: Briefcase,
    title: "Mise en place de l’administration du waqf",
    desc: "AMANAH FIDUCIE peut intervenir comme administrateur délégué, gestionnaire des revenus ou accompagnateur du dispositif.",
  },
  {
    icon: BarChart3,
    title: "Suivi, reporting et impact",
    desc: "Les revenus, dépenses, décisions et résultats sont suivis afin de garantir une gestion transparente et durable.",
  },
];

const prerequis: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: PackageSearch,
    title: "Un bien ou un capital clairement identifié",
    desc: "Le patrimoine à affecter au waqf doit être connu, documenté et juridiquement vérifiable.",
  },
  {
    icon: ScrollText,
    title: "Une intention claire",
    desc: "Il faut définir pourquoi le waqf est créé : protéger la famille, soutenir les descendants, financer une œuvre sociale ou préserver un actif.",
  },
  {
    icon: UsersRound,
    title: "Des bénéficiaires déterminés",
    desc: "Les personnes ou causes bénéficiaires doivent être identifiées de manière précise.",
  },
  {
    icon: TrendingUp,
    title: "Une volonté de gestion durable",
    desc: "Le waqf suppose une vision de long terme, avec des règles stables et une administration rigoureuse.",
  },
  {
    icon: BookOpenCheck,
    title: "Une acceptation du cadre charaïque",
    desc: "Les placements, revenus et usages doivent respecter les principes de conformité islamique.",
  },
];

const documents: {
  icon: LucideIcon;
  title: string;
  items: string[];
}[] = [
  {
    icon: IdCard,
    title: "Documents d’identification",
    items: [
      "Pièce d’identité du constituant, coordonnées des parties concernées, justificatif de capacité ou de représentation si nécessaire.",
    ],
  },
  {
    icon: Building2,
    title: "Documents patrimoniaux",
    items: [
      "Titre foncier, acte de propriété, bail, contrat commercial, documents agricoles, documents financiers ou tout justificatif relatif au bien concerné.",
    ],
  },
  {
    icon: BarChart3,
    title: "Documents d’évaluation",
    items: [
      "Estimation de valeur, revenus générés, charges, état locatif, situation fiscale ou financière du bien.",
    ],
  },
  {
    icon: UsersRound,
    title: "Documents familiaux ou bénéficiaires",
    items: [
      "Liste des bénéficiaires, liens de parenté, actes d’état civil si le waqf est familial.",
    ],
  },
  {
    icon: FileText,
    title: "Documents juridiques",
    items: [
      "Actes notariés existants, statuts, mandat, décision familiale, projet de règlement du waqf ou tout document déjà préparé.",
    ],
  },
  {
    icon: ScrollText,
    title: "Documents de finalité",
    items: [
      "Note d’intention, objectifs du waqf, règles souhaitées de distribution des revenus, durée et conditions particulières.",
    ],
  },
];

function readHashSection(): SectionId {
  if (typeof window === "undefined") return "public";
  const raw = window.location.hash.replace(/^#/, "");
  return isSectionId(raw) ? raw : "public";
}

function ServiceWaqfFamilialProductifPage() {
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
          src={waqfHero}
          alt="Patrimoine en croissance — francs CFA et investissement conforme au waqf"
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
              Service 04
            </p>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold leading-[1.08] text-balance max-w-4xl">
            {"Waqf familial & waqf productif"}
          </h1>
          <p className="mt-6 text-xl sm:text-2xl lg:text-[1.65rem] font-display font-medium text-white/95 leading-snug text-balance max-w-3xl border-l-[3px] border-gold/70 pl-5 sm:pl-6">
            Préserver le capital, valoriser les actifs productifs et protéger les générations
          </p>
          <p className="mt-8 max-w-3xl text-base sm:text-lg text-primary-foreground/90 leading-relaxed">
            Le waqf permet d’affecter un bien ou un capital à une finalité durable : le patrimoine
            est protégé, les revenus sont organisés et les bénéficiaires sont accompagnés sur le
            long terme, avec une stratégie de valorisation qui renforce la résilience familiale.
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
                  {prerequis.map((pr, i) => {
                    const PrIcon = pr.icon;
                    return (
                      <div
                        key={pr.title}
                        className={cn(
                          "group relative rounded-2xl border border-border/80 bg-gradient-to-b from-cream/90 to-cream/50 p-6 pt-9 ring-1 ring-gold/15 shadow-card transition-all duration-300 hover:border-primary/25 hover:shadow-elegant",
                          i === prerequis.length - 1 && "sm:col-span-2 sm:max-w-4xl sm:mx-auto",
                        )}
                      >
                        <span className="absolute right-5 top-4 font-display text-4xl leading-none text-gold/20 transition-colors group-hover:text-gold/35">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <div className="flex items-start gap-3 pr-10">
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
                      Liste indicative selon le dossier&nbsp;:
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
                Un conseiller peut vous accompagner dans la structuration d’un waqf familial ou
                productif et la liste des pièces adaptées à votre dossier.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 shrink-0">
                <Button asChild variant="hero" size="lg" className="rounded-full shadow-elegant">
                  <Link to="/contact">
                    Parler de votre projet <ArrowRight className="size-4" />
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
