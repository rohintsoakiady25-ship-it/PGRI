/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Adresse de l'API (par défaut : /api, relayé par Vite vers le backend). */
  readonly VITE_API_URL?: string;
  /** Adresse publique du frontend utilisée dans le QR code du planning (par défaut : l'adresse courante). */
  readonly VITE_URL_PUBLIQUE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
