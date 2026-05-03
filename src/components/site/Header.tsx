import { Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Menu, X, Phone, Mail, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo-icon.png";

const navItems = [
  { to: "/", label: "Accueil" },
  { to: "/a-propos", label: "À propos" },
  { to: "/services", label: "Services" },
  { to: "/impact", label: "Impact" },
  { to: "/contact", label: "Contact" },
] as const;

export function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock scroll when mobile menu open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all duration-500",
        scrolled
          ? "bg-background/85 backdrop-blur-xl shadow-card border-b border-border/60"
          : "bg-transparent",
      )}
    >
      {/* Top contact bar — always visible on desktop */}
      <div
        className={cn(
          "hidden lg:block border-b transition-all duration-500 overflow-hidden",
          scrolled ? "border-border/70" : "border-primary-foreground/10",
        )}
      >
        <div
          className={cn(
            "mx-auto max-w-7xl px-5 lg:px-8 h-9 flex items-center justify-between text-[11px]",
            scrolled ? "text-foreground/80" : "text-primary-foreground/80",
          )}
        >
          <div className="flex items-center gap-5">
            <a
              href="tel:+221338000000"
              className={cn(
                "flex items-center gap-1.5 transition-colors",
                scrolled ? "hover:text-primary" : "hover:text-gold",
              )}
            >
              <Phone className="size-3" />
              <span>+221 33 800 00 00</span>
            </a>
            <a
              href="mailto:contact@amanahfiducie.sn"
              className={cn(
                "flex items-center gap-1.5 transition-colors",
                scrolled ? "hover:text-primary" : "hover:text-gold",
              )}
            >
              <Mail className="size-3" />
              <span>contact@amanahfiducie.sn</span>
            </a>
          </div>
          <div className="uppercase tracking-[0.25em] text-gold/90">
            Première société fiduciaire islamique au Sénégal
          </div>
        </div>
      </div>

      <div
        className={cn(
          "mx-auto max-w-7xl px-5 lg:px-8 flex items-center justify-between transition-all duration-500",
          scrolled ? "h-16" : "h-20",
        )}
      >
        <Link
          to="/"
          className="flex items-center gap-3 group shrink-0"
          aria-label="Amanah Fiducie — Accueil"
        >
          <div className="relative">
            <div
              className={cn(
                "absolute inset-0 rounded-full blur-md transition-opacity duration-500",
                scrolled ? "opacity-0" : "opacity-60 bg-gold/30",
              )}
            />
            <img
              src={logo}
              alt="Logo Amanah Fiducie"
              className={cn(
                "relative object-contain transition-all duration-500 group-hover:scale-110 group-hover:rotate-3",
                scrolled ? "h-10 w-10" : "h-12 w-12",
              )}
              width={48}
              height={48}
            />
          </div>
          <div className="leading-tight">
            <div
              className={cn(
                "font-display font-semibold tracking-wide transition-all duration-500",
                scrolled ? "text-base text-primary" : "text-lg text-primary-foreground",
              )}
            >
              AMANAH FIDUCIE
            </div>
            <div
              className={cn(
                "text-[10px] uppercase tracking-[0.22em] transition-colors",
                scrolled ? "text-muted-foreground" : "text-gold/90",
              )}
            >
              Société Fiduciaire Islamique
            </div>
          </div>
        </Link>

        <nav aria-label="Navigation principale" className="hidden lg:flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              className={cn(
                "relative px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 group/nav",
                scrolled
                  ? "text-foreground hover:text-primary hover:bg-gold/10"
                  : "text-primary-foreground/85 hover:text-primary-foreground hover:bg-primary-foreground/10",
              )}
              activeProps={{
                className: scrolled
                  ? "text-primary-foreground bg-primary"
                  : "text-gold bg-primary-foreground/10",
              }}
            >
              <span className="relative z-10">{item.label}</span>
              {/* animated underline */}
              <span
                className={cn(
                  "pointer-events-none absolute left-4 right-4 -bottom-0.5 h-px origin-left scale-x-0 transition-transform duration-300 group-hover/nav:scale-x-100",
                  scrolled ? "bg-primary" : "bg-gold",
                )}
              />
              {/* active indicator dot */}
              <span
                className={cn(
                  "pointer-events-none absolute left-1/2 -translate-x-1/2 -bottom-1 h-1 w-1 rounded-full opacity-0 transition-opacity",
                  "group-data-[status=active]/nav:opacity-100",
                  scrolled ? "bg-primary" : "bg-gold",
                )}
              />
            </Link>
          ))}
          <Button asChild variant="hero" size="default" className="ml-4 rounded-full px-6">
            <Link to="/contact">
              Prendre rendez-vous
              <ChevronRight className="transition-transform group-hover/btn:translate-x-0.5" />
            </Link>
          </Button>
        </nav>

        <button
          className={cn(
            "lg:hidden p-2 rounded-md transition-colors",
            scrolled
              ? "text-foreground hover:bg-accent"
              : "text-primary-foreground hover:bg-primary-foreground/10",
          )}
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={open}
          aria-controls="mobile-main-nav"
          aria-haspopup="menu"
        >
          {open ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>

      {/* Mobile menu — full overlay */}
      <div
        id="mobile-main-nav"
        aria-hidden={!open}
        className={cn(
          "lg:hidden fixed inset-x-0 top-16 bottom-0 bg-background/98 backdrop-blur-xl transition-all duration-300 origin-top",
          open
            ? "opacity-100 scale-y-100 pointer-events-auto"
            : "opacity-0 scale-y-95 pointer-events-none",
        )}
      >
        <nav aria-label="Navigation mobile" className="px-5 py-6 flex flex-col gap-1 max-w-md mx-auto">
          {navItems.map((item, idx) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              onClick={() => setOpen(false)}
              style={{ transitionDelay: open ? `${idx * 40}ms` : "0ms" }}
              className={cn(
                "group flex items-center justify-between px-4 py-4 rounded-lg text-base font-medium text-foreground border border-transparent hover:border-border hover:bg-accent transition-all",
                open ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0",
              )}
              activeProps={{
                className: "text-primary-foreground bg-primary border-primary/40",
              }}
            >
              <span>{item.label}</span>
              <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
            </Link>
          ))}
          <Button asChild variant="hero" size="lg" className="mt-4 w-full rounded-full">
            <Link to="/contact" onClick={() => setOpen(false)}>
              Prendre rendez-vous
            </Link>
          </Button>

          <div className="mt-8 pt-6 border-t border-border space-y-3 text-sm text-muted-foreground">
            <a href="tel:+221338000000" className="flex items-center gap-3 hover:text-primary transition-colors">
              <Phone className="size-4 text-gold" />
              +221 33 800 00 00
            </a>
            <a href="mailto:contact@amanahfiducie.sn" className="flex items-center gap-3 hover:text-primary transition-colors">
              <Mail className="size-4 text-gold" />
              contact@amanahfiducie.sn
            </a>
          </div>
        </nav>
      </div>
    </header>
  );
}
