# lámpara

Simulador de riesgo para una cartera argentina en pesos y dólares, con un agente que lee las noticias todos los días y una vista de acciones por escenario.

Herramienta educativa: los supuestos son aproximaciones ilustrativas. No es asesoramiento financiero ni una recomendación de inversión.

- **App publicada:** <https://pedrouriburu.github.io/lampara/> (después de seguir `PENDIENTES.md`)
- **Qué quedó hecho y cómo comprobarlo:** `INFORME.md`
- **Qué falta pegar (claves y cuentas), paso a paso:** `PENDIENTES.md`
- **Por qué está hecho así:** `DECISIONES.md`

## Qué hay en cada carpeta

| Carpeta | Qué contiene |
| --- | --- |
| `src/riesgo/` | Motor de riesgo en TypeScript puro: Monte Carlo, VaR, CVaR, contribución al riesgo, stress tests y conversión pesos/dólares. Corre en un Web Worker. |
| `src/acciones/` | Universo de acciones, escenarios de respaldo y cálculos de la pestaña Acciones por escenario. |
| `src/noticias/` | Ediciones del agente e impacto de cada noticia sobre la cartera. |
| `src/datos/` | Supabase (sesión, cartera, corridas, ediciones), cotización del MEP y llamadas a `explicar`. |
| `src/pantallas/` | Ingreso, Cartera y riesgo, Acciones por escenario, Historial y Supuestos. |
| `agente/` | Agente diario: script, instrucción, esquema de validación y edición de ejemplo. |
| `supabase/` | Migración SQL (tablas, seguridad por filas, carga inicial) y la Edge Function `explicar`. |
| `.github/workflows/` | Publicación en GitHub Pages y corrida diaria del agente. |

## Comandos

Hace falta Node 22 o más nuevo.

```
npm install        instala las dependencias
npm run dev        levanta la app en la computadora
npm test           corre los tests
npm run lint       revisa el código
npm run build      compila la versión que se publica
npm run agente:seco   prueba el agente sin red ni claves
```

Sin claves, la app funciona en modo de demostración: la cartera se guarda en el navegador y el panel de noticias muestra una edición de ejemplo, marcada como tal.
