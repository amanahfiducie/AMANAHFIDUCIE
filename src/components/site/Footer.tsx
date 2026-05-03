import logo from "@/assets/logo-icon.png";
import { Link } from "@tanstack/react-router";
import {
    ArrowUp,
    BookOpenCheck,
    ClipboardCheck,
    Clock,
    Mail,
    MapPin,
    Phone,
    ScrollText,
} from "lucide-react";

const navLinks = [
  { to: "/", label: "Accueil" },
  { to: "/a-propos", label: "À propos" },
  { to: "/services", label: "Nos services" },
  { to: "/impact", label: "Impact" },
  { to: "/contact", label: "Contact" },
] as const;

const serviceLinks = [
  { to: "/service-mandat-fiduciaire", label: "Mandat fiduciaire" },
  { to: "/service-cantonnement-actifs", label: "Héritages des mineurs" },
  { to: "/service-conseil-successoral-islamique", label: "Conseil successoral islamique" },
  { to: "/service-waqf-familial", label: "Waqf familial" },
  { to: "/service-zakat-faraid", label: "Zakat et farāʾiḍ" },
  { to: "/service-conformite-charaique", label: "Conformité charaïque" },
  { to: "/comite-charaique", label: "Comité charaïque" },
  { to: "/service-reporting", label: "Reporting fiduciaire" },
] as const;

const trustChips = [
  { icon: ScrollText, label: "Tutelle & mandat encadrés" },
  { icon: BookOpenCheck, label: "Comité charaïque indépendant" },
  { icon: ClipboardCheck, label: "Audits annuels" },
];

export function Footer() {
  const scrollTop = () =>
    typeof window !== "undefined" &&
    window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <footer className="relative bg-primary text-primary-foreground">
      <div aria-hidden="true" className="absolute inset-0 paper-grain opacity-50" />

      <div className="relative mx-auto max-w-7xl px-5 lg:px-8 pt-16 pb-10 grid gap-12 lg:grid-cols-12">
        {/* Brand & description */}
        <div className="lg:col-span-5">
          <Link to="/" className="flex items-center gap-3 mb-5">
            <img
              src={logo}
              alt=""
              className="h-12 w-12 object-contain"
              width={48}
              height={48}
            />
            <div>
              <div className="font-display text-xl font-semibold">
                AMANAH FIDUCIE SARL
              </div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-primary-foreground/70">
                SOFIGEPAM — Société Fiduciaire Islamique
              </div>
            </div>
          </Link>

          <p className="text-primary-foreground/85 max-w-md leading-relaxed">
            <span className="font-semibold text-gold">AMANAH FIDUCIE SARL</span> — pionnière
            de la fiducie islamique au Sénégal. Expertise juridique, financière et charaïque
            au service du patrimoine.
          </p>

          <ul className="mt-6 flex flex-wrap gap-2">
            {trustChips.map((chip) => (
              <li
                key={chip.label}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/10 border border-primary-foreground/20 px-3 py-1 text-[11px] text-primary-foreground/90"
              >
                <chip.icon className="size-3.5 text-gold" />
                {chip.label}
              </li>
            ))}
          </ul>
        </div>

        {/* Navigation */}
        <nav aria-label="Navigation pied de page" className="lg:col-span-2">
          <h4 className="font-display text-sm font-semibold mb-4 text-gold uppercase tracking-wider">
            Navigation
          </h4>
          <ul className="space-y-2.5 text-sm text-primary-foreground/80">
            {navLinks.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className="inline-flex items-center gap-1.5 hover:text-gold transition-colors"
                >
                  <span className="size-1 rounded-full bg-gold/0 group-hover:bg-gold transition-colors" />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Services */}
        <div className="lg:col-span-3">
          <h4 className="font-display text-sm font-semibold mb-4 text-gold uppercase tracking-wider">
            Nos services
          </h4>
          <ul className="space-y-2.5 text-sm text-primary-foreground/80">
            {serviceLinks.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="hover:text-gold transition-colors">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact */}
        <div className="lg:col-span-2">
          <h4 className="font-display text-sm font-semibold mb-4 text-gold uppercase tracking-wider">
            Contact
          </h4>
          <ul className="space-y-3 text-sm text-primary-foreground/80">
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
                href="mailto:contact@amanahfiducie.sn"
                className="hover:text-gold transition-colors break-all"
              >
                contact@amanahfiducie.sn
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

      <div className="relative border-t border-primary-foreground/15">
        <div className="mx-auto max-w-7xl px-5 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-primary-foreground/65">
          <p>
            © {new Date().getFullYear()} AMANAH FIDUCIE SARL — Tous droits réservés.
          </p>
          <p className="font-display italic text-gold/80">
            « Protéger le patrimoine des générations futures »
          </p>
          <div className="flex items-center gap-4">
            <Link to="/contact" className="hover:text-gold transition-colors">
              Mentions légales
            </Link>
            <span className="opacity-30">·</span>
            <Link to="/contact" className="hover:text-gold transition-colors">
              Confidentialité
            </Link>
            <button
              type="button"
              onClick={scrollTop}
              aria-label="Revenir en haut"
              className="ml-2 inline-flex size-8 items-center justify-center rounded-full border border-primary-foreground/25 hover:border-gold hover:text-gold transition-colors"
            >
              <ArrowUp className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
