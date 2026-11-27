# Informe de Lámpara

12 de noviembre de 2026

Lámpara está construida completa, con las ocho fases de la especificación y un commit por fase. Funciona hoy en tu computadora en modo de demostración. **Todavía no está publicada en internet**: para eso faltan dos pasos que solo podés hacer vos (crear el repositorio en GitHub y subirlo), explicados en `PENDIENTES.md`.

## Dónde está

- **Proyecto:** `C:\Users\pilar\Downloads\lampara` (fuera de OneDrive; el motivo está en `DECISIONES.md`).
- **Link de la app:** <https://pedrouriburu.github.io/lampara/>. Va a funcionar cuando hagas los pasos 1 y 2 de `PENDIENTES.md` (unos 7 minutos).
- **Para verla ya, en tu computadora:** abrí PowerShell y pegá estas dos líneas, de a una. Después abrí en el navegador la dirección que aparece (`http://localhost:5173`).

  ```
  cd C:\Users\pilar\Downloads\lampara
  npm run dev
  ```

## Qué quedó funcionando

**Cartera y riesgo**

- Monto total en pesos o dólares, porcentaje por rubro con deslizador y campo, indicador de suma y "Ajustar a 100%".
- Selector Pesos / Dólares (en pesos por defecto) y dólar MEP que se completa solo con la cotización del día y se puede editar.
- Simulación Monte Carlo de 5.000 trayectorias en un Web Worker, con crisis argentinas opcionales.
- Franja de métricas (VaR 95% y 99%, CVaR, mediana, peor 5%, chance de perder, caída máxima), abanico de proyección, contribución al riesgo, seis stress tests históricos y escenario por factores.
- Panel del agente de noticias: panorama, impacto combinado, una tarjeta por noticia con su impacto calculado sobre tu cartera y "Probar en escenario".
- Botón "Guardar corrida".

**Acciones por escenario**

- Escenarios a uno a tres meses con probabilidades editables.
- Mejores tres por escenario, selección equilibrada, tabla de colores ordenable y "Usar estas en mi selección".
- Tu selección dentro del monto del rubro, con resultado por escenario en porcentaje y en plata, esperado y peor caso.

**Historial y Supuestos**

- Historial: valor y VaR corrida a corrida, comparación de dos corridas y ediciones anteriores del agente.
- Supuestos: parámetros de los rubros y sensibilidades de las acciones, editables con aviso y con "Restablecer".

**Lo que trabaja solo**

- Agente diario (`agente/`): trae MEP, CCL, oficial y riesgo país; le pide a Claude (`claude-sonnet-5-5`, con búsqueda web limitada a los 26 portales) las noticias y los escenarios; valida todo con un esquema; reintenta una vez; publica la edición y borra las de más de 60 días. Hoy esta edición la genera la tarea programada de Claude; el workflow del repositorio quedó en modo manual porque necesita una clave de Anthropic (Groq no tiene búsqueda web).
- Workflow programado todos los días a las 8:00 de Buenos Aires, con corrida manual y latido mensual.
- Función `explicar` de Supabase para "Explicar para mi cartera", "Analizar otra noticia" y "Pedir lectura a Claude".
- Publicación automática en GitHub Pages con cada cambio.

**En general**

- Ingreso por mail (enlace o código) y "Probar sin cuenta".
- Tema claro y oscuro, cómoda en celular, instalable como app.
- Todo en castellano rioplatense, con el aviso de que no es asesoramiento en todas las pantallas.
- Los datos de ejemplo (cartera, selección, escenarios y edición de noticias) están marcados como ejemplo en la interfaz.

## Qué se probó y cómo

51 tests automáticos pasan (`npm test`):

| Qué | Resultado |
| --- | --- |
| Las contribuciones suman exactamente el CVaR | pasa |
| Misma semilla, mismo resultado | pasa |
| Un rubro solo, sin crisis: mediana a un año ≈ exp(ln(1 + ret) − vol²/2) | pasa, para los siete rubros |
| VaR y CVaR contra la fórmula cerrada lognormal | pasa (diferencia menor a 6%) |
| Ninguna correlación implícita supera 1 | pasa |
| Pasar de dólares a pesos y volver no cambia el monto guardado | pasa |
| GGAL: +22,1% si se calma el riesgo país y −39,0% con salto cambiario | pasa |
| Selección equilibrada del Merval: ALUA, TXAR, CRES y TGSU2 | pasa |
| Base de datos: un usuario guarda y recupera su cartera; otro no la ve; solo la clave de servicio escribe ediciones | pasa, en un Postgres real en memoria |
| Agente: esquema, cobertura de portales, URLs, pausas de la búsqueda, reintento y rechazo | pasa, con un cliente simulado |

Además abrí la app en el navegador y recorrí las cinco pantallas en 1280 px y 400 px, en claro y oscuro: cargan sin errores en la consola y sin desbordes. La versión compilada también funciona dentro de una carpeta `/lampara/`, como va a estar en GitHub Pages, con el service worker activo.

`npm run agente:seco` valida la edición de ejemplo y arma la instrucción sin red ni claves.

**Lo que no pude probar contra los servicios reales** (no tengo claves): la corrida del agente con la API de Claude, la función `explicar` en un proyecto de Supabase y el ingreso con un mail de verdad. Las tres se probaron contra versiones simuladas; el detalle está en `PENDIENTES.md`, sección "Lo que no pude comprobar".

## Qué claves faltan y dónde pegarlas

Los pasos completos, con cada clic, están en `PENDIENTES.md`. En resumen:

| Dato | De dónde sale | Dónde se pega |
| --- | --- | --- |
| URL del proyecto de Supabase | Supabase → Project Settings → API | GitHub → Settings → Secrets and variables → Actions → secreto `SUPABASE_URL` |
| Clave anon (o publishable) | mismo lugar | secreto `SUPABASE_ANON_KEY` |
| Clave service_role (o secret) | mismo lugar | secreto `SUPABASE_SERVICE_ROLE_KEY` |
| Clave de la API de Groq | Groq Console → API Keys | secreto `GROQ_API_KEY` en Supabase → Edge Functions → Secrets |
| Clave de servicio de Supabase | Supabase → Settings → API Keys → secret | secreto `SUPABASE_SERVICE_ROLE_KEY` en GitHub, para el workflow **Publicar edición** |

Antes de eso hay que crear el repositorio en GitHub y subir el proyecto (paso 1), y correr el archivo SQL en Supabase (paso 3). Ninguna clave va en un archivo del proyecto.

## Cómo comprobar que el agente corrió

Cualquiera de estas tres:

1. **En la app:** arriba del panel de noticias tiene que decir "Edición del (día de hoy) · leída por el agente 08:0x h". Si dice "Edición de ejemplo", el agente todavía no publicó.
2. **En GitHub:** pestaña **Actions** → **Agente de noticias**. Cada mañana aparece una corrida nueva; el tilde verde significa que publicó. Si sale con una cruz roja, GitHub te manda un mail, y adentro de la corrida se lee el motivo.
3. **En Supabase:** **Table Editor** → tabla `ediciones`: tiene que haber una fila con la fecha de hoy. En `cotizaciones`, lo mismo.

Para no esperar a mañana: **Actions** → **Agente de noticias** → **Run workflow**.

Si la corrida termina en amarillo con el aviso "Agente de noticias sin claves", faltan los secretos del paso 4.

## Cuánto cuesta y dónde se ve

Todo entra en planes gratuitos, salvo la API de Claude, que se paga por uso.

- **Dónde se ve el consumo:** Groq Console (<https://console.groq.com>) → **Usage**, y los límites de tu cuenta en **Limits**.
- **Cuánto cuesta:** nada. Las explicaciones de la app corren en el plan gratuito de Groq (30 pedidos por minuto, 1.000 por día, 8.000 tokens por minuto con `openai/gpt-oss-120b`) y la edición diaria la genera la tarea programada de Claude, que entra en la suscripción. Si alguna vez pasás el límite por minuto, la app lo dice y basta con esperar un minuto.
- **Poné un tope:** en la Console, **Settings** → **Limits**, fijá un gasto mensual máximo. Las explicaciones a pedido tienen además un tope de 40 por usuario y por día.

## Historial de commits

```
Fase 1: base del proyecto (Vite, React, TypeScript, Vitest y oxlint)
Fase 2: motor de riesgo en src/riesgo con Web Worker
Fase 3: pantalla Cartera y riesgo en modo de demostración
Fase 4: Acciones por escenario y pantalla Supuestos
Fase 5: Supabase, ingreso por mail, sincronización e Historial
Fase 6: agente de noticias diario y panel de noticias
Fase 7: Edge Function explicar y botones de Claude
Fase 8: publicación en GitHub Pages, PWA e informe
```

Están en tu computadora. Para subirlos, después de crear el repositorio vacío `lampara` en GitHub:

```
cd C:\Users\pilar\Downloads\lampara
git push -u origin main
```
