// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

/** Sur Vercel : Nitro (preset vercel) ; en local : bundle Cloudflare (dist/) inchangé. */
export default defineConfig(async () => {
  const onVercel = process.env.VERCEL === "1";
  const plugins = [];
  if (onVercel) {
    const { nitro } = await import("nitro/vite");
    plugins.push(nitro({ preset: "vercel" }));
  }
  return {
    cloudflare: onVercel ? false : undefined,
    plugins,
  };
});
