# Decisiones

Cada vez que la especificación dejaba algo abierto, tomé la opción más razonable y la anoté acá: qué decidí y por qué.

## Fase 1 · Base

1. **Carpeta del proyecto: `C:\Users\pilar\Downloads\lampara`.** La especificación está en `OneDrive\Escritorio\Lampara`, pero un proyecto de Node dentro de OneDrive sincroniza decenas de miles de archivos de `node_modules`, ocupa espacio en la nube y suele trabar la instalación. Lo armé fuera de OneDrive, al lado de `habitos`.
2. **oxlint en lugar de ESLint.** La plantilla actual de Vite trae TypeScript 7 y oxlint. `typescript-eslint` todavía no acepta TypeScript 7 (pide una versión menor a 6.1), así que instalar ESLint obligaba a bajar el compilador. Dejé oxlint con las reglas de React y TypeScript: cumple la misma función y `npm run lint` pasa.
3. **Rutas relativas (`base: './'`) y navegación por `#`.** Así la misma compilación funciona en `pedrouriburu.github.io/lampara`, en la raíz de otro dominio y en `npm run preview`, y GitHub Pages no necesita reglas para rutas internas.
4. **Autor de los commits: `Pedrouriburu@users.noreply.github.com`.** El repositorio va a ser público (GitHub Pages gratis lo exige) y preferí no dejar tu mail personal escrito en el historial. GitHub igual te atribuye los commits.
5. **Sin acceso a GitHub desde esta sesión.** No está instalada la herramienta `gh` ni hay una sesión iniciada, y el repositorio `Pedrouriburu/lampara` todavía no existe. Trabajé con git local, dejé configurada la dirección del repositorio y anoté los pasos en `PENDIENTES.md`.
6. **Diseño copiado del prototipo.** Pude abrir el prototipo de claude.ai: la hoja de estilos, los textos y la lógica del motor salen de ahí, pasados a React y TypeScript.

## Fase 2 · Motor de riesgo

7. **El CVaR se calcula como la suma de las contribuciones.** El prototipo calculaba las dos cosas por separado y coincidían salvo por redondeo de coma flotante. Definiéndolo como la suma, "las contribuciones suman exactamente el CVaR" se cumple al bit. Un test aparte lo compara con la fórmula cerrada para un activo lognormal, así que el valor sigue controlado de forma independiente.
8. **VaR 99% dentro de la tarjeta del VaR 95%.** La especificación pide las dos métricas y la franja del prototipo tenía siete tarjetas; sumé el 99% como dato secundario para no agregar una octava.
9. **El VaR a un mes puede moverse unas décimas al cambiar el horizonte.** Con la misma semilla, un horizonte más largo consume más números al azar por trayectoria y la muestra del primer mes cambia. Es error de muestreo (5.000 trayectorias), igual que en el prototipo; no es un cambio real del riesgo.

## Fase 3 · Cartera y riesgo

10. **El MEP se completa solo desde dolarapi.com, y el riesgo país sale de argentinadatos.com.** Verifiqué el 12/11/2026 que las dos responden, que aceptan llamadas desde el navegador y qué dicen sus páginas de uso (actualizadas el 15/10/2026): se pueden consultar y usar las respuestas; piden citar el servicio en lo que se publique y sugieren no consultar cada serie más de una vez cada 3 horas; avisan que pueden interrumpirse sin aviso. Por eso el pie de la app cita a DolarApi y a ArgentinaDatos con enlace, la cotización se guarda 3 horas en el navegador antes de volver a pedirla y el agente consulta una vez por día. Mientras no llega la cotización se usa la referencia de la especificación ($ 1.585, cierre del 4/11/2026 de Rava), y al lado del campo siempre dice de dónde salió el número. Si lo editás, queda el tuyo hasta que toques "usar el del día".
11. **Fechas y horas en hora de Buenos Aires**, sin importar la zona horaria del dispositivo.
12. **Selector de tema Auto / Claro / Oscuro** en el encabezado. "Auto" sigue al sistema, como el prototipo.

## Fase 4 · Acciones por escenario

13. **Título "Qué sale mejor en cada escenario"** en lugar de "Qué comprar según cada escenario" del prototipo, y un aviso explícito de que las sensibilidades son aproximaciones por sector. La especificación advierte que sugerir compras puede encuadrar como asesoramiento; el cálculo es el mismo, cambia cómo se presenta.
14. **Escenarios de respaldo sin fechas ni niveles concretos.** El prototipo decía cosas como "el riesgo país baja hacia 650" o "la Fed sube el 9 de diciembre". Como esos textos se muestran cuando no hay edición del agente, los dejé genéricos para no presentar datos viejos como actuales. Los movimientos y las probabilidades son los de la especificación, y los tests de GGAL y de la selección equilibrada pasan.
15. **Supuestos editables con candado.** Para editar hay que tildar "Entiendo, quiero editar los supuestos". También dejé editar las sensibilidades de los rubros (el prototipo no lo permitía), con un tope automático para que ninguna correlación implícita supere 1.

## Fase 5 · Supabase

16. **Ingreso con enlace y también con código.** En el iPhone, el enlace del mail se abre en Safari y no dentro de la app instalada, así que la sesión quedaba del lado equivocado. El código de 6 números se escribe dentro de la app y resuelve eso. Por la misma razón usé el flujo "implícito" de Supabase, que no depende de abrir el enlace en el mismo navegador.
17. **Columna extra `opciones` en `carteras`** (horizonte, crisis, semilla, MEP manual, supuestos editados y probabilidades). La especificación lista las columnas principales; sin esta, esas preferencias se perdían al cambiar de dispositivo.
18. **Tabla extra `uso_explicar`** para el límite diario de consultas a Claude por usuario.
19. **Al entrar manda la nube; al salir se limpia el navegador.** Si tu cuenta ya tiene cartera, reemplaza a la del navegador. Si es la primera vez, se sube la del navegador. Al salir, el navegador vuelve a la cartera de ejemplo para no dejar tus datos en un dispositivo compartido.
20. **"Probar sin cuenta" con Supabase configurado** lee igual las ediciones y cotizaciones reales (son de lectura pública); solo tu cartera queda en el navegador.
21. **La migración se prueba en un Postgres real en memoria (PGlite)**, simulando los roles de Supabase. Así "un usuario guarda y recupera su cartera" y "otro usuario no la ve" quedan verificados sin necesitar tus claves.

## Fase 6 · Agente de noticias

22. **Herramienta de búsqueda `web_search_20260318`.** Verifiqué en la documentación de Claude el 12/11/2026 que es la versión vigente (hay tres: `20250305`, `20260209` y `20260318`) y que `claude-sonnet-5-5` la soporta. Dejé el filtrado dinámico que trae por defecto, que reduce el consumo de tokens.
23. **La fecha y la hora de la edición las pone el script**, no el modelo.
24. **Cobertura validada por dominio.** El esquema cuenta portales distintos entre las URLs de las noticias y de las fuentes: al menos tres argentinos y dos internacionales. Un dominio parecido no pasa (`bloomberglinea.com` no cuenta como `bloomberg.com`).
25. **Sin claves, el workflow avisa pero no falla.** Antes de que cargues los secretos, el agente termina con una advertencia visible en lugar de un error, para que GitHub no te mande un mail de falla todos los días. Con claves, un error de validación sí termina en rojo, como pide la especificación.
26. **Respaldo ante rechazos de la API.** Si un filtro de seguridad de Claude rechaza un pedido, la API lo reintenta sola con otro modelo (parámetro `fallbacks`). Si la API no acepta ese parámetro, el script sigue sin él.
27. **Edición de ejemplo con noticias inventadas y sin cifras.** Cada titular empieza con "Ejemplo:", el panel la marca en rojo y sus enlaces van a la portada de economía de cada portal, no a notas inexistentes.
28. **`argentina.gob.ar` completo** en la lista de dominios, en lugar de solo `/economia`: los comunicados del Ministerio a veces salen en otras secciones.

## Fase 7 · Explicaciones

29. **Modelo `claude-sonnet-5-5` también para `explicar`.** La especificación solo nombra el modelo del agente; usé el mismo para no sumar un segundo costo. Se cambia con el secreto `CLAUDE_MODEL`.
30. **La instrucción se arma en el servidor.** El navegador manda datos (noticia, cartera, impacto) con tope de longitud, no el texto del pedido. Así la función no sirve como acceso libre a Claude con tu clave.
31. **Hace falta haber entrado con el mail** para pedir explicaciones, con un tope de 40 por usuario y por día y una lista opcional de mails permitidos. La clave "anon" es pública por diseño; sin esto cualquiera podría gastar tu crédito.
32. **Respuestas completas, sin transmisión palabra por palabra.** Son textos cortos y simplifica la función.

## Fase 8 · Publicación

33. **Cuatro secretos en GitHub en vez de cinco.** La compilación reutiliza `SUPABASE_URL` y `SUPABASE_ANON_KEY` para la app, así pegás cada dato una sola vez.
34. **Los tests corren antes de publicar.** Si un cambio rompe el motor de riesgo o el esquema, la app publicada no se actualiza.
35. **Ícono propio** (una lámpara con una curva de precios), generado una vez y guardado en `public/`.
