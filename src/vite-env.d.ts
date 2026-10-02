/// <reference types="vite/client" />

// Set via `define` only in vite.singlefile.config.ts — undefined in the normal dev/deploy build.
declare const __STANDALONE__: boolean | undefined

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
