# Contributing / Cómo contribuir

## English

Thank you for helping improve RetroToon.

1. Open an issue describing the bug or proposed change before starting a large feature.
2. Create a focused branch from `main`; never commit personal playlist links, settings exports, test profiles, build output, or secrets.
3. Install dependencies with `npm ci`.
4. Keep settings-schema changes backward compatible and add tests for migrations.
5. Run `npm run typecheck`, `npm test`, and `npm audit --omit=dev` before opening a pull request.
6. Explain the behavior change and manual verification in the pull request.

User-facing text must be added in both English and Spanish. YouTube integration must continue to use embedded playback without downloading, altering, blocking ads, or redistributing media.

## Español

Gracias por ayudar a mejorar RetroToon.

1. Abre un issue que describa el error o cambio antes de comenzar una función grande.
2. Crea una rama enfocada desde `main`; nunca subas enlaces personales, configuraciones exportadas, perfiles de prueba, builds ni secretos.
3. Instala dependencias con `npm ci`.
4. Mantén compatibles los cambios del esquema y añade pruebas de migración.
5. Ejecuta `npm run typecheck`, `npm test` y `npm audit --omit=dev` antes del pull request.
6. Explica el cambio y la verificación manual en el pull request.

Todo texto visible debe añadirse en inglés y español. La integración con YouTube debe seguir usando reproducción embebida sin descargar, modificar, bloquear anuncios ni redistribuir contenido.
