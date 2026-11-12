# Decisiones

Cada vez que la especificación dejaba algo abierto, tomé la opción más razonable y la anoté acá: qué decidí y por qué.

## Fase 1 · Base

1. **Carpeta del proyecto: `C:\Users\pilar\Downloads\lampara`.** La especificación está en `OneDrive\Escritorio\Lampara`, pero un proyecto de Node dentro de OneDrive sincroniza decenas de miles de archivos de `node_modules`, ocupa espacio en la nube y suele trabar la instalación. Lo armé fuera de OneDrive, al lado de `habitos`.
2. **oxlint en lugar de ESLint.** La plantilla actual de Vite trae TypeScript 7 y oxlint. `typescript-eslint` todavía no acepta TypeScript 7 (pide una versión menor a 6.1), así que instalar ESLint obligaba a bajar el compilador. Dejé oxlint con las reglas de React y TypeScript: cumple la misma función y `npm run lint` pasa.
3. **Rutas relativas (`base: './'`) y navegación por `#`.** Así la misma compilación funciona en `pedrouriburu.github.io/lampara`, en la raíz de otro dominio y en `npm run preview`, y GitHub Pages no necesita reglas para rutas internas.
4. **Autor de los commits: `Pedrouriburu@users.noreply.github.com`.** El repositorio va a ser público (GitHub Pages gratis lo exige) y preferí no dejar tu mail personal escrito en el historial. GitHub igual te atribuye los commits.
5. **Sin acceso a GitHub desde esta sesión.** No está instalada la herramienta `gh` ni hay una sesión iniciada, así que trabajé con git local. Crear el repositorio y subirlo quedó en `PENDIENTES.md`, con los pasos.
6. **Diseño copiado del prototipo.** Pude abrir el prototipo de claude.ai: la hoja de estilos, los textos y la lógica del motor salen de ahí, pasados a React y TypeScript.
