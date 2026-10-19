// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
  // oxlint-disable-next-line eslint/no-underscore-dangle -- build-time constant injected via Vite `define`
  const __APP_VERSION__: string;

  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

// oxlint-disable-next-line unicorn/require-module-specifiers -- marks this file as a module so `declare global` is allowed
export {};
