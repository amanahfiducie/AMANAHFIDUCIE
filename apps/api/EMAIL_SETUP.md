# E-mail OTP — Gmail (équivalent Flask-Mail)

Pas besoin de Flask : Django envoie déjà comme `flask-mail` avec la même config SMTP.

## 1. Mot de passe d'application Google

1. Activez la **validation en 2 étapes** : [Google Account Security](https://myaccount.google.com/security)
2. Créez un **mot de passe d'application** : [Google App Passwords](https://myaccount.google.com/apppasswords) (ex. « SOFIGEPAM Connect »)
3. Copiez les **16 caractères** (sans espaces)

> Ne mettez **jamais** le mot de passe normal de Gmail dans `SMTP_PASS`.

## 2. Fichier `.dev.vars` (racine du projet)

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=amanahfiducie@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
SMTP_FROM_EMAIL=Amanah Fiducie <amanahfiducie@gmail.com>
EMAIL_USE_TLS=1
LOGIN_OTP_METHOD=email
LOGIN_OTP_EXPOSE_DEV_CODE=0
OTP_USE_RESEND=0
```

(`OTP_USE_RESEND=0` une fois Gmail OK — sinon secours Resend en mode test.)

## 3. Équivalence Flask → Django

| Flask-Mail | Ce projet (Django) |
|------------|-------------------|
| `MAIL_SERVER` | `SMTP_HOST` |
| `MAIL_PORT` | `SMTP_PORT` (587) |
| `MAIL_USE_TLS` | `EMAIL_USE_TLS=1` |
| `MAIL_USERNAME` | `SMTP_USER` |
| `MAIL_PASSWORD` | `SMTP_PASS` |
| `mail.send(msg)` | `envoyer_email()` dans `accounts/emails.py` |

## 4. Tester

```bash
cd apps/api
.venv/bin/python manage.py test_otp_email amadyfsy@gmail.com
```

Puis redémarrez l'API :

```bash
.venv/bin/python manage.py runserver 0.0.0.0:8000
```

## 5. Connexion

Identifiant + mot de passe → code reçu sur **l'e-mail du compte** (objet : `Votre code SOFIGEPAM Connect : …`).

Le code **n'est plus affiché à l'écran** (`LOGIN_OTP_EXPOSE_DEV_CODE=0`).

## Brevo (optionnel)

Si vous préférez Brevo une fois le SMTP transactionnel activé :

```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=votre-login@smtp-brevo.com
SMTP_PASS=…
```

## Dépannage

| Erreur | Action |
|--------|--------|
| Authentification refusée | Mot de passe **d'application**, pas le mot de passe Gmail |
| `SMTP_PASS` vide | Renseignez `.dev.vars` puis redémarrez l'API |
| Brevo `not yet activated` | Utilisez Gmail ou attendez l'activation Brevo |
| Resend mode test | Configurez **SMTP** (`OTP_USE_RESEND=0`) pour envoyer le code **à l'e-mail de l'utilisateur**. Relais admin uniquement si `OTP_RESEND_FORWARD_TO_ADMIN=1` (dev). |
