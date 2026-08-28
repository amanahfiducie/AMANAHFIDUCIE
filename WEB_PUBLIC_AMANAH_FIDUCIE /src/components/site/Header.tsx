import { Link, useLocation } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
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
  const [menuPortalReady, setMenuPortalReady] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuPortalReady(true);
  }, []);

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

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-50 max-lg:z-[200] transition-all duration-500",
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
              href="mailto:amanahfiducie@gmail.com"
              className={cn(
                "flex items-center gap-1.5 transition-colors",
                scrolled ? "hover:text-primary" : "hover:text-gold",
              )}
            >
              <Mail className="size-3" />
              <span>amanahfiducie@gmail.com</span>
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
                scrolled
                  ? "text-sm sm:text-base text-primary"
                  : "text-base sm:text-lg text-primary-foreground",
              )}
            >
              AMANAH FIDUCIE
            </div>
            <div
              className={cn(
                "text-[9px] sm:text-[10px] uppercase tracking-[0.18em] sm:tracking-[0.22em] transition-colors",
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
            "lg:hidden inline-flex size-11 items-center justify-center rounded-xl border transition-all",
            scrolled
              ? "text-foreground border-border/70 bg-background/85 hover:bg-accent"
              : "text-primary-foreground border-primary-foreground/25 bg-primary/35 backdrop-blur hover:bg-primary-foreground/10",
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

      {menuPortalReady
        ? createPortal(
            <div
              id="mobile-main-nav"
              aria-hidden={!open}
              className={cn(
                "lg:hidden fixed inset-0 z-[10000] min-h-dvh w-full",
                open ? "visible" : "invisible pointer-events-none",
              )}
            >
              <div
                className={cn(
                  "absolute inset-0 bg-black/45 backdrop-blur-[2px] transition-opacity duration-200",
                  open ? "opacity-100" : "opacity-0",
                )}
                onClick={() => setOpen(false)}
                aria-hidden
              />
              <nav
                aria-label="Navigation mobile"
                className={cn(
                  "mobile-nav-drawer-bg absolute top-0 right-0 h-full w-[min(100%,20rem)] max-w-[88vw] shadow-[0_0_40px_-8px_rgba(0,0,0,0.35)] flex flex-col overflow-y-auto overscroll-contain border-l border-white/10 transition-transform duration-200 ease-out motion-reduce:transition-none pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]",
                  open ? "translate-x-0" : "translate-x-full",
                )}
              >
                <div className="relative shrink-0 pt-6 pb-2 px-5 border-b border-white/10">
                  <button
                    type="button"
                    className="absolute right-3 top-3 inline-flex size-10 items-center justify-center rounded-full border border-white/25 text-white hover:bg-white/10 transition-colors"
                    onClick={() => setOpen(false)}
                    aria-label="Fermer le menu"
                  >
                    <X className="size-5" />
                  </button>
                  <div className="flex flex-col items-center gap-2 pr-8">
                    <div
                      className="relative flex size-[3.25rem] shrink-0 items-center justify-center rounded-full border-2 border-gold/70 bg-black/15 shadow-[0_0_0_1px_rgba(255,255,255,0.08),inset_0_0_12px_rgba(0,0,0,0.2)]"
                      aria-hidden
                    >
                      <img
                        src={logo}
                        alt=""
                        className="size-9 object-contain rounded-full"
                        width={36}
                        height={36}
                      />
                    </div>
                    <p className="font-display text-[11px] uppercase tracking-[0.28em] text-white/90 text-center font-semibold">
                      Amanah Fiducie
                    </p>
                  </div>
                </div>

                <div className="flex-1 px-4 py-5 space-y-1.5">
                  {navItems.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      activeOptions={{ exact: item.to === "/" }}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center justify-between gap-3 px-3.5 py-3.5 rounded-xl text-sm sm:text-[15px] font-semibold tracking-wide text-white border border-transparent",
                        "hover:bg-white/10 hover:border-white/15 focus-visible:ring-2 focus-visible:ring-gold/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                      )}
                      activeProps={{
                        className:
                          "text-white bg-white/15 border-gold/50 shadow-[inset_0_0_0_1px_rgba(212,175,55,0.35)]",
                      }}
                    >
                      <span className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]">{item.label}</span>
                      <ChevronRight className="size-4 shrink-0 text-gold/85" />
                    </Link>
                  ))}
                </div>

                <div className="shrink-0 border-t border-white/10 p-4 space-y-3 bg-black/15">
                  <Button
                    asChild
                    size="lg"
                    className="w-full rounded-xl border-0 bg-gold text-primary-foreground font-semibold shadow-gold hover:bg-gold/90"
                  >
                    <Link to="/contact" onClick={() => setOpen(false)}>
                      Prendre rendez-vous
                      <ChevronRight className="size-4" />
                    </Link>
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href="tel:+221338000000"
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/20 bg-white/5 px-2 py-2.5 text-xs font-semibold text-white hover:bg-white/10 transition-colors"
                    >
                      <Phone className="size-3.5 text-gold" />
                      Appeler
                    </a>
                    <a
                      href="mailto:amanahfiducie@gmail.com"
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/20 bg-white/5 px-2 py-2.5 text-xs font-semibold text-white hover:bg-white/10 transition-colors"
                    >
                      <Mail className="size-3.5 text-gold" />
                      E-mail
                    </a>
                  </div>
                </div>
              </nav>
            </div>,
            document.body,
          )
        : null}
    </header>
  );
}
