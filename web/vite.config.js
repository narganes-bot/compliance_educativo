import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  build: {
    // El motor compartido (shared/engine/) vive fuera de web/ y está escrito en
    // CommonJS (module.exports) porque también lo usa el backend con require().
    // Sin esto, Vite no lo reconoce como módulo válido al compilar para producción.
    commonjsOptions: { include: [/shared\/engine/, /node_modules/] },
  },
});
