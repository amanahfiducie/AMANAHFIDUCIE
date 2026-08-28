import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import partnerGift from "@/assets/partners/gift-consulting.png";
import partnerFszZakat from "@/assets/partners/fsz-zakat.png";
import partnerFszZakatWaqf from "@/assets/partners/fsz-zakat-waqf.png";
import partnerMfb from "@/assets/partners/ministere-finances-budget.png";
import partnerTaysir from "@/assets/partners/taysir-finance.png";
import partnerWaqf from "@/assets/partners/haute-autorite-waqf.png";
import partnerBis from "@/assets/partners/banque-islamique-du-senegal.png";

/** Textes alignés sur les informations publiques (sites institutionnels, presse) ; GIFT = porteur de projet, non traité comme partenaire externe. */
const partners = [
  {
    id: "gift",
    src: partnerGift,
    alt: "GIFT Consulting Group — porteur du projet SOFIGEPAM",
    title: "GIFT Consulting Group",
    subtitle: "Porteur du projet SOFIGEPAM",
    description:
      "GIFT Consulting Group assure le portage méthodologique et la structuration « Global Islamic Finance & Transactions » du dispositif auprès d’AMANAH FIDUCIE : cadrage des offres, alignement charia et accompagnement en gouvernance du programme.",
    isLead: true,
  },
  {
    id: "fsz-zakat",
    src: partnerFszZakat,
    alt: "Fonds sénégalais pour la Zakât",
    title: "Fonds sénégalais pour la Zakât",
    description:
      "Structure nationale créée en 2009 pour la collecte, l’administration et la redistribution de la zakât au profit des ayants droit ; actions de solidarité (Ramadan, Tabaski), secours et financements sociaux conformes à la charia (réf. senegalzakat.sn).",
  },
  {
    id: "fsz-zakat-waqf",
    src: partnerFszZakatWaqf,
    alt: "Fonds sénégalais pour la Zakât et le Waqf",
    title: "FSZ — Zakât & le Waqf",
    description:
      "Périmètre institutionnel élargi au waqf et aux dons volontaires : développement des ressources et usages licites pour des programmes d’impact, infrastructures sociales et gouvernance transparente au service des populations (site public du FSZ).",
  },
  {
    id: "mfb",
    src: partnerMfb,
    alt: "Ministère des Finances et du Budget — Sénégal",
    title: "Ministère des Finances et du Budget",
    description:
      "Pilotage de la politique économique, budgétaire et financière de l’État, encadrement du secteur financier et préparation de la législation monétaire ; représentation du Sénégal auprès du FMI, de la Banque mondiale, de la BAD et de la BID (finances.gouv.sn).",
  },
  {
    id: "taysir",
    src: partnerTaysir,
    alt: "Taysir Finance",
    title: "Taysir Finance",
    description:
      "Institution de microfinance islamique au Sénégal : financement des PME, des entrepreneurs et des ménages selon la charia (sans riba), avec un appui souverain notable du FONSIS pour l’accès au crédit productif (lancement d’activités 2021–2022, presse spécialisée).",
  },
  {
    id: "haute-autorite-waqf",
    src: partnerWaqf,
    alt: "Haute Autorité du Waqf",
    title: "Haute Autorité du Waqf",
    description:
      "Référentiel national sur le waqf : encadrement, transparence et mise en cohérence des biens dédiés au bien public ou familial, en articulation avec les mandats fiduciaires et la conformité islamique des patrimoines confiés.",
  },
  {
    id: "bis",
    src: partnerBis,
    alt: "Banque Islamique du Sénégal",
    title: "Banque Islamique du Sénégal (BIS)",
    description:
      "Banque sénégalaise opérant depuis 1983 selon les principes de la finance islamique (interdiction du riba, adossement à l’actif réel, comité de conformité) ; offre de financements participatifs et d’épargne pour les ménages et les entreprises (bis-bank.com).",
  },
] as const;

/** Durée d’affichage de chaque partenaire (texte + face du cube). */
export const PARTNER_DISPLAY_MS = 6000;

/** Durée de la transition 3D entre deux faces. */
const CUBE_TRANSITION_MS = 900;

const faceCount = partners.length;
const faceStepDeg = 360 / faceCount;

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const onChange = () => setReduce(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduce;
}

export function PartnerMarquee() {
  const reduceMotion = usePrefersReducedMotion();
  /** Compteur monotone : même pas angulaire à chaque tick pour que la boucle 7→1 continue dans le sens du cercle (pas de « retour » visuel). */
  const [step, setStep] = useState(0);
  const [intervalKey, setIntervalKey] = useState(0);
  const displaySeconds = useMemo(() => PARTNER_DISPLAY_MS / 1000, []);

  const active = step % faceCount;

  useEffect(() => {
    if (reduceMotion) return;
    const id = window.setInterval(() => {
      setStep((s) => s + 1);
    }, PARTNER_DISPLAY_MS);
    return () => window.clearInterval(id);
  }, [reduceMotion, intervalKey]);

  const current = partners[active];

  if (reduceMotion) {
    return (
      <div className="border-t border-primary/10 bg-cream py-8 sm:py-10 text-foreground">
        <div className="mx-auto max-w-7xl px-4 sm:px-5 lg:px-8">
          <p className="text-[10px] sm:text-xs font-medium uppercase tracking-[0.22em] text-gold mb-6">
            Partenaires &amp; institutions
          </p>
          <p className="mb-6 text-[11px] sm:text-xs text-muted-foreground tabular-nums">
            Défilement automatique : {displaySeconds} s par visage (désactivé si vous réduisez les animations).
          </p>
          <div className="grid gap-8 sm:grid-cols-2">
            <div className="min-w-0 space-y-4">
              {partners.map((p) => (
                <div key={p.id} className="border-b border-border pb-4 last:border-0 last:pb-0">
                  <h3 className="font-display text-lg font-semibold text-primary">
                    {p.title}
                    {"subtitle" in p && p.subtitle ? (
                      <span className="block text-sm font-normal text-gold mt-0.5">{p.subtitle}</span>
                    ) : null}
                  </h3>
                  <p className="mt-2 text-sm text-foreground/80 leading-relaxed">{p.description}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {partners.map((p) => (
                <div
                  key={p.id}
                  className="flex aspect-square items-center justify-center rounded-xl border border-border bg-muted/25 p-3"
                >
                  <img
                    src={p.src}
                    alt={p.alt}
                    className="max-h-full max-w-full object-contain"
                    width={200}
                    height={200}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-primary/10 bg-cream py-8 sm:py-10 text-foreground">
      <div className="mx-auto max-w-7xl px-4 sm:px-5 lg:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between md:gap-10 lg:gap-14">
          <div className="min-w-0 md:max-w-xl md:flex-1">
            <p className="text-[10px] sm:text-xs font-medium uppercase tracking-[0.22em] text-gold mb-3 sm:mb-4">
              Partenaires &amp; institutions
            </p>
            <div
              key={active}
              className="partner-text-swap"
              style={
                {
                  ["--partner-text-tx-dur"]: `${CUBE_TRANSITION_MS}ms`,
                } as CSSProperties
              }
              aria-live="polite"
              aria-atomic="true"
            >
              <h3 className="partner-text-swap__title font-display text-xl sm:text-2xl lg:text-3xl font-semibold text-primary leading-snug text-balance">
                {current.title}
                {"subtitle" in current && current.subtitle ? (
                  <span className="partner-text-swap__subtitle block text-sm sm:text-base font-normal text-gold mt-1.5 tracking-normal">
                    {current.subtitle}
                  </span>
                ) : null}
              </h3>
              <p className="partner-text-swap__desc mt-3 sm:mt-4 text-sm sm:text-base text-foreground/80 leading-relaxed">
                {current.description}
              </p>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2" role="tablist" aria-label="Partenaires et porteur de projet">
              {partners.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={i === active}
                  aria-label={
                    "isLead" in p && p.isLead
                      ? `Afficher GIFT, porteur du projet (${i + 1} sur ${faceCount})`
                      : `Afficher ${p.title} (${i + 1} sur ${faceCount})`
                  }
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    i === active ? "w-8 bg-gold" : "w-2 bg-primary/20 hover:bg-primary/35",
                  )}
                  onClick={() => {
                    setStep((s) => {
                      const from = s % faceCount;
                      const delta = (i - from + faceCount) % faceCount;
                      return delta === 0 ? s : s + delta;
                    });
                    setIntervalKey((k) => k + 1);
                  }}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-center md:justify-end md:shrink-0">
            <span className="sr-only">Logo affiché : {current.alt}</span>
            <div className={cn("partner-cube-scene", "partner-cube-scene--7")} aria-hidden>
              <div
                className="partner-cube-inner [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]"
                style={{
                  transform: `rotateY(${-step * faceStepDeg}deg)`,
                  transitionDuration: `${CUBE_TRANSITION_MS}ms`,
                }}
              >
                {partners.map((p, i) => (
                  <div
                    key={p.id}
                    className={cn(
                      "partner-cube-face flex items-center justify-center rounded-xl border border-primary/12",
                      "bg-gradient-to-br from-cream to-primary/[0.05]",
                      "shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_12px_28px_-12px_rgba(0,0,0,0.07)]",
                    )}
                    style={{
                      transform: `rotateY(${i * faceStepDeg}deg) translateZ(var(--partner-face-tz))`,
                    }}
                  >
                    <img
                      src={p.src}
                      alt=""
                      className="max-h-[72%] max-w-[82%] object-contain drop-shadow-md"
                      width={200}
                      height={200}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
