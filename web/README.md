# Web — Prevención y Compliance educativo

Envoltorio publicable de la aplicación (React + Vite). La app funciona en dos modos:

- **Local** (sin `VITE_API_BASE`): guarda en el navegador. Útil para probar sin servidor.
- **Servidor** (con `VITE_API_BASE`): habla con el backend. Es el modo para publicar en internet.

## Probar en tu ordenador

```bash
npm install
npm run dev        # abre la dirección que muestra (modo local)
```

## Publicar (como sitio estático)

```bash
npm install
npm run build      # genera la carpeta dist/
```

Sube el proyecto a un hosting de sitios estáticos (Render Static Site, Netlify o Cloudflare Pages) con:
- **Build command:** `npm install && npm run build`
- **Publish directory:** `dist`
- **Variable de entorno:** `VITE_API_BASE` = la dirección de tu backend (p. ej. `https://tu-backend.onrender.com`).

Al definir `VITE_API_BASE`, la app pasa automáticamente a modo servidor: el consultor inicia sesión y los participantes responden con el código de la sala.

> El inicio de sesión es solo para el consultor. Quien responde con un código de sala no necesita cuenta.
