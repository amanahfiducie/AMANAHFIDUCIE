import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const contactInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180),
  phone: z.string().trim().max(60).optional(),
  subject: z.string().trim().max(180).optional(),
  message: z.string().trim().min(20).max(5000),
  honeypot: z.string().trim().max(0).optional(),
  startedAt: z.number().int().positive(),
});

const submissionLog = new Map<string, number[]>();
const payloadLog = new Map<string, number>();
const RATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_SUBMISSIONS_PER_WINDOW = 12;
const MIN_FILL_DURATION_MS = 2500;
const MIN_INTERVAL_BETWEEN_SUBMISSIONS_MS = 5 * 1000;
const DUPLICATE_PAYLOAD_WINDOW_MS = 5 * 60 * 1000;
const MAX_URLS_IN_MESSAGE = 2;

function getClientIp() {
  const forwardedFor = getRequestHeader("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }
  return getRequestHeader("x-real-ip") ?? getRequestHeader("cf-connecting-ip") ?? "unknown";
}

function canSubmitFromIp(ip: string, now: number) {
  const timestamps = submissionLog.get(ip) ?? [];
  const fresh = timestamps.filter((t) => now - t < RATE_WINDOW_MS);
  const latest = fresh[fresh.length - 1];
  if (latest && now - latest < MIN_INTERVAL_BETWEEN_SUBMISSIONS_MS) {
    return false;
  }
  if (fresh.length >= MAX_SUBMISSIONS_PER_WINDOW) return false;
  return true;
}

function recordSuccessfulSubmission(ip: string, now: number) {
  const timestamps = submissionLog.get(ip) ?? [];
  const fresh = timestamps.filter((t) => now - t < RATE_WINDOW_MS);
  fresh.push(now);
  submissionLog.set(ip, fresh);
}

function getPayloadKey(email: string, message: string, subject?: string) {
  const normalized = `${email.toLowerCase()}|${(subject ?? "").toLowerCase()}|${message
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()}`;
  return normalized;
}

function looksLikeSpam(message: string) {
  const links = message.match(/(https?:\/\/|www\.)/gi)?.length ?? 0;
  return links > MAX_URLS_IN_MESSAGE;
}

function smtpPassIsPlaceholder(pass: string | undefined) {
  const p = pass?.trim() ?? "";
  if (p.length === 0) return true;
  return p === "your_gmail_app_password" || p === "YOUR_GMAIL_APP_PASSWORD";
}

function resendKeyIsPlaceholder(key: string | undefined) {
  if (!key) return true;
  const k = key.trim();
  if (!k.startsWith("re_") || k.length < 12) return true;
  if (k === "re_your_resend_api_key" || k === "YOUR_RESEND_API_KEY") return true;
  const suffix = k.slice(3);
  // Clés d’exemple type re_xxxxxxxx… (copiées depuis .env.example sans remplacement)
  if (suffix.length >= 10 && /^(.)\1+$/.test(suffix)) return true;
  return false;
}

/** Parse un fichier type .env / .dev.vars (lignes KEY=value, # commentaires). */
function parseEnvFileContent(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    let key = t.slice(0, eq).trim();
    if (key.toLowerCase().startsWith("export ")) key = key.slice(7).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

/**
 * En `vite dev` + Worker Cloudflare, `.dev.vars` n’est pas toujours injecté dans `process.env`.
 * On relit `.env` puis `.dev.vars` depuis la racine du dépôt (pour chaque racine, `.dev.vars` écrase `.env`).
 */
let repoEnvCache: Promise<Record<string, string>> | null = null;

/** Racine du dépôt (lecture `.dev.vars` si `process.cwd()` n’est pas la racine du projet). */
const repoRootFromModule = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

async function loadRepoEnvFiles(): Promise<Record<string, string>> {
  if (repoEnvCache) return repoEnvCache;
  /** En production, ne jamais lire `.env` / `.dev.vars` depuis le disque (secrets, chemins imprévisibles). */
  const allowFsEnv =
    process.env.NODE_ENV !== "production" || process.env.LOCAL_ENV_FILE_READ === "1";
  if (!allowFsEnv) {
    repoEnvCache = Promise.resolve({});
    return repoEnvCache;
  }

  repoEnvCache = (async () => {
    try {
      const { existsSync, readFileSync } = await import("node:fs");
      const roots = [typeof process !== "undefined" && process.cwd ? process.cwd() : "", repoRootFromModule]
        .filter(Boolean)
        .filter((r, i, a) => a.indexOf(r) === i);

      const merged: Record<string, string> = {};
      for (const root of roots) {
        for (const name of [".env", ".dev.vars"]) {
          const p = join(root, name);
          if (!existsSync(p)) continue;
          Object.assign(merged, parseEnvFileContent(readFileSync(p, "utf8")));
        }
      }
      return merged;
    } catch {
      return {};
    }
  })();
  return repoEnvCache;
}

function pickEnv(fileEnv: Record<string, string>, key: string): string | undefined {
  const fromProcess = process.env[key]?.trim();
  if (fromProcess) return fromProcess;
  return fileEnv[key]?.trim();
}

async function sendWithResend(params: {
  apiKey: string;
  from: string;
  to: string;
  replyTo: string;
  subject: string;
  text: string;
}) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: params.from,
      to: [params.to],
      reply_to: params.replyTo,
      subject: params.subject,
      text: params.text,
    }),
  });

  const raw = await res.text();
  let parsed: { message?: string } = {};
  try {
    parsed = JSON.parse(raw) as { message?: string };
  } catch {
    /* ignore */
  }

  if (!res.ok) {
    const msg = parsed.message ?? (raw.trim().length > 0 ? raw.slice(0, 200) : `HTTP ${res.status}`);
    throw new Error(`Resend : ${msg}`);
  }
}

async function sendWithSmtp(params: {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  to: string;
  replyTo: string;
  subject: string;
  text: string;
}) {
  const { default: nodemailer } = await import("nodemailer");

  const transporter = nodemailer.createTransport({
    host: params.host,
    port: params.port,
    secure: params.port === 465,
    auth: {
      user: params.user,
      pass: params.pass,
    },
  });

  await transporter.sendMail({
    from: params.from,
    to: params.to,
    replyTo: params.replyTo,
    subject: params.subject,
    text: params.text,
    headers: {
      "X-Auto-Response-Suppress": "All",
    },
  });
}

export const sendContactEmail = createServerFn({ method: "POST" })
  .inputValidator(contactInputSchema)
  .handler(async ({ data }) => {
    const now = Date.now();

    // Basic bot mitigations
    if (data.honeypot && data.honeypot.length > 0) {
      return { ok: true };
    }
    if (now - data.startedAt < MIN_FILL_DURATION_MS) {
      throw new Error("Soumission invalide. Veuillez réessayer.");
    }
    if (data.startedAt > now + 10_000) {
      throw new Error("Soumission invalide. Veuillez réessayer.");
    }
    if (looksLikeSpam(data.message)) {
      throw new Error(
        "Votre message contient trop de liens. Merci de le simplifier puis de réessayer.",
      );
    }

    const ip = getClientIp();
    if (!canSubmitFromIp(ip, now)) {
      throw new Error(
        "Trop de tentatives en peu de temps. Patientez quelques secondes puis réessayez.",
      );
    }

    const payloadKey = getPayloadKey(data.email, data.message, data.subject);
    for (const [key, ts] of payloadLog.entries()) {
      if (now - ts > DUPLICATE_PAYLOAD_WINDOW_MS) payloadLog.delete(key);
    }
    const lastSamePayloadAt = payloadLog.get(payloadKey);
    if (lastSamePayloadAt && now - lastSamePayloadAt < DUPLICATE_PAYLOAD_WINDOW_MS) {
      throw new Error(
        "Ce message semble déjà avoir été envoyé récemment. Modifiez-le ou patientez quelques minutes.",
      );
    }

    const fileEnv = await loadRepoEnvFiles();

    const toEmail = pickEnv(fileEnv, "CONTACT_TO_EMAIL") ?? "amanahfiducie@gmail.com";
    const resendKey = pickEnv(fileEnv, "RESEND_API_KEY");
    const resendFrom =
      pickEnv(fileEnv, "RESEND_FROM_EMAIL") || "Amanah Fiducie <onboarding@resend.dev>";

    const smtpHost = pickEnv(fileEnv, "SMTP_HOST") ?? "smtp.gmail.com";
    const smtpPort = Number(pickEnv(fileEnv, "SMTP_PORT") ?? 465);
    const smtpUser = pickEnv(fileEnv, "SMTP_USER");
    const smtpPass = pickEnv(fileEnv, "SMTP_PASS");

    const useResend = resendKey && !resendKeyIsPlaceholder(resendKey);
    const useSmtp =
      smtpUser &&
      smtpPass &&
      !smtpPassIsPlaceholder(smtpPass);

    const skipRaw = pickEnv(fileEnv, "SKIP_CONTACT_EMAIL");
    const skipEmail = skipRaw === "1" || skipRaw === "true";

    if (skipEmail && process.env.VERCEL === "1") {
      throw new Error(
        "SKIP_CONTACT_EMAIL ne doit pas être défini sur Vercel : retirez cette variable pour activer l’envoi réel.",
      );
    }

    if (!useResend && !useSmtp && !skipEmail) {
      throw new Error(
        "Envoi e-mail non configuré. Mettez une vraie clé dans le fichier **.dev.vars** (pas .dev.vars.example) : `cp .dev.vars.example .dev.vars` puis éditez `.dev.vars` avec `RESEND_API_KEY=re_…` (Resend) ou `SMTP_USER` + `SMTP_PASS`. En local sans API : ajoutez `SKIP_CONTACT_EMAIL=1` dans `.dev.vars` (jamais en production).",
      );
    }

    const normalizedSubject =
      data.subject && data.subject.length > 0 ? data.subject : "Demande de contact";
    const sanitizedSubject = normalizedSubject.replace(/[\r\n]+/g, " ").trim();

    const textBody = [
      "Nouveau message depuis le formulaire contact Amanah Fiducie",
      "",
      `Nom: ${data.name}`,
      `Email: ${data.email}`,
      `Telephone: ${data.phone || "Non renseigne"}`,
      `Objet: ${sanitizedSubject}`,
      "",
      "Message:",
      data.message,
      "",
      `IP: ${ip}`,
    ].join("\n");

    const mailSubject = `Contact site - ${sanitizedSubject}`;

    try {
      if (skipEmail) {
        console.warn("[contact] SKIP_CONTACT_EMAIL — aucun e-mail envoyé.", {
          to: toEmail,
          replyTo: data.email,
          subject: mailSubject,
          excerpt: textBody.slice(0, 400),
        });
      } else if (useResend) {
        await sendWithResend({
          apiKey: resendKey!,
          from: resendFrom,
          to: toEmail,
          replyTo: data.email,
          subject: mailSubject,
          text: textBody,
        });
      } else {
        await sendWithSmtp({
          host: smtpHost,
          port: smtpPort,
          user: smtpUser!,
          pass: smtpPass!,
          from: `"Amanah Fiducie - Site" <${smtpUser}>`,
          to: toEmail,
          replyTo: data.email,
          subject: mailSubject,
          text: textBody,
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur d'envoi";
      throw new Error(msg);
    }

    payloadLog.set(payloadKey, now);
    recordSuccessfulSubmission(ip, now);

    return skipEmail ? ({ ok: true as const, devSkip: true as const }) : ({ ok: true as const });
  });
