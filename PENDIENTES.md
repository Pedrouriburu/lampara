# Pendientes

Lo que no pude hacer por vos (crear cuentas y pegar claves) y lo que quedó más simple de lo pedido. Todo se hace con clics y copiar y pegar. Mientras no lo hagas, la app funciona igual en modo de demostración.

Orden recomendado: 1 → 2 → 3 → 4 → 5. Los pasos 1 y 2 ya dejan la app publicada; los demás la van activando.

---

## 1. Subir el proyecto a GitHub (5 minutos)

No tengo acceso a tu cuenta de GitHub desde acá, así que el repositorio quedó solo en tu computadora, con un commit por fase.

1. Entrá a <https://github.com/new> con tu cuenta `Pedrouriburu`.
2. En **Repository name** escribí `lampara`. Elegí **Public** (GitHub Pages gratis lo necesita). No tildes "Add a README" ni ninguna otra opción. Apretá **Create repository**.
3. Abrí PowerShell y pegá estas dos líneas, de a una:

   ```
   cd C:\Users\pilar\Downloads\lampara
   git push -u origin main
   ```

   Si se abre una ventana de GitHub pidiendo permiso, aceptá. (La dirección del repositorio ya quedó configurada.)

## 2. Activar la publicación (2 minutos)

1. En el repositorio, entrá a **Settings** → **Pages**.
2. En **Build and deployment** → **Source**, elegí **GitHub Actions**.
3. Andá a la pestaña **Actions** → **Publicar la app** → **Run workflow** → **Run workflow**.
4. Cuando termine con un tilde verde (unos 2 minutos), la app está en **<https://pedrouriburu.github.io/lampara/>**. Desde ahí la podés instalar en el iPhone: botón Compartir → **Agregar a inicio**.

A partir de ahora, cada vez que se suba un cambio se vuelve a publicar sola.

## 3. Crear la base de datos en Supabase (15 minutos)

Sirve para entrar con tu mail, guardar tu cartera y recibir las ediciones del agente.

1. Creá una cuenta en <https://supabase.com> y un proyecto nuevo (**New project**). Nombre: `lampara`. Región: São Paulo. Guardá la contraseña de la base que te pide, aunque no la vas a usar.
2. Cuando el proyecto esté listo, abrí **SQL Editor** → **New query**. Abrí en tu computadora el archivo `supabase\migrations\20261112000000_inicial.sql`, copiá **todo** su contenido, pegalo y apretá **Run**. Tiene que decir "Success".
3. Andá a **Authentication** → **URL Configuration**:
   - **Site URL**: `https://pedrouriburu.github.io/lampara/`
   - En **Redirect URLs** agregá la misma dirección: `https://pedrouriburu.github.io/lampara/`
4. (Recomendado para el iPhone.) En **Authentication** → **Emails** → plantilla **Magic Link**, agregá esta línea al final del texto y guardá:

   ```
   <p>Tu código para entrar: {{ .Token }}</p>
   ```

   Así el mail trae también un código de 6 números para escribir en la app, que es lo que funciona cuando la tenés instalada en la pantalla de inicio.
5. Andá a **Project Settings** → **API** (o **API Keys**) y dejá esa página abierta: vas a copiar tres datos en el paso 4.
   - **Project URL** (empieza con `https://` y termina en `.supabase.co`)
   - la clave **anon** (en proyectos nuevos se llama **publishable**)
   - la clave **service_role** (en proyectos nuevos, **secret**). Esta da permiso total: no la pegues en ningún otro lado que no sea el paso 4.

Dos límites del plan gratuito que conviene saber:

- Supabase solo manda mails de ingreso a las direcciones de los miembros del proyecto (la tuya) y pocos por hora. Para que entren otras personas hay que configurar un servicio de mail propio en **Authentication** → **Emails** → **SMTP Settings**.
- Supabase pausa los proyectos gratuitos que pasan una semana sin uso. Con el agente corriendo todos los días eso no pasa.

## 4. Pegar las claves en GitHub (5 minutos)

En el repositorio de GitHub: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**. Creá estos cuatro, uno por vez (el nombre tiene que ser exacto):

| Nombre del secreto | Qué pegar |
| --- | --- |
| `SUPABASE_URL` | La **Project URL** de Supabase |
| `SUPABASE_ANON_KEY` | La clave **anon** / **publishable** |
| `SUPABASE_SERVICE_ROLE_KEY` | La clave **service_role** / **secret** |

Después andá a **Actions** → **Publicar la app** → **Run workflow** para que la app se vuelva a publicar ya conectada a tu base. Al abrirla vas a ver la pantalla de ingreso con el campo de mail activo.

## 5. Activar las explicaciones con Groq (5 minutos)

Las explicaciones que se piden desde la app ("Explicar para mi cartera", "Pedir lectura", "Analizar otra noticia") usan **Groq**, que tiene un plan gratuito sin tarjeta: 30 pedidos por minuto, 1.000 por día y 8.000 tokens por minuto con el modelo `openai/gpt-oss-120b`. Alcanza de sobra. Groq no entrena con lo que le mandás.

1. Entrá a <https://console.groq.com>, creá la cuenta y andá a **API Keys** → **Create API Key**. Copiala: se muestra una sola vez.
2. En Supabase, abrí **Edge Functions** → **Deploy a new function** → **Via Editor**.
3. Nombre de la función: `explicar` (exacto, en minúsculas).
4. Borrá el código de ejemplo. Abrí en tu computadora `supabase\functions\explicar\index.ts`, copiá todo, pegalo y apretá **Deploy function**.
5. En **Edge Functions** → **Secrets**, agregá un secreto llamado `GROQ_API_KEY` con la clave del paso 1.
6. (Opcional.) Agregá el secreto `CORREOS_PERMITIDOS` con tu mail para que nadie más use tu cuota. Sin eso, cada usuario tiene un tope de 40 consultas por día.
7. (Opcional.) El secreto `GROQ_MODEL` cambia el modelo; sin él se usa `openai/gpt-oss-120b`.
8. **Probar:** entrá a la app con tu mail, abrí una noticia y tocá **Explicar para mi cartera**. Si aparece el texto, está andando.

### La edición diaria de noticias

La genera la **tarea programada de Claude**, no GitHub Actions. El agente del repositorio necesita búsqueda web para leer los 26 portales, y Groq no la tiene, así que su horario quedó apagado: el workflow **Agente de noticias** solo corre a mano. Si alguna vez querés volver a usarlo, cargá el secreto `ANTHROPIC_API_KEY` y descomentá las dos líneas de `schedule` en `.github/workflows/agente.yml`.

---

## Lo que no pude comprobar

Sin claves reales, estas partes se probaron contra servicios simulados y no contra los de verdad. Lo más probable es que anden a la primera, pero la primera corrida real es la prueba definitiva:

- **El agente con la API de Claude.** La conversación (pausas de la búsqueda, reintento, validación, rechazo) está probada con un cliente simulado, y las cotizaciones se leyeron de verdad. No pude confirmar con una llamada real que la API acepte la lista de 26 portales ni cuánto consume una corrida. Si la primera corrida falla, el motivo aparece en **Actions** → **Agente de noticias** → la corrida en rojo → paso "Leer las noticias y publicar la edición".
- **La función `explicar`.** Corrió en Deno contra un Supabase y un Claude simulados (sin sesión, con sesión, límite diario, respuesta rechazada). Falta verla en tu proyecto real.
- **Ingreso y guardado en la nube.** La app se probó entera contra un Supabase simulado (entrar con código, guardar y recuperar la cartera, corridas, ediciones). Las reglas de seguridad de la base se probaron en un Postgres de verdad en memoria. Falta el recorrido con tu proyecto.
- **El aviso de que el repositorio no se duerma.** GitHub pausa los workflows programados tras 60 días sin actividad. El "latido" mensual hace un commit vacío en la rama `latido`, como pide la especificación; no puedo confirmar desde acá que un commit fuera de `main` alcance. Si algún día GitHub te avisa por mail que pausó el workflow, entrá a **Actions** → **Agente de noticias** → **Enable workflow**.

## Lo que quedó más simple que en la especificación

- **Respaldo del dólar MEP.** Si dolarapi.com no responde, la app y el agente usan la última cotización guardada (o la que cargues a mano). No hice que el agente lea el MEP de Rava como segundo respaldo.
- **Explicaciones de Claude.** Llegan completas en lugar de ir apareciendo palabra por palabra como en el prototipo.
- **Una sola cartera por cuenta.** La base permite varias; la app usa una, llamada "Mi cartera".
- **Supuestos editados.** Tus cambios en Supuestos se guardan con tu cartera. Las tablas `supuestos_rubros` y `universo_acciones` de la base solo definen los valores a los que vuelve "Restablecer" (y las sensibilidades que lee el agente).

## Antes de compartirla con otras personas

Lo marca la especificación y lo repito porque importa: la pestaña de acciones muestra qué sale mejor en cada escenario. Como herramienta personal y educativa no hay problema, pero ofrecerla a terceros puede encuadrar como asesoramiento regulado por la CNV (Ley 26.831), y guardar carteras de otras personas activa la Ley 25.326 de datos personales (política de privacidad, finalidad y medidas de seguridad). Conviene revisarlo con un docente o un profesional antes de abrirla.
