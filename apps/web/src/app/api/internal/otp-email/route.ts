import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OtpPayload = {
  to_email?: string;
  subject?: string;
  text_body?: string;
  html_body?: string;
};

function unauthorized() {
  return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
}

export async function POST(req: NextRequest) {
  const expected = (process.env.OTP_EMAIL_WEBHOOK_SECRET || "").trim();
  if (!expected) {
    return NextResponse.json(
      { detail: "OTP webhook non configuré (OTP_EMAIL_WEBHOOK_SECRET)." },
      { status: 503 },
    );
  }

  const provided = (req.headers.get("x-otp-webhook-secret") || "").trim();
  if (!provided || provided !== expected) {
    return unauthorized();
  }

  let body: OtpPayload;
  try {
    body = (await req.json()) as OtpPayload;
  } catch {
    return NextResponse.json({ detail: "JSON invalide." }, { status: 400 });
  }

  const to = (body.to_email || "").trim();
  const subject = (body.subject || "").trim();
  const text = body.text_body || "";
  const html = body.html_body || "";
  if (!to || !subject || (!text && !html)) {
    return NextResponse.json({ detail: "Champs OTP manquants." }, { status: 400 });
  }

  const host = process.env.SMTP_HOST || process.env.EMAIL_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || "587");
  const user = process.env.SMTP_USER || process.env.EMAIL_HOST_USER || "";
  const pass = process.env.SMTP_PASS || process.env.EMAIL_HOST_PASSWORD || "";
  const from =
    process.env.SMTP_FROM_EMAIL ||
    process.env.DEFAULT_FROM_EMAIL ||
    (user ? `AMANAH Fiducie <${user}>` : "");

  if (!user || !pass || !from) {
    return NextResponse.json(
      { detail: "SMTP Gmail non configuré sur Vercel." },
      { status: 503 },
    );
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  try {
    await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html: html || undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Échec SMTP";
    return NextResponse.json({ detail: message }, { status: 502 });
  }

  return NextResponse.json({ ok: true, delivered_to: to });
}
