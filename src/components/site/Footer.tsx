import logo from "@/assets/logo-icon.png";
import { Link } from "@tanstack/react-router";
import {
  ArrowUp,
  BarChart3,
  ChevronRight,
  Clock,
  Landmark,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { PartnerMarquee } from "./PartnerMarquee";

const mainLinks = [
  { to: "/", label: "Accueil" },
  { to: "/a-propos", label: "À propos" },
  { to: "/services", label: "Services" },
  { to: "/impact", label: "Impact" },
  { to: "/contact", label: "Contact" },
] as const;

const expertiseLinks = [
  { to: "/service-mandat-fiduciaire", label: "Mandat fiduciaire" },
  { to: "/service-cantonnement-actifs", label: "Héritages des mineurs" },
  { to: "/service-conseil-successoral-islamique", label: "Conseil successoral islamique" },
  { to: "/service-waqf-familial", label: "Waqf familial" },
  { to: "/service-zakat-faraid", label: "Zakat & structuration" },
] as const;

const commitments = [
  { icon: ShieldCheck, label: "Protection des actifs confiés" },
  { icon: Landmark, label: "Valorisation conforme des biens" },
  { icon: BarChart3, label: "Reporting transparent et régulier" },
] as const;

export function Footer() {
  const scrollTop = () =>
    typeof window !== "undefined" &&
    window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <footer className="relative bg-primary text-primary-foreground">
      <div aria-hidden="true" className="absolute inset-0 paper-grain opacity-45" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-5 lg:px-8 pt-10 sm:pt-12 pb-10 grid gap-8 sm:gap-10 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <Link to="/" className="flex items-center gap-3 mb-5">
            <img src={logo} alt="" className="h-12 w-12 object-contain" width={48} height={48} />
            <div>
              <p className="font-display text-base sm:text-lg md:text-xl font-semibold">
                AMANAH FIDUCIE SARL
              </p>
              <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.18em] sm:tracking-[0.2em] text-primary-foreground/65">
                Société fiduciaire islamique
              </p>
            </div>
          </Link>
          <p className="text-xs sm:text-sm text-primary-foreground/82 leading-relaxed max-w-md">
            Nous accompagnons les familles, tuteurs, notaires et institutions dans la sécurisation
            et la gestion responsable des patrimoines confiés.
          </p>
          <ul className="mt-5 grid gap-2.5">
            {commitments.map((item) => (
              <li
                key={item.label}
                className="inline-flex w-fit max-w-full items-center gap-2 rounded-xl sm:rounded-full border border-primary-foreground/20 bg-primary-foreground/8 px-3 py-1.5 text-[10px] sm:text-xs text-primary-foreground/90"
              >
                <item.icon className="size-3.5 text-gold shrink-0" />
                {item.label}
              </li>
            ))}
          </ul>
        </div>

        <nav aria-label="Navigation principale du pied de page" className="lg:col-span-2">
          <h4 className="font-display text-xs sm:text-sm font-semibold mb-4 text-gold uppercase tracking-wider">
            Navigation
          </h4>
          <ul className="space-y-2.5 text-xs sm:text-sm text-primary-foreground/80">
            {mainLinks.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="inline-flex items-center gap-2 hover:text-gold transition-colors">
                  <ChevronRight className="size-3.5 text-gold/80" />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Liens services du pied de page" className="lg:col-span-3">
          <h4 className="font-display text-xs sm:text-sm font-semibold mb-4 text-gold uppercase tracking-wider">
            Expertises
          </h4>
          <ul className="space-y-2.5 text-xs sm:text-sm text-primary-foreground/80">
            {expertiseLinks.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="inline-flex items-center gap-2 hover:text-gold transition-colors">
                  <ChevronRight className="size-3.5 text-gold/80" />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="lg:col-span-2">
          <h4 className="font-display text-xs sm:text-sm font-semibold mb-4 text-gold uppercase tracking-wider">
            Contact
          </h4>
          <ul className="space-y-3 text-xs sm:text-sm text-primary-foreground/80">
            <li className="flex gap-3">
              <MapPin className="size-4 mt-0.5 text-gold shrink-0" />
              <span>
                Hann Maristes 2
                <br />
                Dakar, Sénégal
              </span>
            </li>
            <li className="flex gap-3">
              <Phone className="size-4 mt-0.5 text-gold shrink-0" />
              <a
                href="tel:+221338000000"
                className="hover:text-gold transition-colors"
              >
                +221 33 800 00 00
              </a>
            </li>
            <li className="flex gap-3">
              <Mail className="size-4 mt-0.5 text-gold shrink-0" />
              <a
                href="mailto:amanahfiducie@gmail.com"
                className="hover:text-gold transition-colors break-all"
              >
                amanahfiducie@gmail.com
              </a>
            </li>
            <li className="flex gap-3">
              <Clock className="size-4 mt-0.5 text-gold shrink-0" />
              <span>
                Lun – Ven · 8h30 – 18h00
                <br />
                Sam · 9h00 – 13h00
              </span>
            </li>
          </ul>
        </div>
      </div>

      <PartnerMarquee />

      <div className="relative border-t border-primary-foreground/15">
        <div className="mx-auto max-w-7xl px-4 sm:px-5 lg:px-8 py-5 flex flex-col md:flex-row items-center justify-between gap-3 text-[10px] sm:text-xs text-primary-foreground/65 text-center md:text-left">
          <p>© {new Date().getFullYear()} AMANAH FIDUCIE SARL — Tous droits réservés.</p>
          <p className="font-display italic text-gold/80 text-xs sm:text-sm">
            « Bâtir pour les générations futures »
          </p>
          <div className="flex flex-wrap items-center justify-center md:justify-end gap-2 sm:gap-4">
            <Link to="/contact" className="px-1 py-1 hover:text-gold transition-colors">
              Mentions légales
            </Link>
            <span className="hidden sm:inline opacity-30">·</span>
            <Link to="/contact" className="px-1 py-1 hover:text-gold transition-colors">
              Confidentialité
            </Link>
            <button
              type="button"
              onClick={scrollTop}
              aria-label="Revenir en haut"
              className="inline-flex size-8 items-center justify-center rounded-full border border-primary-foreground/25 hover:border-gold hover:text-gold transition-colors"
            >
              <ArrowUp className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
