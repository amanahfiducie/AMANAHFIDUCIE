/**
 * Crée `.env` et `.dev.vars` à partir des exemples s’ils n’existent pas encore.
 * À la première création de `.dev.vars`, ajoute SKIP_CONTACT_EMAIL=1 pour que
 * le formulaire contact fonctionne en local sans Resend/SMTP (à retirer en prod).
 */
import { appendFileSync, copyFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function ensureFile(fromName, toName) {
  const fromPath = join(root, fromName);
  const toPath = join(root, toName);
  if (!existsSync(fromPath)) {
    console.warn(`[env-init] Fichier manquant : ${fromName} (ignoré).`);
    return { created: false, path: toPath };
  }
  if (existsSync(toPath)) {
    return { created: false, path: toPath };
  }
  copyFileSync(fromPath, toPath);
  console.log(`[env-init] Créé ${toName} à partir de ${fromName}.`);
  return { created: true, path: toPath };
}

function appendSkipIfNeeded(filePath, label) {
  let content;
  try {
    content = readFileSync(filePath, "utf8");
  } catch {
    return;
  }
  if (/^SKIP_CONTACT_EMAIL=/m.test(content)) return;
  appendFileSync(
    filePath,
    `\n# ${label}\nSKIP_CONTACT_EMAIL=1\n`,
    "utf8",
  );
  console.log(`[env-init] ${filePath}: SKIP_CONTACT_EMAIL=1 ajouté (formulaire contact en local sans API mail).`);
}

const devVars = ensureFile(".dev.vars.example", ".dev.vars");
if (devVars.created) {
  appendSkipIfNeeded(devVars.path, "Premier lancement — retirez cette ligne et définissez RESEND_API_KEY pour de vrais envois.");
}

const dotEnv = ensureFile(".env.example", ".env");
if (dotEnv.created) {
  appendSkipIfNeeded(dotEnv.path, "Premier lancement — optionnel si vous utilisez uniquement .dev.vars (Cloudflare).");
}
