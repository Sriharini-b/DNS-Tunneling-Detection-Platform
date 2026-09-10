/// <reference types="vite/client" />

// Extend ImportMeta with Vite env variables
interface ImportMetaEnv {
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
