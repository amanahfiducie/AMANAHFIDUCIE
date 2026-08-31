import json
import logging
import smtplib
import socket
import ssl
import urllib.error
import urllib.request
from email.mime.image import MIMEImage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

from accounts.email_brand import (BRAND_LOGO_CONTENT_ID, SF_BACKGROUND,
                                  SF_CREAM, SF_CREAM_DARK, SF_FOREGROUND,
                                  SF_GOLD, SF_GOLD_SOFT, SF_GREEN,
                                  SF_GREEN_DEEP, SF_GREEN_MID,
                                  brand_logo_attachment_base64,
                                  brand_logo_bytes, brand_logo_html_src,
                                  brand_site_url, connect_login_url)
from accounts.profile_types import PROFILE_TYPE_LABELS
from accounts.user_case_links import build_case_links_by_user_id
from config.env_loader import (API_DIR, load_project_env, login_otp_method,
                               normalize_smtp_host, pick_env,
                               resend_api_key_valid, resend_from_email,
                               smtp_credentials_valid, smtp_from_email)
from django.conf import settings

logger = logging.getLogger(__name__)

OTP_FILE_DIR = API_DIR / "var" / "otp_codes"

BREVO_SMTP_HOSTS = ("smtp-relay.brevo.com", "smtp-relay.sendinblue.com")
GMAIL_SMTP_HOSTS = ("smtp.gmail.com",)


class LoginOtpEmailError(Exception):
    """Échec d'envoi du code OTP."""

    def __init__(self, message: str):
        super().__init__(message)


class OtpEmailResult:
    """Résultat d'envoi OTP (jamais de code affiché à l'écran par défaut)."""

    __slots__ = ("dev_code", "dev_notice", "delivered_to")

    def __init__(
        self,
        *,
        dev_code: str | None = None,
        dev_notice: str | None = None,
        delivered_to: str | None = None,
    ):
        self.dev_code = dev_code
        self.dev_notice = dev_notice
        self.delivered_to = delivered_to


def _expose_dev_code() -> bool:
    return getattr(settings, "LOGIN_OTP_EXPOSE_DEV_CODE", False)


def _email_header_html() -> str:
    """En-tête institutionnel — vert plateforme, SOFIGEPAM Connect en blanc."""
    site = brand_site_url()
    logo_src = brand_logo_html_src()
    return f"""
          <tr>
            <td bgcolor="{SF_GREEN_DEEP}" style="background-color:{SF_GREEN_DEEP};padding:0;">
              <!--[if mso]>
              <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false"
                style="width:560px;height:128px;">
                <v:fill type="gradient" color="{SF_GREEN_DEEP}" color2="{SF_GREEN}" angle="135"/>
                <v:textbox inset="0,0,0,0">
              <![endif]-->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                     style="background-color:{SF_GREEN_DEEP};
                            background-image:linear-gradient(135deg,{SF_GREEN_DEEP} 0%,{SF_GREEN} 100%);">
                <tr>
                  <td style="padding:28px 36px 24px;background-color:{SF_GREEN_DEEP};">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="52" valign="middle" style="padding-right:14px;">
                          <a href="{site}" target="_blank" rel="noopener noreferrer"
                             style="text-decoration:none;">
                            <img src="{logo_src}" alt="AMANAH FIDUCIE" width="44" height="44"
                                 style="display:block;width:44px;height:44px;border-radius:50%;
                                        border:2px solid {SF_GOLD_SOFT};" />
                          </a>
                        </td>
                        <td valign="middle">
                          <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.26em;
                                    text-transform:uppercase;color:{SF_GOLD};
                                    font-family:Arial,Helvetica,sans-serif;font-weight:600;">
                            <a href="{site}" target="_blank" rel="noopener noreferrer"
                               style="color:{SF_GOLD};text-decoration:none;">
                              AMANAH&nbsp;FIDUCIE
                            </a>
                          </p>
                          <h1 style="margin:0;padding:0;font-size:24px;font-weight:700;line-height:1.25;
                                     font-family:Arial,Helvetica,sans-serif;color:#FFFFFF;
                                     mso-line-height-rule:exactly;">
                            <font color="#FFFFFF" face="Arial, Helvetica, sans-serif"
                                  style="color:#FFFFFF;font-size:24px;font-weight:bold;">
                              SOFIGEPAM Connect
                            </font>
                          </h1>
                          <p style="margin:8px 0 0;font-size:12px;line-height:1.45;
                                    color:{SF_GOLD_SOFT};font-family:Arial,Helvetica,sans-serif;">
                            Gestion fiduciaire &middot; conformité charaïque
                          </p>
                        </td>
                      </tr>
                    </table>
                    <table role="presentation" width="64" cellspacing="0" cellpadding="0"
                           style="margin-top:16px;">
                      <tr>
                        <td height="3" bgcolor="{SF_GOLD}"
                            style="background-color:{SF_GOLD};font-size:0;line-height:0;">
                          &nbsp;
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <!--[if mso]></v:textbox></v:rect><![endif]-->
            </td>
          </tr>"""


def _email_highlight_card(*, label: str, inner_html: str) -> str:
    return f"""
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                     style="background-color:{SF_CREAM};border:1px solid {SF_CREAM_DARK};
                            border-radius:12px;">
                <tr>
                  <td style="padding:22px 24px;border-left:4px solid {SF_GOLD};">
                    <p style="margin:0 0 14px;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;
                              color:{SF_GREEN_MID};font-family:Arial,Helvetica,sans-serif;font-weight:600;">
                      {label}
                    </p>
                    {inner_html}
                  </td>
                </tr>
              </table>"""


def _email_credential_row(*, label: str, value: str, large: bool = False) -> str:
    size = "22px" if large else "17px"
    spacing = "0.14em" if large else "0.04em"
    return f"""
                    <p style="margin:0 0 14px;font-size:15px;line-height:1.5;color:{SF_GREEN_DEEP};
                              font-family:Arial,Helvetica,sans-serif;">
                      <span style="display:block;margin-bottom:4px;font-size:10px;letter-spacing:0.16em;
                                   text-transform:uppercase;color:{SF_GREEN_MID};font-weight:600;">
                        {label}
                      </span>
                      <span style="font-size:{size};font-weight:700;letter-spacing:{spacing};
                                   color:{SF_GREEN_DEEP};font-family:'Courier New',Courier,monospace;">
                        {value}
                      </span>
                    </p>"""


def _profile_types_label(profile_types: list[str]) -> str:
    if not profile_types:
        return "Intervenant sur le dossier"
    return ", ".join(PROFILE_TYPE_LABELS.get(t, t) for t in profile_types)


def _merge_case_links_for_email(
    user_id: int,
    *,
    highlight_reference: str | None = None,
    extra_profile_type: str | None = None,
) -> list[dict]:
    links = list(build_case_links_by_user_id([user_id]).get(user_id, []))
    if not links:
        return links
    for item in links:
        if highlight_reference and item["reference"] == highlight_reference and extra_profile_type:
            types = list(item.get("profile_types") or [])
            if extra_profile_type not in types:
                types.append(extra_profile_type)
            item["profile_types"] = types
    return links


def _email_connect_login_block() -> str:
    login_url = connect_login_url()
    return f"""
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                     style="margin-top:20px;background-color:{SF_BACKGROUND};border-radius:10px;
                            border:1px solid {SF_CREAM_DARK};">
                <tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0 0 8px;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;
                              color:{SF_GREEN_MID};font-family:Arial,Helvetica,sans-serif;font-weight:600;">
                      Connexion à la plateforme
                    </p>
                    <p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:{SF_FOREGROUND};
                              font-family:Arial,Helvetica,sans-serif;">
                      Rendez-vous sur
                      <a href="{login_url}" style="color:{SF_GREEN};font-weight:600;text-decoration:underline;">
                        SOFIGEPAM Connect
                      </a>
                      avec votre identifiant, votre e-mail ou votre téléphone, puis votre mot de passe.
                      Un code de vérification à 6 chiffres vous sera envoyé par e-mail.
                    </p>
                  </td>
                </tr>
              </table>"""


def _email_cases_access_block(
    *,
    user_id: int,
    highlight_reference: str | None = None,
    extra_profile_type: str | None = None,
) -> tuple[str, str]:
    """Bloc HTML + texte brut listant les dossiers accessibles."""
    links = _merge_case_links_for_email(
        user_id,
        highlight_reference=highlight_reference,
        extra_profile_type=extra_profile_type,
    )
    if not links:
        return "", ""

    rows_html = []
    text_lines = ["Dossier(s) auxquels vous avez accès :"]
    for item in links:
        role_label = _profile_types_label(item.get("profile_types") or [])
        ref = item["reference"]
        title = item["title"]
        rows_html.append(
            f"""
                    <tr>
                      <td style="padding:10px 0;border-bottom:1px solid {SF_CREAM_DARK};">
                        <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:{SF_GREEN_DEEP};
                                  font-family:Arial,Helvetica,sans-serif;">
                          {ref}
                        </p>
                        <p style="margin:0 0 4px;font-size:14px;line-height:1.5;color:{SF_FOREGROUND};
                                  font-family:Arial,Helvetica,sans-serif;">
                          {title}
                        </p>
                        <p style="margin:0;font-size:12px;line-height:1.45;color:{SF_GREEN};
                                  font-family:Arial,Helvetica,sans-serif;">
                          Votre rôle&nbsp;: {role_label}
                        </p>
                      </td>
                    </tr>"""
        )
        text_lines.append(f"  • {ref} — {title} ({role_label})")

    html = f"""
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                     style="margin-top:20px;background-color:{SF_CREAM};border:1px solid {SF_CREAM_DARK};
                            border-radius:12px;">
                <tr>
                  <td style="padding:18px 20px;border-left:4px solid {SF_GOLD};">
                    <p style="margin:0 0 12px;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;
                              color:{SF_GREEN_MID};font-family:Arial,Helvetica,sans-serif;font-weight:600;">
                      Vos dossiers sur SOFIGEPAM Connect
                    </p>
                    <p style="margin:0 0 14px;font-size:13px;line-height:1.6;color:{SF_FOREGROUND};
                              font-family:Arial,Helvetica,sans-serif;">
                      Vous ne voyez que les informations des dossiers ci-dessous&nbsp;: pièces et
                      échanges autorisés selon votre profil, sans accès aux autres dossiers de la
                      fiducie.
                    </p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      {"".join(rows_html)}
                    </table>
                  </td>
                </tr>
              </table>"""
    text_lines.append(
        "Vous n'avez accès qu'aux informations de ces dossiers, selon votre profil."
    )
    return html, "\n".join(text_lines)


def _email_account_credentials_block(
    *,
    username: str,
    to_email: str,
    phone: str = "",
    temporary_password: str | None = None,
    password_label: str = "Mot de passe",
) -> tuple[str, str]:
    """Identifiants HTML + texte brut."""
    phone_line = ""
    if phone.strip():
        phone_line = _email_credential_row(label="Téléphone de connexion", value=phone.strip())
    pwd_line = ""
    text_parts = [f"Identifiant : {username}", f"E-mail : {to_email}"]
    if phone.strip():
        text_parts.append(f"Téléphone : {phone.strip()}")
    if temporary_password:
        pwd_line = _email_credential_row(
            label=password_label,
            value=temporary_password,
            large=True,
        )
        text_parts.append(f"{password_label} : {temporary_password}")
    inner = (
        _email_credential_row(label="Identifiant", value=username)
        + _email_credential_row(label="E-mail de connexion", value=to_email)
        + phone_line
        + pwd_line
    )
    return inner, "\n".join(text_parts)


def _email_footer_html() -> str:
    site = brand_site_url()
    logo_src = brand_logo_html_src()
    host = site.replace("https://", "").replace("http://", "")
    return f"""
          <tr>
            <td bgcolor="{SF_GREEN_DEEP}" style="padding:0;background-color:{SF_GREEN_DEEP};">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                     style="background-color:{SF_GREEN_DEEP};">
                <tr>
                  <td style="padding:22px 36px 10px;text-align:center;">
                    <a href="{site}" target="_blank" rel="noopener noreferrer"
                       style="text-decoration:none;display:inline-block;">
                      <img src="{logo_src}" alt="AMANAH FIDUCIE" width="40" height="40"
                           style="display:block;width:40px;height:40px;margin:0 auto;
                                  border-radius:50%;border:2px solid {SF_GOLD_SOFT};" />
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 36px 24px;text-align:center;">
                    <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;
                              color:{SF_GOLD_SOFT};font-family:Arial,Helvetica,sans-serif;">
                      Message automatique
                    </p>
                    <p style="margin:0 0 6px;font-size:14px;line-height:1.5;
                              font-family:Arial,Helvetica,sans-serif;">
                      <strong style="color:#FFFFFF;">AMANAH FIDUCIE</strong>
                      <span style="color:{SF_GOLD_SOFT};">&nbsp;&middot;&nbsp;</span>
                      <strong style="color:#FFFFFF;">SOFIGEPAM Connect</strong>
                    </p>
                    <p style="margin:0 0 12px;font-size:14px;line-height:1.5;
                              font-family:Arial,Helvetica,sans-serif;">
                      <a href="{site}" target="_blank" rel="noopener noreferrer"
                         style="color:{SF_GOLD};font-weight:600;text-decoration:underline;">
                        {host}
                      </a>
                    </p>
                    <p style="margin:0;font-size:12px;line-height:1.55;color:{SF_GOLD_SOFT};
                              font-family:Arial,Helvetica,sans-serif;opacity:0.95;">
                      Ne répondez pas à cet e-mail.
                      Pour toute question, contactez votre interlocuteur AMANAH FIDUCIE
                      ou visitez
                      <a href="{site}" style="color:{SF_GOLD};text-decoration:underline;">{host}</a>.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>"""


def _branded_email_html(
    *,
    page_title: str,
    greeting: str,
    headline: str,
    highlight_html: str = "",
    below_highlight_html: str = "",
    context_line: str = "",
    security_note: str = "",
    preheader: str = "",
) -> str:
    """Template HTML transactionnel (charte SOFIGEPAM Connect)."""
    preheader_block = ""
    if preheader:
        preheader_block = f"""
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;
              color:{SF_CREAM};">
    {preheader}
  </div>"""

    context_block = ""
    if context_line:
        context_block = f"""
              <p style="margin:0 0 22px;font-size:15px;line-height:1.65;color:{SF_FOREGROUND};
                        font-family:Arial,Helvetica,sans-serif;">
                {context_line}
              </p>"""

    security_block = ""
    if security_note:
        security_block = f"""
          <tr>
            <td style="padding:0 36px 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                     style="background-color:{SF_CREAM};border-radius:10px;
                            border:1px solid {SF_CREAM_DARK};">
                <tr>
                  <td style="padding:16px 18px;border-left:4px solid {SF_GOLD};">
                    <p style="margin:0;font-size:13px;line-height:1.6;color:{SF_GREEN};
                              font-family:Arial,Helvetica,sans-serif;">
                      <strong style="color:{SF_GREEN};">Sécurité —</strong> {security_note}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>"""

    body_bottom_padding = "12px" if security_note else "36px"

    return f"""<!DOCTYPE html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>{page_title}</title>
</head>
<body style="margin:0;padding:0;background-color:{SF_CREAM_DARK};
             font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
{preheader_block}
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
         bgcolor="{SF_CREAM_DARK}" style="background-color:{SF_CREAM_DARK};">
    <tr>
      <td align="center" style="padding:36px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
               bgcolor="#ffffff" style="max-width:560px;background-color:#ffffff;
                      border-radius:16px;border:1px solid {SF_CREAM_DARK};overflow:hidden;">
{_email_header_html()}
          <tr>
            <td style="padding:36px 36px {body_bottom_padding};background-color:#ffffff;">
              <p style="margin:0 0 6px;font-size:17px;font-weight:600;color:{SF_GREEN_DEEP};
                        font-family:Arial,Helvetica,sans-serif;">{greeting}</p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:{SF_FOREGROUND};
                        font-family:Arial,Helvetica,sans-serif;">{headline}</p>
              {context_block}
              {highlight_html}
              {below_highlight_html}
            </td>
          </tr>
          {security_block}
{_email_footer_html()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _otp_email_html(
    *,
    greeting: str,
    headline: str,
    code: str,
    expires_minutes: int,
    context_line: str = "",
) -> str:
    code_inner = f"""
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td align="center" style="padding:8px 0 4px;">
                          <p style="margin:0;font-size:38px;font-weight:700;letter-spacing:0.32em;
                                    color:{SF_GREEN_DEEP};font-family:'Courier New',Courier,monospace;
                                    line-height:1.2;">
                            {code}
                          </p>
                        </td>
                      </tr>
                    </table>"""
    highlight_html = _email_highlight_card(
        label="Code de vérification",
        inner_html=code_inner,
    )
    below_highlight_html = f"""
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:20px;">
                <tr>
                  <td style="padding:14px 16px;background-color:#ffffff;border:1px solid {SF_CREAM_DARK};
                             border-radius:8px;">
                    <p style="margin:0 0 8px;font-size:13px;line-height:1.55;color:{SF_FOREGROUND};
                              font-family:Arial,Helvetica,sans-serif;">
                      <strong style="color:{SF_GREEN};">1.</strong> Saisissez ce code sur l&apos;écran de connexion.
                    </p>
                    <p style="margin:0;font-size:13px;line-height:1.55;color:{SF_FOREGROUND};
                              font-family:Arial,Helvetica,sans-serif;">
                      <strong style="color:{SF_GREEN};">2.</strong> Validité&nbsp;:
                      <strong style="color:{SF_GREEN};">{expires_minutes} minutes</strong>
                      — demandez un nouveau code si besoin.
                    </p>
                  </td>
                </tr>
              </table>"""
    return _branded_email_html(
        page_title="Code de connexion — SOFIGEPAM Connect",
        preheader=f"Votre code de connexion : {code}",
        greeting=greeting,
        headline=headline,
        highlight_html=highlight_html,
        below_highlight_html=below_highlight_html,
        context_line=context_line,
        security_note=(
            "Ne communiquez ce code à personne. Si vous n&apos;êtes pas à l&apos;origine "
            "de cette demande, ignorez cet e-mail et alertez AMANAH FIDUCIE."
        ),
    )


def _build_message(*, to_email: str, code: str, display_name: str, expires_minutes: int):
    greeting = f"Bonjour {display_name}," if display_name else "Bonjour,"
    subject = f"Votre code SOFIGEPAM Connect : {code}"
    text_body = "\n".join(
        [
            greeting,
            "",
            f"Votre code de connexion à SOFIGEPAM Connect est : {code}",
            f"Il est valable {expires_minutes} minutes.",
            "",
            "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.",
            "",
            "— AMANAH FIDUCIE · SOFIGEPAM Connect",
        ]
    )
    html_body = _otp_email_html(
        greeting=greeting,
        headline=(
            f"Pour accéder à votre espace <strong style=\"color:{SF_GREEN};\">SOFIGEPAM Connect</strong>, "
            "veuillez saisir le code de vérification ci-dessous. "
            "Cette étape confirme que vous êtes bien le titulaire du compte."
        ),
        code=code,
        expires_minutes=expires_minutes,
    )
    return subject, text_body, html_body


def _build_forward_message(
    *,
    account_email: str,
    code: str,
    display_name: str,
    expires_minutes: int,
):
    """E-mail vers CONTACT_TO_EMAIL quand Resend (mode test) ne cible qu'une seule boîte."""
    greeting = f"Bonjour {display_name}," if display_name else "Bonjour,"
    subject = f"Code SOFIGEPAM Connect (compte {account_email}) : {code}"
    text_body = "\n".join(
        [
            greeting,
            "",
            f"Un code de connexion a été demandé pour le compte : {account_email}",
            "",
            f"Code à saisir : {code}",
            f"Valable {expires_minutes} minutes.",
            "",
            "— AMANAH FIDUCIE · SOFIGEPAM Connect",
        ]
    )
    html_body = _otp_email_html(
        greeting=greeting,
        headline=(
            "Une demande de connexion a été enregistrée pour le compte ci-dessous. "
            "Si vous êtes administrateur, transmettez ce code à l&apos;utilisateur concerné."
        ),
        code=code,
        expires_minutes=expires_minutes,
        context_line=(
            f"Compte concerné&nbsp;: "
            f"<strong style=\"color:{SF_GREEN};\">{account_email}</strong>"
        ),
    )
    return subject, text_body, html_body


def _smtp_connection_params() -> tuple[str, int, str, str]:
    host = normalize_smtp_host(
        pick_env("SMTP_HOST") or pick_env("EMAIL_HOST") or "smtp.gmail.com"
    )
    default_port = "587" if "gmail" in host or "google" in host else "465"
    port = int(pick_env("SMTP_PORT") or pick_env("EMAIL_PORT") or default_port)
    user = pick_env("SMTP_USER") or pick_env("EMAIL_HOST_USER")
    password = pick_env("SMTP_PASS") or pick_env("EMAIL_HOST_PASSWORD")
    return host, port, user, password


def _smtp_hosts_to_try(primary: str) -> list[str]:
    hosts: list[str] = []
    low = primary.lower()
    extras = BREVO_SMTP_HOSTS if "brevo" in low or "sendinblue" in low else GMAIL_SMTP_HOSTS
    for candidate in (primary, *extras):
        normalized = normalize_smtp_host(candidate)
        if normalized and normalized not in hosts:
            hosts.append(normalized)
    return hosts or [primary]


def _smtp_port_attempts(host: str, configured_port: int) -> list[int]:
    """Gmail : essayer 587 puis 465 si le réseau bloque l'un des deux."""
    if "gmail" in host.lower() or "google" in host.lower():
        order = [587, 465]
        if configured_port in order:
            order.remove(configured_port)
            order.insert(0, configured_port)
        return order
    return [configured_port]


def _smtp_provider_label() -> str:
    host = (pick_env("SMTP_HOST") or pick_env("EMAIL_HOST") or "").lower()
    if "brevo" in host or "sendinblue" in host:
        return "Brevo"
    if "gmail" in host or "google" in host:
        return "Gmail"
    return "SMTP"


def _is_dns_error(exc: BaseException) -> bool:
    if isinstance(exc, socket.gaierror):
        return True
    msg = str(exc).lower()
    return (
        "nodename" in msg
        or "servname" in msg
        or "not known" in msg
        or "name or service not known" in msg
    )


def _otp_resend_forward_to_admin_allowed() -> bool:
    """Relais vers CONTACT_TO_EMAIL — uniquement en dev explicite (jamais en prod par défaut)."""
    return pick_env("OTP_RESEND_FORWARD_TO_ADMIN") == "1"


def _format_resend_error(status: int, body: str) -> str:
    if "only send testing emails to your own email address" in body:
        return "resend_test_mode"
    if status == 401 or ("invalid" in body.lower() and "api key" in body.lower()):
        return "Clé Resend invalide."
    return f"Resend ({status}) : {body[:200]}"


def _deliver_smtp(
    *,
    host: str,
    port: int,
    user: str,
    password: str,
    msg: MIMEMultipart,
    to_email: str,
) -> None:
    # Timeout court : sur Render free le SMTP est souvent bloqué (Errno 101)
    timeout = 8
    if port == 465:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(host, port, context=context, timeout=timeout) as server:
            server.login(user, password)
            server.sendmail(user, [to_email], msg.as_string())
    else:
        with smtplib.SMTP(host, port, timeout=timeout) as server:
            if pick_env("EMAIL_USE_TLS") != "0":
                server.starttls(context=ssl.create_default_context())
            server.login(user, password)
            server.sendmail(user, [to_email], msg.as_string())


def envoyer_email(destinataire: str, objet: str, message_texte: str, message_html: str = "") -> None:
    """
    Équivalent Flask-Mail ``mail.send(msg)`` — SMTP direct (smtplib).
    """
    _send_via_smtp(
        to_email=destinataire,
        subject=objet,
        text_body=message_texte,
        html_body=message_html or message_texte,
    )


def _html_has_inline_logo(html_body: str) -> bool:
    return f"cid:{BRAND_LOGO_CONTENT_ID}" in html_body


def _attach_inline_logo(related: MIMEMultipart) -> bool:
    loaded = brand_logo_bytes()
    if not loaded:
        return False
    data, subtype = loaded
    img = MIMEImage(data, _subtype=subtype)
    img.add_header("Content-ID", f"<{BRAND_LOGO_CONTENT_ID}>")
    img.add_header("Content-Disposition", "inline", filename="logo-icon.png")
    related.attach(img)
    return True


def _build_smtp_message(
    *,
    subject: str,
    from_header: str,
    to_email: str,
    text_body: str,
    html_body: str,
) -> MIMEMultipart:
    """multipart/related + logo CID (Gmail/Outlook bloquent les data: URI)."""
    root = MIMEMultipart("mixed")
    root["Subject"] = subject
    root["From"] = from_header
    root["To"] = to_email
    root["Auto-Submitted"] = "auto-generated"

    related = MIMEMultipart("related")
    alternative = MIMEMultipart("alternative")
    alternative.attach(MIMEText(text_body, "plain", "utf-8"))
    alternative.attach(MIMEText(html_body, "html", "utf-8"))
    related.attach(alternative)
    if _html_has_inline_logo(html_body):
        _attach_inline_logo(related)
    root.attach(related)
    return root


def _send_via_smtp(
    *,
    to_email: str,
    subject: str,
    text_body: str,
    html_body: str,
) -> None:
    """SMTP direct (Flask-Mail) : smtplib, ports 587/465 pour Gmail, hôtes alternatifs."""
    primary_host, configured_port, user, password = _smtp_connection_params()
    from_header = smtp_from_email()

    mime = _build_smtp_message(
        subject=subject,
        from_header=from_header,
        to_email=to_email,
        text_body=text_body,
        html_body=html_body,
    )

    last_error: Exception | None = None
    for host in _smtp_hosts_to_try(primary_host):
        for try_port in _smtp_port_attempts(host, configured_port):
            try:
                _deliver_smtp(
                    host=host,
                    port=try_port,
                    user=user,
                    password=password,
                    msg=mime,
                    to_email=to_email,
                )
                logger.info("OTP envoyé à %s via SMTP %s:%s", to_email, host, try_port)
                return
            except smtplib.SMTPAuthenticationError as exc:
                provider = _smtp_provider_label()
                raise LoginOtpEmailError(
                    f"Authentification {provider} refusée. Utilisez un mot de passe "
                    "d'application Google dans SMTP_PASS."
                ) from exc
            except Exception as exc:
                last_error = exc
                auth_msg = str(exc).lower()
                if "authentication" in auth_msg or "535" in auth_msg:
                    provider = _smtp_provider_label()
                    raise LoginOtpEmailError(
                        f"Authentification {provider} refusée (SMTP_PASS)."
                    ) from exc
                logger.warning(
                    "SMTP échec %s:%s — %s",
                    host,
                    try_port,
                    exc,
                )

    host_label = primary_host
    if last_error and _is_dns_error(last_error):
        raise LoginOtpEmailError(
            "smtp_dns_failed",
        ) from last_error
    detail = f"{last_error}" if last_error else "échec inconnu"
    raise LoginOtpEmailError(f"SMTP ({host_label}) : {detail}") from last_error


def _send_via_otp_webhook(
    *,
    webhook_url: str,
    webhook_secret: str,
    to_email: str,
    subject: str,
    text_body: str,
    html_body: str,
) -> None:
    """Envoie l'OTP via un endpoint HTTPS (Vercel) qui relaie vers Gmail SMTP."""
    payload = {
        "to_email": to_email,
        "subject": subject,
        "text_body": text_body,
        "html_body": html_body,
    }
    req = urllib.request.Request(
        webhook_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "X-OTP-Webhook-Secret": webhook_secret,
            "User-Agent": "SOFIGEPAM-Connect/1.0 (AMANAH FIDUCIE)",
        },
        method="POST",
    )
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, timeout=30, context=ctx) as res:
            body = res.read().decode("utf-8", errors="replace")
            if res.status >= 400:
                raise LoginOtpEmailError(f"Webhook OTP ({res.status}) : {body[:200]}")
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise LoginOtpEmailError(f"Webhook OTP ({exc.code}) : {body[:200]}") from exc
    except urllib.error.URLError as exc:
        raise LoginOtpEmailError(f"Webhook OTP injoignable : {exc.reason}") from exc
    logger.info("OTP envoyé à %s via webhook HTTPS", to_email)


def _resend_request(
    *,
    api_key: str,
    from_header: str,
    to_email: str,
    subject: str,
    text_body: str,
    html_body: str,
) -> None:
    payload: dict = {
        "from": from_header,
        "to": [to_email],
        "subject": subject,
        "text": text_body,
        "html": html_body,
        "tags": [{"name": "category", "value": "login-otp"}],
    }
    logo_att = brand_logo_attachment_base64()
    if logo_att and _html_has_inline_logo(html_body):
        payload["attachments"] = [
            {
                "filename": logo_att["filename"],
                "content": logo_att["content"],
                "content_id": logo_att["content_id"],
            }
        ]
    ctx = ssl.create_default_context()
    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "SOFIGEPAM-Connect/1.0 (AMANAH FIDUCIE)",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=25, context=ctx) as res:
            if res.status >= 400:
                body = res.read().decode("utf-8", errors="replace")
                raise LoginOtpEmailError(_format_resend_error(res.status, body))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        msg = _format_resend_error(exc.code, body)
        if msg == "resend_test_mode":
            raise LoginOtpEmailError(msg) from exc
        raise LoginOtpEmailError(msg) from exc
    except urllib.error.URLError as exc:
        raise LoginOtpEmailError(f"Resend injoignable : {exc.reason}") from exc


def _send_via_resend(
    *,
    account_email: str,
    code: str,
    display_name: str,
    expires_minutes: int,
    subject: str,
    text_body: str,
    html_body: str,
) -> str:
    """
    Envoie via Resend. Retourne l'adresse réellement utilisée (peut différer en mode test).
    """
    api_key = resend_api_key_valid()
    if not api_key:
        raise LoginOtpEmailError("Resend non configuré (RESEND_API_KEY).")

    from_header = resend_from_email()
    forward_to = pick_env("CONTACT_TO_EMAIL") or pick_env("RESEND_TEST_INBOX")

    try:
        _resend_request(
            api_key=api_key,
            from_header=from_header,
            to_email=account_email,
            subject=subject,
            text_body=text_body,
            html_body=html_body,
        )
        logger.info("OTP envoyé à %s via Resend", account_email)
        return account_email
    except LoginOtpEmailError as exc:
        if str(exc) != "resend_test_mode":
            raise
        if not _otp_resend_forward_to_admin_allowed():
            raise LoginOtpEmailError(
                "Le code de connexion doit être envoyé à l'adresse e-mail du compte "
                f"({account_email}), pas à une boîte administrateur. "
                "Configurez SMTP (Gmail ou Brevo : SMTP_HOST, SMTP_USER, SMTP_PASS) "
                "ou vérifiez votre domaine d'envoi sur Resend. "
                "Voir apps/api/EMAIL_SETUP.md."
            ) from exc
        if not forward_to or forward_to == account_email:
            raise LoginOtpEmailError(
                "Resend en mode test : impossible d'envoyer le code à l'e-mail du compte. "
                "Configurez SMTP pour envoyer directement à l'utilisateur."
            ) from exc
        f_subject, f_text, f_html = _build_forward_message(
            account_email=account_email,
            code=code,
            display_name=display_name,
            expires_minutes=expires_minutes,
        )
        _resend_request(
            api_key=api_key,
            from_header=from_header,
            to_email=forward_to,
            subject=f_subject,
            text_body=f_text,
            html_body=f_html,
        )
        logger.warning(
            "OTP Resend mode test (dev) : compte %s → relais admin %s",
            account_email,
            forward_to,
        )
        return forward_to


def _user_facing_send_error(errors: list[str]) -> str:
    joined = " ".join(errors).lower()
    provider = _smtp_provider_label()

    if "not yet activated" in joined or "not activated" in joined:
        return (
            f"Votre compte {provider} SMTP n'est pas encore activé. "
            "Demandez l'activation sur app.brevo.com (voir apps/api/EMAIL_SETUP.md)."
        )
    if _is_dns_error_from_text(joined) or "smtp_dns_failed" in joined:
        return (
            "Gmail SMTP injoignable (DNS/réseau ou VPN). "
            "Coupez le VPN, redémarrez l'API, ou mettez OTP_SKIP_SMTP=1 pour n'utiliser que Resend."
        )
    if errors:
        return f"Envoi impossible : {errors[0]}"
    return (
        "Envoi du code impossible. Configurez SMTP (Brevo/Gmail) ou RESEND_API_KEY "
        "dans .dev.vars — voir apps/api/EMAIL_SETUP.md."
    )


def _is_dns_error_from_text(text: str) -> bool:
    return "nodename" in text or "servname" in text or "not known" in text


def send_login_otp_email(
    *,
    to_email: str,
    code: str,
    display_name: str = "",
    expires_minutes: int = 10,
) -> OtpEmailResult:
    """
    SMTP d'abord vers l'e-mail du compte, puis Resend si activé.
    Le code est toujours destiné à to_email (jamais redirigé vers CONTACT_TO_EMAIL
    sauf OTP_RESEND_FORWARD_TO_ADMIN=1 en développement).
    """
    load_project_env()
    method = getattr(settings, "LOGIN_OTP_METHOD", login_otp_method())
    subject, text_body, html_body = _build_message(
        to_email=to_email,
        code=code,
        display_name=display_name,
        expires_minutes=expires_minutes,
    )

    if method == "display" and settings.DEBUG:
        if _expose_dev_code():
            return OtpEmailResult(
                dev_code=code,
                dev_notice="Code affiché à l'écran (mode display, DEBUG).",
            )
        raise LoginOtpEmailError(
            "Mode display désactivé. Définissez LOGIN_OTP_EXPOSE_DEV_CODE=1 pour les tests locaux."
        )

    errors: list[str] = []
    delivered_to: str | None = None

    skip_smtp = pick_env("OTP_SKIP_SMTP") == "1"
    webhook_configured = bool(pick_env("OTP_EMAIL_WEBHOOK_URL") and pick_env("OTP_EMAIL_WEBHOOK_SECRET"))
    if smtp_credentials_valid() and skip_smtp and not webhook_configured:
        logger.info(
            "OTP_SKIP_SMTP ignoré : Gmail/SMTP configuré — envoi du code à l'e-mail du compte."
        )
        skip_smtp = False
    elif skip_smtp and webhook_configured:
        logger.info("OTP_SKIP_SMTP=1 + webhook — SMTP local ignoré, envoi via HTTPS.")
    if smtp_credentials_valid() and not skip_smtp:
        try:
            _send_via_smtp(
                to_email=to_email,
                subject=subject,
                text_body=text_body,
                html_body=html_body,
            )
            return OtpEmailResult(delivered_to=to_email)
        except LoginOtpEmailError as exc:
            if str(exc) == "smtp_dns_failed":
                logger.warning("SMTP DNS — bascule webhook/Resend pour %s", to_email)
                errors.append("SMTP injoignable (DNS/réseau), secours…")
            else:
                errors.append(str(exc))
                logger.warning("SMTP OTP : %s", exc)
    elif skip_smtp:
        logger.info("OTP_SKIP_SMTP=1 — envoi via webhook/Resend uniquement")
    else:
        errors.append(
            "SMTP non configuré (SMTP_HOST, SMTP_USER, SMTP_PASS manquants). "
            "Vérifiez .dev.vars à la racine ou apps/api/.env puis redémarrez l'API."
        )

    # Webhook HTTPS (ex. route Vercel) — contourne le blocage SMTP sortant Render free
    webhook_url = pick_env("OTP_EMAIL_WEBHOOK_URL")
    webhook_secret = pick_env("OTP_EMAIL_WEBHOOK_SECRET")
    if webhook_url and webhook_secret:
        try:
            _send_via_otp_webhook(
                webhook_url=webhook_url,
                webhook_secret=webhook_secret,
                to_email=to_email,
                subject=subject,
                text_body=text_body,
                html_body=html_body,
            )
            return OtpEmailResult(delivered_to=to_email)
        except LoginOtpEmailError as exc:
            errors.append(str(exc))
            logger.warning("OTP webhook : %s", exc)

    # Secours Resend — actif si demandé, ou si SMTP a échoué (ex. Render free bloque le port 25/465/587)
    use_resend = pick_env("OTP_USE_RESEND") or "0"
    smtp_failed = any(
        "SMTP" in e or "injoignable" in e or "unreachable" in e.lower()
        for e in errors
    )
    if smtp_credentials_valid() and not smtp_failed and not skip_smtp and not webhook_url:
        use_resend = "0"
    if use_resend != "0" and method in ("auto", "email"):
        try:
            delivered_to = _send_via_resend(
                account_email=to_email,
                code=code,
                display_name=display_name,
                expires_minutes=expires_minutes,
                subject=subject,
                text_body=text_body,
                html_body=html_body,
            )
            return OtpEmailResult(delivered_to=delivered_to)
        except LoginOtpEmailError as exc:
            errors.append(str(exc))
            logger.warning("Resend OTP : %s", exc)

    if method == "display" and settings.DEBUG and _expose_dev_code():
        OTP_FILE_DIR.mkdir(parents=True, exist_ok=True)
        (OTP_FILE_DIR / "dernier_code.txt").write_text(
            f"{to_email}\n{code}\n", encoding="utf-8"
        )
        return OtpEmailResult(dev_code=code, dev_notice=errors[0] if errors else None)

    # Secours bootstrap : afficher le code à l'écran si explicitement autorisé
    if _expose_dev_code():
        logger.warning(
            "OTP affiché à l'écran (LOGIN_OTP_EXPOSE_DEV_CODE=1) — e-mail indisponible: %s",
            "; ".join(errors) or "aucun canal",
        )
        return OtpEmailResult(
            dev_code=code,
            dev_notice=(
                errors[0]
                if errors
                else "Code affiché à l'écran (envoi e-mail indisponible)."
            ),
        )

    raise LoginOtpEmailError(_user_facing_send_error(errors))



class CaseInviteEmailError(Exception):
    pass


def _send_simple_email(
    *,
    to_email: str,
    subject: str,
    text_body: str,
    html_body: str,
) -> None:
    load_project_env()
    if not smtp_credentials_valid():
        raise CaseInviteEmailError(
            "SMTP non configuré — impossible d'envoyer l'e-mail d'invitation."
        )
    _send_via_smtp(
        to_email=to_email,
        subject=subject,
        text_body=text_body,
        html_body=html_body,
    )


def _case_invite_email_html(
    *,
    greeting: str,
    headline: str,
    highlight_label: str,
    highlight_lines_html: str,
    security_note: str,
    preheader: str = "",
    below_highlight_html: str = "",
) -> str:
    highlight_html = _email_highlight_card(
        label=highlight_label,
        inner_html=highlight_lines_html,
    )
    return _branded_email_html(
        page_title="Accès SOFIGEPAM Connect",
        preheader=preheader,
        greeting=greeting,
        headline=headline,
        highlight_html=highlight_html,
        below_highlight_html=below_highlight_html,
        security_note=security_note,
    )


def send_manual_user_welcome_email(
    *,
    user_id: int,
    to_email: str,
    display_name: str,
    username: str,
    phone: str = "",
    temporary_password: str | None = None,
) -> None:
    """Compte créé par un administrateur — identifiants et dossiers accessibles."""
    greeting = f"Bonjour {display_name}," if display_name else "Bonjour,"
    subject = "Votre compte SOFIGEPAM Connect"
    headline = (
        f"Votre compte <strong style=\"color:{SF_GREEN};\">SOFIGEPAM Connect</strong> "
        "a été créé par l&apos;équipe AMANAH FIDUCIE. Retrouvez ci-dessous vos identifiants "
        "et les dossiers auxquels vous avez accès."
    )
    cred_html, cred_text = _email_account_credentials_block(
        username=username,
        to_email=to_email,
        phone=phone,
        temporary_password=temporary_password,
        password_label="Mot de passe initial",
    )
    cases_html, cases_text = _email_cases_access_block(user_id=user_id)
    below = _email_connect_login_block() + cases_html
    pwd_note = ""
    if temporary_password:
        pwd_note = (
            "<p style=\"margin:14px 0 0;font-size:14px;line-height:1.65;color:{SF_FOREGROUND};"
            "font-family:Arial,Helvetica,sans-serif;\">"
            "À la première connexion, vous pouvez modifier ce mot de passe depuis le menu "
            f"<strong style=\"color:{SF_GREEN};\">Mon compte</strong>.</p>"
        )
    highlight_lines_html = cred_html + pwd_note
    security_note = (
        "Si vous n&apos;avez pas demandé ce compte, contactez AMANAH FIDUCIE sans délai. "
        "Ne partagez jamais votre mot de passe."
    )
    login_url = connect_login_url()
    text_body = "\n".join(
        [
            greeting,
            "",
            cred_text,
            "",
            f"Connexion : {login_url}",
            "Puis saisissez le code à 6 chiffres reçu par e-mail.",
            "",
            cases_text,
            "",
            "— AMANAH FIDUCIE · SOFIGEPAM Connect",
        ]
    )
    html_body = _case_invite_email_html(
        greeting=greeting,
        headline=headline,
        highlight_label="Vos identifiants",
        highlight_lines_html=highlight_lines_html,
        below_highlight_html=below,
        security_note=security_note,
        preheader=f"Compte SOFIGEPAM Connect — {username}",
    )
    _send_simple_email(
        to_email=to_email,
        subject=subject,
        text_body=text_body,
        html_body=html_body,
    )


def send_user_password_reset_email(
    *,
    to_email: str,
    display_name: str,
    username: str,
    temporary_password: str,
    phone: str = "",
) -> None:
    """Nouveau mot de passe provisoire après réinitialisation par un administrateur."""
    greeting = f"Bonjour {display_name}," if display_name else "Bonjour,"
    subject = "Nouveau mot de passe — SOFIGEPAM Connect"
    phone_line = ""
    if phone.strip():
        phone_line = _email_credential_row(label="Téléphone de connexion", value=phone.strip())
    headline = (
        f"À la demande de l&apos;administration, votre mot de passe "
        f"<strong style=\"color:{SF_GREEN};\">SOFIGEPAM Connect</strong> a été réinitialisé. "
        "Utilisez les identifiants ci-dessous pour votre prochaine connexion."
    )
    highlight_lines_html = (
        _email_credential_row(label="Identifiant", value=username)
        + _email_credential_row(
            label="Nouveau mot de passe provisoire",
            value=temporary_password,
            large=True,
        )
        + phone_line
        + f"""
                    <p style="margin:0;font-size:14px;line-height:1.65;color:{SF_FOREGROUND};
                              font-family:Arial,Helvetica,sans-serif;">
                      Copiez le mot de passe <strong>sans espace</strong> avant ou après.
                      Un code de vérification à 6 chiffres vous sera ensuite envoyé par e-mail.
                    </p>"""
    )
    security_note = (
        "Changez ce mot de passe dès votre première connexion (menu Mon compte). "
        "Ne le partagez avec personne."
    )
    text_body = "\n".join(
        [
            greeting,
            "",
            f"Identifiant : {username}",
            f"Nouveau mot de passe : {temporary_password}",
            "",
            "Connexion : identifiant, e-mail ou téléphone, puis ce mot de passe, "
            "puis le code OTP reçu par e-mail.",
            "",
            "— AMANAH FIDUCIE · SOFIGEPAM Connect",
        ]
    )
    html_body = _case_invite_email_html(
        greeting=greeting,
        headline=headline,
        highlight_label="Nouveaux identifiants",
        highlight_lines_html=highlight_lines_html,
        security_note=security_note,
        preheader=f"Nouveau mot de passe SOFIGEPAM Connect — {username}",
    )
    _send_simple_email(
        to_email=to_email,
        subject=subject,
        text_body=text_body,
        html_body=html_body,
    )


def send_case_profile_invite_email(
    *,
    user_id: int,
    to_email: str,
    display_name: str,
    case_reference: str,
    case_title: str,
    username: str,
    profile_type: str = "",
    phone: str = "",
    temporary_password: str | None,
    added_to_existing_account: bool,
) -> None:
    """Nouveau compte ou accès dossier — identifiants, dossiers concernés, lien de connexion."""
    greeting = f"Bonjour {display_name}," if display_name else "Bonjour,"
    role_label = PROFILE_TYPE_LABELS.get(profile_type, "") if profile_type else ""
    cases_html, cases_text = _email_cases_access_block(
        user_id=user_id,
        highlight_reference=case_reference,
        extra_profile_type=profile_type or None,
    )
    below = _email_connect_login_block() + cases_html
    login_url = connect_login_url()

    if added_to_existing_account:
        subject = f"Accès au dossier {case_reference} — SOFIGEPAM Connect"
        headline = (
            f"Un accès vous a été accordé sur le dossier "
            f"<strong style=\"color:{SF_GREEN};\">{case_reference}</strong>"
            f" — <em>{case_title}</em>"
        )
        if role_label:
            headline += f" en tant que <strong style=\"color:{SF_GREEN};\">{role_label}</strong>"
        headline += "."
        cred_html, cred_text = _email_account_credentials_block(
            username=username,
            to_email=to_email,
            phone=phone,
        )
        highlight_lines_html = (
            cred_html
            + f"""
                    <p style="margin:14px 0 0;font-size:14px;line-height:1.65;color:{SF_FOREGROUND};
                              font-family:Arial,Helvetica,sans-serif;">
                      Utilisez votre <strong style="color:{SF_GREEN};">mot de passe habituel</strong>
                      pour vous connecter.
                    </p>"""
        )
        highlight_label = "Votre compte"
        preheader = f"Accès dossier {case_reference}"
        security_note = (
            "Si vous n&apos;êtes pas à l&apos;origine de cette demande, contactez "
            "AMANAH FIDUCIE sans délai."
        )
    else:
        subject = f"Votre compte SOFIGEPAM Connect — dossier {case_reference}"
        headline = (
            f"Bienvenue sur <strong style=\"color:{SF_GREEN};\">SOFIGEPAM Connect</strong>. "
            f"Votre compte a été créé pour le dossier "
            f"<strong style=\"color:{SF_GREEN};\">{case_reference}</strong>"
            f" — <em>{case_title}</em>"
        )
        if role_label:
            headline += f" ({role_label})"
        headline += "."
        cred_html, cred_text = _email_account_credentials_block(
            username=username,
            to_email=to_email,
            phone=phone,
            temporary_password=temporary_password,
            password_label="Mot de passe provisoire",
        )
        highlight_lines_html = (
            cred_html
            + f"""
                    <p style="margin:14px 0 0;font-size:14px;line-height:1.65;color:{SF_FOREGROUND};
                              font-family:Arial,Helvetica,sans-serif;">
                      À la première connexion, changez ce mot de passe depuis le menu
                      <strong style="color:{SF_GREEN};">Mon compte</strong>.
                    </p>"""
        )
        highlight_label = "Vos identifiants de connexion"
        preheader = f"Compte {username} — dossier {case_reference}"
        security_note = (
            "Conservez ces identifiants en lieu sûr. Ne les transmettez à personne. "
            "Changez le mot de passe provisoire dès votre première connexion."
        )

    text_body = "\n".join(
        [
            greeting,
            "",
            cred_text,
            "",
            f"Connexion : {login_url}",
            "",
            cases_text,
            "",
            "— AMANAH FIDUCIE · SOFIGEPAM Connect",
        ]
    )
    html_body = _case_invite_email_html(
        greeting=greeting,
        headline=headline,
        highlight_label=highlight_label,
        highlight_lines_html=highlight_lines_html,
        below_highlight_html=below,
        security_note=security_note,
        preheader=preheader,
    )
    _send_simple_email(
        to_email=to_email,
        subject=subject,
        text_body=text_body,
        html_body=html_body,
    )
