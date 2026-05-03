import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, Phone, MapPin, Send, Clock } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { SectionHeading } from "@/components/site/SectionHeading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact & Rendez-vous — Amanah Fiducie" },
      {
        name: "description",
        content:
          "Contactez Amanah Fiducie (projet SOFIGEPAM) à Dakar — premier échange confidentiel sous 48 h ouvrées.",
      },
      { property: "og:title", content: "Contact — Amanah Fiducie" },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      toast.success("Demande envoyée", {
        description: "Nous vous recontacterons sous 48h ouvrées.",
      });
      (e.target as HTMLFormElement).reset();
    }, 800);
  };

  return (
    <SiteLayout>
      <Toaster richColors position="top-center" />

      {/* HERO */}
      <section className="relative pt-40 pb-20 bg-hero-gradient text-primary-foreground overflow-hidden">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="text-xs uppercase tracking-[0.25em] text-gold mb-4">Contact</div>
          <h1 className="font-display text-5xl lg:text-7xl font-semibold leading-[1.05] max-w-3xl">
            Contact &amp; Rendez-vous
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-primary-foreground/85">
            Premier échange confidentiel. Réponse visée sous 48 heures ouvrées.
          </p>
        </div>
      </section>

      {/* FORM + INFO */}
      <section className="py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-5 lg:px-8 grid lg:grid-cols-5 gap-12">
          {/* FORM */}
          <div className="lg:col-span-3">
            <SectionHeading
              eyebrow="Écrivez-nous"
              title="Confiez-nous votre projet"
              description="Expliquez votre situation en quelques lignes ; nous revenons vers vous pour fixer un entretien."
            />
            <form onSubmit={onSubmit} className="mt-10 grid gap-5">
              <div className="grid sm:grid-cols-2 gap-5">
                <div className="grid gap-2">
                  <Label htmlFor="name">
                    Nom complet <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    required
                    autoComplete="name"
                    placeholder="Votre nom"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">
                    Email <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="vous@exemple.com"
                  />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-5">
                <div className="grid gap-2">
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="+221 ..."
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="subject">Objet</Label>
                  <Input
                    id="subject"
                    name="subject"
                    placeholder="Mandat fiduciaire, conseil successoral..."
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="message">
                  Message <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="message"
                  name="message"
                  required
                  minLength={20}
                  aria-describedby="message-help"
                  placeholder="Décrivez brièvement votre situation et vos besoins..."
                  rows={6}
                />
                <p id="message-help" className="text-xs text-muted-foreground">
                  Minimum 20 caractères.
                  <br />
                  Vos données restent strictement confidentielles.
                </p>
              </div>
              <Button
                type="submit"
                variant="hero"
                size="xl"
                disabled={submitting}
                aria-busy={submitting}
                className="justify-self-start"
              >
                {submitting ? (
                  "Envoi en cours..."
                ) : (
                  <>
                    Envoyer la demande <Send className="size-4" />
                  </>
                )}
              </Button>
            </form>
          </div>

          {/* INFO */}
          <aside className="lg:col-span-2 space-y-4">
            <div className="bg-primary text-primary-foreground rounded-2xl p-7 shadow-elegant">
              <h3 className="font-display text-xl font-semibold text-gold">
                Coordonnées
              </h3>
              <ul className="mt-5 space-y-4 text-sm">
                <li className="flex gap-3">
                  <MapPin className="size-5 text-gold shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium">Siège social</div>
                    <div className="text-primary-foreground/80">
                      Hann Maristes 2<br />Dakar, Sénégal
                    </div>
                  </div>
                </li>
                <li className="flex gap-3">
                  <Phone className="size-5 text-gold shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium">Téléphone</div>
                    <a href="tel:+221338000000" className="text-primary-foreground/80 hover:text-gold">
                      +221 33 800 00 00
                    </a>
                  </div>
                </li>
                <li className="flex gap-3">
                  <Mail className="size-5 text-gold shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium">Email</div>
                    <a href="mailto:contact@amanahfiducie.sn" className="text-primary-foreground/80 hover:text-gold">
                      contact@amanahfiducie.sn
                    </a>
                  </div>
                </li>
                <li className="flex gap-3">
                  <Clock className="size-5 text-gold shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium">Horaires</div>
                    <div className="text-primary-foreground/80">
                      Lun – Ven : 8h30 – 18h00<br />Sam : 9h00 – 13h00
                    </div>
                  </div>
                </li>
              </ul>
            </div>

            <div className="rounded-2xl overflow-hidden shadow-card border border-border">
              <iframe
                title="Carte — Amanah Fiducie, Dakar"
                src="https://www.openstreetmap.org/export/embed.html?bbox=-17.46%2C14.72%2C-17.42%2C14.76&layer=mapnik"
                className="w-full h-72 border-0"
                loading="lazy"
              />
            </div>
          </aside>
        </div>
      </section>
    </SiteLayout>
  );
}
