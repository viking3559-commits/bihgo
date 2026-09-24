# Servidor del Asesor BIHGO (conexión segura a OpenAI)

Este servidor conecta el chat del sitio (Luis) con OpenAI, sin exponer tu
llave de API en el navegador — la llave vive solo en tu computadora, en un
archivo `.env` que nunca se sube ni se comparte con el sitio.

## Cómo ponerlo en marcha

```bash
cd bihgo-server
npm install
cp .env.example .env
```

Abre `.env` y pega tu llave:
```
OPENAI_API_KEY=sk-...
PORT=3001
```

Luego:
```bash
npm start
```

Debe quedar corriendo en `http://localhost:3001` — déjalo abierto en una
terminal mientras usas el sitio.

## Cómo funciona con el sitio

El archivo del sitio (`bihgo-preview.html`) intenta hablarle primero a este
servidor. Si el servidor está corriendo y tiene la llave configurada,
Luis responde con IA real de OpenAI, usando exactamente las reglas que
definiste (qué puede y no puede hacer, el inventario, etc.).

Si el servidor **no** está corriendo, el sitio sigue funcionando solo —
regresa automáticamente al motor de reglas local, sin IA. Así puedes
seguir usando el sitio aunque no tengas el servidor prendido; solo pierdes
la parte de respuestas más naturales/flexibles de OpenAI.

## Base de datos real (inventario, citas y prospectos)

Este servidor ya guarda todo en una base de datos real (SQLite, un solo
archivo: `data/bihgo.db`) que se crea sola la primera vez que arrancas el
servidor — no necesitas instalar nada aparte ni crear cuentas en ningún
servicio externo.

Qué guarda:
- **Propiedades** — lo que agregues/edites/borres desde el panel Admin del
  sitio ya no depende del navegador; se guarda aquí.
- **Citas agendadas** — con fecha, hora, lugar y datos del cliente.
- **Prospectos de alta prioridad** (hot leads).

La primera vez que corres el servidor, se siembra automáticamente con el
mismo inventario de ejemplo que trae el sitio. A partir de ahí, todo lo
que agregues o cambies desde el Admin queda guardado ahí de forma
permanente — sin importar en qué navegador o dispositivo entres.

Si el servidor no está corriendo, el sitio sigue funcionando con
localStorage como respaldo (como antes), y en cuanto el servidor vuelve a
estar disponible, retoma la base de datos real automáticamente.

**Importante:** haz respaldo del archivo `data/bihgo.db` de vez en cuando
(cópialo a otro lugar) — si se pierde ese archivo, se pierde el
inventario y el historial de citas/prospectos guardados en el servidor.

## Costo

Cada mensaje que un visitante le manda a Luis genera una llamada a la API
de OpenAI (modelo `gpt-4o-mini`, económico pero no gratuito). Revisa tu
uso y límites de gasto en https://platform.openai.com/usage

## Conectar tu Google Calendar real (opcional)

Con esto, el sitio revisa tu **calendario real** (no solo las citas que se
agendaron desde el sitio) para saber qué horarios ya están ocupados, y
crea el evento directo en tu Google Calendar al confirmar una cita — sin
que nadie tenga que darle clic a "agregar a calendario" manualmente.

1. Ve a [Google Cloud Console](https://console.cloud.google.com/), crea un
   proyecto (o usa uno existente) y activa la **Google Calendar API**.
2. Crea una **cuenta de servicio** (IAM y administración → Cuentas de
   servicio → Crear cuenta de servicio).
3. Genera una llave JSON para esa cuenta de servicio y descárgala.
4. Abre tu Google Calendar normal (calendar.google.com) → Configuración
   de tu calendario → "Compartir con determinadas personas" → agrega el
   correo de la cuenta de servicio (algo como
   `nombre@proyecto.iam.gserviceaccount.com`) con permiso
   **"Realizar cambios en eventos"**.
5. En tu `.env`, completa:
   ```
   GOOGLE_CLIENT_EMAIL=el "client_email" del archivo JSON
   GOOGLE_PRIVATE_KEY="la 'private_key' del archivo JSON, tal cual, con los \n incluidos"
   GOOGLE_CALENDAR_ID=tu correo de Gmail (o el ID del calendario específico)
   ```
6. Reinicia el servidor (`npm start`).

Si no configuras esto, el sitio sigue funcionando — solo revisa las citas
que se han guardado desde el propio sitio, no tu calendario completo.

## Siguiente paso natural

Este servidor corre en tu computadora — perfecto para probarlo. Para que
el sitio funcione así "en vivo" para tus clientes reales (no solo en tu
máquina), este mismo servidor se puede desplegar en un hosting con muy
poco costo (Render, Railway, Fly.io, etc.). La notificación por WhatsApp
sigue siendo "abrir un link con el mensaje ya escrito" — para que se
envíe 100% sola (sin que nadie le dé clic a enviar) haría falta conectar
también la API oficial de WhatsApp Business de Meta, que es un paso aparte
con su propio proceso de verificación.
