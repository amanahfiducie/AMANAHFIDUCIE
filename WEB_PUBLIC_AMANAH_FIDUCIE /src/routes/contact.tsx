import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Mail, Phone, MapPin, Send, Clock } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { SectionHeading } from "@/components/site/SectionHeading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import contactHeroAmanah from "@/assets/contact-hero-amanah.png";
import { sendContactEmail } from "@/utils/contact.functions";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact & Rendez-vous — Amanah Fiducie" },
      {
        name: "description",
        content:
          "Contactez Amanah Fiducie (projet SOFIGEPAM) à Dakar — premier échange confidentiel pour protéger et valoriser vos biens sous 48 h ouvrées.",
      },
      { property: "og:title", content: "Contact — Amanah Fiducie" },
      { property: "og:image", content: contactHeroAmanah },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const [submitting, setSubmitting] = useState(false);
  const startedAt = useMemo(() => Date.now(), []);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);

    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const subject = String(formData.get("subject") ?? "").trim();
    const message = String(formData.get("message") ?? "").trim();
    const honeypot = String(formData.get("website") ?? "");

    try {
      const result = await sendContactEmail({
        data: {
          name,
          email,
          phone,
          subject,
          message,
          honeypot,
          startedAt,
        },
      });

      if ("devSkip" in result && result.devSkip) {
        toast.success("Message pris en compte (mode développement)", {
          description:
            "Aucun e-mail envoyé : ajoutez RESEND_API_KEY (ou SMTP) dans .dev.vars, ou laissez SKIP_CONTACT_EMAIL=1 pour tester sans boîte mail.",
        });
      } else {
        toast.success("Message envoyé", {
          description: "Merci. Nous vous recontacterons sous 48h ouvrées.",
        });
      }
      form.reset();
    } catch (error) {
      const fallback = "Une erreur est survenue. Veuillez réessayer.";
      const messageText = error instanceof Error ? error.message : fallback;
      const isConfigHint =
        typeof messageText === "string" &&
        (messageText.includes("Envoi e-mail non configuré") || messageText.includes("Resend"));
      toast.error("Envoi impossible", {
        description: messageText || fallback,
        duration: isConfigHint ? 18_000 : 8_000,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SiteLayout>
      <Toaster richColors position="top-center" />

      {/* HERO */}
      <section className="relative pt-32 sm:pt-36 lg:pt-40 pb-16 sm:pb-20 text-primary-foreground overflow-hidden">
        <img
          src={contactHeroAmanah}
          alt="Entretien de conseil patrimonial chez Amanah Fiducie"
          className="absolute inset-0 w-full h-full object-cover"
          width={1792}
          height={1024}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/92 via-primary/80 to-primary/45" />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/65 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
          <div className="text-xs uppercase tracking-[0.25em] text-gold mb-4">Contact</div>
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-semibold leading-[1.08] sm:leading-[1.05] max-w-3xl">
            Contact &amp; Rendez-vous
          </h1>
          <p className="mt-5 sm:mt-6 max-w-2xl text-base sm:text-lg text-primary-foreground/85">
            Premier échange confidentiel pour cadrer la protection et la valorisation de vos biens.
            Réponse visée sous 48 heures ouvrées.
          </p>
        </div>
      </section>

      {/* FORM + INFO */}
      <section className="py-12 sm:py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-5 lg:px-8 grid lg:grid-cols-5 gap-8 sm:gap-10 lg:gap-12">
          {/* FORM */}
          <div className="lg:col-span-3 min-w-0">
            <SectionHeading
              eyebrow="Écrivez-nous"
              title="Confiez-nous votre projet"
              description="Expliquez votre situation en quelques lignes ; nous revenons vers vous pour cadrer une stratégie de protection, gestion et valorisation de vos actifs."
              className="max-lg:max-w-none"
            />
            <div className="mt-6 sm:mt-10 max-lg:rounded-2xl max-lg:border max-lg:border-border/90 max-lg:bg-card max-lg:p-4 max-lg:pt-5 max-lg:shadow-card sm:max-lg:p-6">
              <form onSubmit={onSubmit} className="grid gap-5 sm:gap-6">
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                className="hidden"
                aria-hidden="true"
              />
              <div className="grid sm:grid-cols-2 gap-4 sm:gap-5">
                <div className="grid gap-2 sm:gap-2.5">
                  <Label htmlFor="name" className="text-[15px] sm:text-sm leading-snug">
                    Nom complet <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    required
                    autoComplete="name"
                    placeholder="Votre nom"
                    className="h-11 min-h-11 rounded-lg border-border/90 px-3.5 text-base shadow-none sm:h-9 sm:min-h-0 sm:rounded-md sm:shadow-sm"
                  />
                </div>
                <div className="grid gap-2 sm:gap-2.5">
                  <Label htmlFor="email" className="text-[15px] sm:text-sm leading-snug">
                    Email <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="vous@exemple.com"
                    className="h-11 min-h-11 rounded-lg border-border/90 px-3.5 text-base shadow-none sm:h-9 sm:min-h-0 sm:rounded-md sm:shadow-sm"
                  />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4 sm:gap-5">
                <div className="grid gap-2 sm:gap-2.5">
                  <Label htmlFor="phone" className="text-[15px] sm:text-sm leading-snug">
                    Téléphone
                  </Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="+221 ..."
                    className="h-11 min-h-11 rounded-lg border-border/90 px-3.5 text-base shadow-none sm:h-9 sm:min-h-0 sm:rounded-md sm:shadow-sm"
                  />
                </div>
                <div className="grid gap-2 sm:gap-2.5">
                  <Label htmlFor="subject" className="text-[15px] sm:text-sm leading-snug">
                    Objet
                  </Label>
                  <Input
                    id="subject"
                    name="subject"
                    placeholder="Mandat, valorisation, conseil successoral…"
                    className="h-11 min-h-11 rounded-lg border-border/90 px-3.5 text-base shadow-none sm:h-9 sm:min-h-0 sm:rounded-md sm:shadow-sm"
                  />
                </div>
              </div>
              <div className="grid gap-2 sm:gap-2.5">
                <Label htmlFor="message" className="text-[15px] sm:text-sm leading-snug">
                  Message <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="message"
                  name="message"
                  required
                  minLength={20}
                  aria-describedby="message-help"
                  placeholder="Décrivez brièvement votre situation et vos besoins..."
                  rows={5}
                  className="min-h-[10.5rem] resize-y rounded-lg border-border/90 px-3.5 py-3 text-base leading-relaxed shadow-none sm:min-h-[9rem] sm:rounded-md sm:shadow-sm lg:text-sm"
                />
                <p id="message-help" className="text-[13px] sm:text-xs text-muted-foreground leading-relaxed">
                  Minimum 20 caractères. Vos données restent strictement confidentielles.
                </p>
              </div>
              <Button
                type="submit"
                variant="hero"
                size="xl"
                disabled={submitting}
                aria-busy={submitting}
                className="w-full justify-self-stretch sm:w-auto sm:justify-self-start mt-1"
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
          </div>

          {/* INFO */}
          <aside className="lg:col-span-2 space-y-4 min-w-0">
            <div className="bg-primary text-primary-foreground rounded-2xl p-5 sm:p-7 shadow-elegant">
              <h3 className="font-display text-lg sm:text-xl font-semibold text-gold">Coordonnées</h3>
              <ul className="mt-4 sm:mt-5 space-y-3.5 sm:space-y-4 text-sm sm:text-sm [&_a]:text-[15px] sm:[&_a]:text-sm">
                <li className="flex gap-3">
                  <MapPin className="size-5 text-gold shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium">Siège social</div>
                    <div className="text-primary-foreground/80">
                      Hann Maristes 2<br />
                      Dakar, Sénégal
                    </div>
                  </div>
                </li>
                <li className="flex gap-3">
                  <Phone className="size-5 text-gold shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium">Téléphone</div>
                    <a
                      href="tel:+221338000000"
                      className="text-primary-foreground/80 hover:text-gold"
                    >
                      +221 33 800 00 00
                    </a>
                  </div>
                </li>
                <li className="flex gap-3">
                  <Mail className="size-5 text-gold shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium">Email</div>
                    <a
                      href="mailto:amanahfiducie@gmail.com"
                      className="text-primary-foreground/80 hover:text-gold"
                    >
                      amanahfiducie@gmail.com
                    </a>
                  </div>
                </li>
                <li className="flex gap-3">
                  <Clock className="size-5 text-gold shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium">Horaires</div>
                    <div className="text-primary-foreground/80">
                      Lun – Ven : 8h30 – 18h00
                      <br />
                      Sam : 9h00 – 13h00
                    </div>
                  </div>
                </li>
              </ul>
            </div>

            <div className="rounded-2xl overflow-hidden shadow-card border border-border">
              <iframe
                title="Carte — Amanah Fiducie, Dakar"
                src="https://www.openstreetmap.org/export/embed.html?bbox=-17.46%2C14.72%2C-17.42%2C14.76&layer=mapnik"
                className="w-full h-64 sm:h-72 border-0"
                loading="lazy"
              />
            </div>
          </aside>
        </div>
      </section>
    </SiteLayout>
  );
}
