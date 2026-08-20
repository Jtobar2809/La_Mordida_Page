import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    // Mismo alias que tsconfig. Se declara a mano en vez de con
    // vite-tsconfig-paths porque ese plugin arrastra un vite que exige un
    // @types/node más nuevo del que tiene fijado el proyecto.
    alias: { "@": resolve(__dirname, "./src") },
  },
  test: {
    environment: "node",
    // Solo la matemática pura: nada que toque la base de datos ni React. Estas
    // pruebas corren en segundos y por eso se corren de verdad.
    include: ["src/**/*.test.ts"],
  },
});
