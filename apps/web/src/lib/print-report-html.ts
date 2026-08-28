/**
 * Imprime / enregistre en PDF le même HTML que l'aperçu.
 * Utilise un iframe caché (évite page blanche + menu de l'app).
 */
export function printReportHtml(
  source: HTMLElement,
  title = "Rapport Amanah Fiducie",
): void {
  const origin = window.location.origin;
  let markup = source.outerHTML;
  // Chemins relatifs → absolus (logos, QR)
  markup = markup.replace(
    /(src|href)=(["'])\/(?!\/)/g,
    (_m, attr: string, q: string) => `${attr}=${q}${origin}/`,
  );

  const safeTitle = title.replace(/[<>&]/g, "");

  const cssLinks = Array.from(
    document.querySelectorAll('link[rel="stylesheet"]'),
  )
    .map((el) => {
      const link = el as HTMLLinkElement;
      const href = link.href || link.getAttribute("href") || "";
      if (!href) return "";
      return `<link rel="stylesheet" href="${href}">`;
    })
    .join("\n");

  const inlineStyles = Array.from(document.querySelectorAll("style"))
    .map((el) => el.outerHTML)
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<title>${safeTitle}</title>
${cssLinks}
${inlineStyles}
<style>
  :root {
    --sf-green-deep: #0f2418;
    --sf-green: #1a3d2a;
    --sf-green-mid: #245a3c;
    --sf-gold: #c9a227;
    --sf-gold-soft: #e8d5a3;
    --sf-cream: #f8f6f0;
    --sf-cream-dark: #ebe6da;
    --background: #ffffff;
    --foreground: #0f2418;
  }
  @page { size: A4; margin: 12mm; }
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
    color: var(--sf-green-deep);
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .print-sheet {
    width: 100%;
    max-width: 186mm;
    margin: 0 auto;
    background: #fff;
    box-sizing: border-box;
  }
  .print-sheet * { box-sizing: border-box; }
  .print-sheet .shadow-sm { box-shadow: none !important; }
</style>
</head>
<body>
  <div class="print-sheet">${markup}</div>
</body>
</html>`;

  const prev = document.getElementById("sf-report-print-frame");
  if (prev) prev.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "sf-report-print-frame";
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    iframe.remove();
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  const imgs = Array.from(doc.images);
  const waitImages = Promise.all(
    imgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          }),
    ),
  );

  void waitImages.then(() => {
    window.setTimeout(() => {
      try {
        win.focus();
        win.print();
      } finally {
        window.setTimeout(() => iframe.remove(), 1500);
      }
    }, 350);
  });
}
