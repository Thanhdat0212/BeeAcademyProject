/// <reference types="vite/client" />

/**
 * Type declaration cho `import.meta.env` của Vite.
 *
 * Vite expose biến môi trường prefix VITE_* qua object này. Khai báo
 * field tại đây để TypeScript autocomplete và type-check.
 */
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
