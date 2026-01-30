/// <reference types="vite/client" />

// Vite asset imports
declare module '*?url' {
  const src: string;
  export default src;
}

declare module '*.mjs?url' {
  const src: string;
  export default src;
}
