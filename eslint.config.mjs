import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextVitals,
  { rules: { 'react-hooks/set-state-in-effect': 'off' } },
  { files: ['components/VaultView.tsx'], rules: { 'react-hooks/immutability': 'off' } },
  globalIgnores(['.next*/**', 'out/**', 'build/**', 'next-env.d.ts']),
]);