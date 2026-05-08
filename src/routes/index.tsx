import ctaAgriculture from "@/assets/cta-agriculture.png";
import ctaAide from "@/assets/cta-aide.png";
import ctaElevage from "@/assets/cta-elevage.png";
import ctaEntreprise from "@/assets/cta-entreprise.png";
import ctaImmeuble from "@/assets/cta-immeuble.png";
import ctaOr from "@/assets/cta-or.png";
import heritageMineurs from "@/assets/heritage-mineurs.png";
import heroImg from "@/assets/hero-office.jpg";
import seal from "@/assets/logo-seal.png";
import servicesJustice from "@/assets/services-justice.jpg";
import { SectionHeading } from "@/components/site/SectionHeading";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  ClipboardList,
  FileBarChart,
  FileSignature,
  Gift,
  HeartHandshake,
  Landmark,
  Lock,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Amanah Fiducie — La Fiducie Islamique au service du Patrimoine" },
      {
        name: "description",
        content:
          "AMANAH FIDUCIE SARL (SOFIGEPAM) : Société Fiduciaire Islamique de Gestion du Patrimoine des Mineurs — mandats, AUM, gouvernance et valorisation durable des biens selon le business plan.",
      },
      { property: "og:title", content: "Amanah Fiducie — Société Fiduciaire Islamique" },
      {
        property: "og:description",
        content: "Protéger, valoriser et transmettre le patrimoine des générations futures.",
      },
    ],
  }),
  component: HomePage,
});

const stats: {
  value: string;
  suffix: string;
  label: string;
  hint: string;
  icon: LucideIcon;
}[] = [
  {
    value: "1 à 2",
    suffix: " Mds FCFA",
    label: "Actifs sous gestion visés",
    hint: "Phase de lancement",
    icon: Landmark,
  },
  {
    value: "30 à 50",
    suffix: "",
    label: "Mandats fiduciaires",
    hint: "En phase de lancement",
    icon: FileSignature,
  },
  {
    value: "20",
    suffix: " %",
    label: "Des bénéfices",
    hint: "Dédiés au Fonds Waqf Social à maturité",
    icon: Gift,
  },
  {
    value: "+1 000",
    suffix: "",
    label: "Héritiers protégés",
    hint: "Vision à long terme",
    icon: UsersRound,
  },
];

const sloganGame = [
  "Investir avec foi",
  "Gouverner avec justice",
  "Bâtir pour les générations futures",
];

// Photos d'activités utilisées dans la mosaïque CTA (trapèzes), images locales.
const activityPhotos = [
  { src: ctaElevage, alt: "Élevage" },
  { src: ctaAgriculture, alt: "Agriculture" },
  { src: ctaImmeuble, alt: "Immobilier" },
  { src: ctaEntreprise, alt: "Commerce et entreprise" },
  { src: ctaOr, alt: "Or et bijoux" },
  { src: ctaAide, alt: "Réseau professionnel et accompagnement" },
];

function HomePage() {
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % sloganGame.length);
    }, 2200);
    return () => window.clearInterval(interval);
  }, []);

  const activeSlogan = sloganGame[phraseIndex];

  return (
    <SiteLayout>
      {/* HERO */}
      <section className="relative min-h-[100svh] flex items-center overflow-hidden">
        <img
          src={heroImg}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          width={1920}
          height={1280}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/80 to-primary/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-transparent to-transparent" />

        <div className="relative mx-auto max-w-7xl px-5 lg:px-8 pt-32 pb-24 grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-8 text-primary-foreground">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-foreground/10 border border-primary-foreground/20 backdrop-blur-sm mb-6">
              <span className="size-1.5 rounded-full bg-gold animate-pulse" />
              <span className="text-[10px] sm:text-xs uppercase tracking-[0.18em] sm:tracking-[0.22em] text-primary-foreground/90">
                Amanah Fiducie SARL
              </span>
            </div>
            <h1 className="font-display text-[2.125rem] leading-[1.08] sm:text-5xl md:text-6xl lg:text-7xl font-semibold sm:leading-[1.05] text-balance">
              La fiducie islamique
              <span className="block text-gold italic font-normal mt-2">
                au service des héritiers mineurs
              </span>
            </h1>
            <p className="mt-6 sm:mt-7 max-w-2xl text-base sm:text-lg text-primary-foreground/85 leading-relaxed">
              AMANAH FIDUCIE SARL, à travers SOFIGEPAM, protège et valorise le patrimoine des
              mineurs héritiers grâce à une gestion fiduciaire islamique professionnelle, orientée
              performance responsable, transparente et durable.
            </p>
            <div className="mt-6 max-w-3xl">
              <p className="text-lg sm:text-2xl md:text-3xl font-semibold min-h-9 sm:min-h-10 tracking-tight">
                <span key={phraseIndex} className="hero-slogan slogan-cube-word inline-block">
                  {activeSlogan}
                </span>
              </p>
            </div>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild variant="hero" size="xl" className="rounded-full shadow-gold">
                <Link to="/services">
                  Confier un patrimoine <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="heroOutline" size="xl" className="rounded-full">
                <Link to="/contact">Prendre rendez-vous</Link>
              </Button>
            </div>
          </div>

          <div className="lg:col-span-4 hidden lg:flex justify-end">
            <img
              src={seal}
              alt="Sceau Amanah Fiducie SARL — Société fiduciaire islamique"
              className="w-72 h-72 object-contain drop-shadow-2xl animate-[spin_60s_linear_infinite]"
              width={288}
              height={288}
            />
          </div>
        </div>

      </section>

      {/* MISSION */}
      <section className="relative py-24 lg:py-32 overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute -top-32 -left-24 size-72 rounded-full bg-gold/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-32 -right-24 size-80 rounded-full bg-primary/5 blur-3xl"
        />

        <div className="relative mx-auto max-w-7xl px-5 lg:px-8 grid lg:grid-cols-12 gap-12 items-center">
          {/* TEXT */}
          <div className="lg:col-span-6">
            <span className="inline-flex items-center gap-2 rounded-full bg-gold/10 ring-1 ring-gold/35 px-3 py-1 text-[10px] sm:text-[11px] uppercase tracking-[0.18em] sm:tracking-[0.22em] text-primary mb-5">
              <ShieldCheck className="size-3.5 text-gold" />
              Notre mission
            </span>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-semibold leading-[1.12] sm:leading-tight text-foreground text-balance">
              Sécuriser l'héritage des{" "}
              <span className="text-gold italic font-normal">mineurs</span>
            </h2>
            <p className="mt-4 sm:mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl">
              Une approche professionnelle, conforme à la Charia et orientée résultats concrets :
              sécuriser les biens, générer des revenus licites et transmettre un patrimoine valorisé.
            </p>

            <ul className="mt-8 space-y-4">
              {[
                {
                  icon: Lock,
                  title: "Protéger",
                  desc: "Cantonnement, séparation des patrimoines, traçabilité totale.",
                },
                {
                  icon: ClipboardList,
                  title: "Administrer",
                  desc: "Gestion active encadrée par mandat judiciaire, notarial ou familial.",
                },
                {
                  icon: Landmark,
                  title: "Valoriser",
                  desc: "Mise en valeur halal des actifs pour préserver et développer leur potentiel.",
                },
                {
                  icon: FileBarChart,
                  title: "Rendre compte",
                  desc: "Reporting périodique aux familles et aux autorités compétentes.",
                },
              ].map((item) => (
                <li
                  key={item.title}
                  className="flex gap-4 items-start"
                >
                  <div className="flex items-center justify-center size-10 rounded-lg bg-primary/5 ring-1 ring-gold/20 shrink-0">
                    <item.icon className="size-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-display text-sm sm:text-base font-semibold text-foreground">
                      {item.title}
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-10 flex flex-wrap gap-3">
              <Button asChild variant="hero" size="lg" className="rounded-full">
                <Link to="/a-propos">
                  En savoir plus <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="rounded-full border-gold/50 hover:border-gold">
                <Link to="/contact">Prendre rendez-vous</Link>
              </Button>
            </div>
          </div>

          {/* IMAGE */}
          <div className="lg:col-span-6 relative">
            <div
              aria-hidden="true"
              className="absolute -inset-4 bg-gold-gradient/15 rounded-3xl blur-2xl opacity-30"
            />
            <div className="relative overflow-hidden rounded-3xl shadow-elegant ring-1 ring-border">
              <img
                src={heritageMineurs}
                alt="Famille — héritage protégé par Amanah Fiducie"
                loading="lazy"
                width={1600}
                height={1100}
                className="w-full object-cover aspect-[4/3] transition-transform duration-700 hover:scale-[1.03]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/45 via-transparent to-transparent" />

              
            </div>

            {/* Floating chip top-right */}
            <div className="hidden sm:flex absolute -top-3 -right-3 items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-2 shadow-elegant ring-1 ring-gold/40">
              <span className="size-1.5 rounded-full bg-gold animate-pulse" />
              <span className="text-xs font-semibold tracking-wide">SOFIGEPAM · Sénégal</span>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="bg-primary text-primary-foreground py-20 paper-grain">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <SectionHeading
            eyebrow="Chiffres clés"
            title="Une ambition claire, des repères concrets"
            description="Actifs confiés, mandats fiduciaires, waqf social et héritiers protégés : des chiffres pour mesurer notre impact."
            align="center"
            invert
          />
        </div>
        <div className="mx-auto max-w-7xl px-5 lg:px-8 mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {stats.map((s) => (
            <article
              key={`${s.label}-${s.hint}`}
              className="rounded-2xl border border-primary-foreground/15 bg-primary-foreground/5 backdrop-blur-sm p-6 text-center hover:bg-primary-foreground/10 hover:border-gold/40 transition-all"
            >
              <div className="flex justify-center mb-4">
                <span className="flex size-11 items-center justify-center rounded-xl bg-gold/15 ring-1 ring-gold/35">
                  <s.icon className="size-5 text-gold" aria-hidden />
                </span>
              </div>
              <div className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold text-gold leading-none">
                {s.value}
                {s.suffix && (
                  <span className="text-xl sm:text-2xl text-primary-foreground/70 ml-1 align-baseline">
                    {s.suffix}
                  </span>
                )}
              </div>
              <div className="mt-3 text-xs sm:text-sm font-medium text-primary-foreground/95">{s.label}</div>
              <div className="mt-1 text-[10px] sm:text-xs text-primary-foreground/70 max-w-[14rem] mx-auto leading-snug">
                {s.hint}
              </div>
              <div className="mx-auto mt-4 h-px w-16 bg-gold/35" />
            </article>
          ))}
        </div>
        <p className="text-center text-[10px] sm:text-xs text-primary-foreground/60 max-w-xl mx-auto px-5 mt-8 leading-relaxed">
        Des repères prévisionnels pour illustrer notre ambition d’impact et de croissance.
        </p>
      </section>

      {/* SERVICES */}
      <section className="py-20 lg:py-24 bg-cream">
        <div className="mx-auto max-w-7xl px-5 lg:px-8 grid lg:grid-cols-2 gap-12 items-center">
          <div className="relative">
            <div className="absolute -inset-4 bg-gold-gradient/15 rounded-2xl blur-2xl opacity-30" />
            <img
              src={servicesJustice}
              alt="Aperçu de nos services fiduciaires"
              className="relative rounded-2xl shadow-elegant w-full object-cover aspect-[4/3]"
              loading="lazy"
              width={1600}
              height={1100}
            />
          </div>

          <div>
            <SectionHeading
              eyebrow="Nos services"
              title="Des solutions complètes pour sécuriser et transmettre le patrimoine"
              description="SOFIGEPAM accompagne les familles, tuteurs, notaires et institutions : sécurisation, gestion productive halal, waqf, zakat et transmission d’actifs valorisés."
            />
            <div className="mt-8">
              <Button asChild variant="hero" size="xl" className="rounded-full shadow-gold">
                <Link to="/services">
                  Découvrir nos services <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-24 lg:py-32 overflow-hidden bg-primary">
        {/* Trapezoid mosaic background — multiple photos forming a rectangle, separated by `/` */}
        <div aria-hidden="true" className="absolute inset-0 flex gap-0">
          {activityPhotos.map((photo, i) => {
            const isFirst = i === 0;
            const isLast = i === activityPhotos.length - 1;
            const clipPath = isFirst
              ? "polygon(0 0, 100% 0, 85% 100%, 0 100%)"
              : isLast
                ? "polygon(15% 0, 100% 0, 100% 100%, 0 100%)"
                : "polygon(15% 0, 100% 0, 85% 100%, 0 100%)";
            return (
              <div
                key={i}
                className="relative flex-1 min-w-0 overflow-hidden spotlight-active"
                style={{ clipPath, animationDelay: `${i}s` }}
              >
                <img
                  src={photo.src}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </div>
            );
          })}
        </div>

        <div className="relative mx-auto max-w-3xl px-5 lg:px-8 text-center">
          <div className="inline-block rounded-2xl bg-primary/40 backdrop-blur-sm ring-1 ring-gold/40 shadow-elegant px-6 sm:px-10 py-10 sm:py-12">
            <span className="inline-flex items-center gap-2 rounded-full bg-gold/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              <HeartHandshake className="size-3.5" />
              SOFIGEPAM — Sénégal
            </span>
            <h2 className="mt-5 font-display text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-semibold leading-[1.15] sm:leading-tight text-primary-foreground text-balance">
            Tout votre patrimoine, une seule confiance

            </h2>
            <p className="mt-4 text-sm sm:text-base md:text-lg text-primary-foreground/95 leading-relaxed">
            AMANAH FIDUCIE assure une gestion globale du patrimoine familial : protection des
            actifs, valorisation conforme et transparence de bout en bout, quel que soit le type de
            biens confiés.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Button asChild variant="hero" size="xl" className="rounded-full">
                <Link to="/contact">Prendre rendez-vous</Link>
              </Button>
              <Button asChild variant="heroOutline" size="xl" className="rounded-full">
                <Link to="/services">Découvrir nos services</Link>
              </Button>
            </div>
            <p className="mt-5 text-[10px] sm:text-xs text-primary-foreground/75">
            Découvrir l’accompagnement adapté à votre situation

            </p>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
