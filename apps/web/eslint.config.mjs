import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

// Next 15.5 deprecated `next lint`; the recommended path is the ESLint CLI with
// a flat config. `eslint-config-next` still ships legacy (.eslintrc) presets, so
// we bridge them into flat config via FlatCompat.
const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

const eslintConfig = [
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals"),
];

export default eslintConfig;
