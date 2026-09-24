/**
 * Servidor local mínimo para el Asesor BIHGO (Luis).
 *
 * Qué hace: recibe el historial de chat + el inventario de propiedades que
 * ya tiene el sitio en el navegador, arma el "guion" del agente (reglas de
 * negocio) y llama a OpenAI. La llave de OpenAI vive solo aquí, en tu
 * computadora, nunca en el navegador.
 *
 * Cómo correrlo:
 *   1) cp .env.example .env   y pega tu OPENAI_API_KEY
 *   2) npm install
 *   3) npm start
 *   Debe quedar escuchando en http://localhost:3001
 */
require("dotenv").config();
const db = require("./db");
const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const PORT = process.env.PORT || 3001;

if (!process.env.OPENAI_API_KEY) {
  console.warn(
    "⚠️  No se encontró OPENAI_API_KEY en .env — el servidor arrancará, pero /api/agent fallará hasta que la configures."
  );
}

const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

function formatPropertyForAgent(p) {
  return `ID: ${p.id}
Título: ${p.titulo}
Operación: ${p.operacion}
Tipo: ${p.tipo}
Municipio/Colonia: ${p.municipio}, ${p.colonia}
Precio: $${Number(p.precio).toLocaleString("es-MX")} MXN${p.precioPorM2 ? " por m² (precio por metro cuadrado, NO es el precio total)" : ""}
Superficie: ${p.superficieM2} m²${p.construccionM2 ? ` (construcción: ${p.construccionM2} m²)` : ""}
${p.recamaras !== undefined && p.recamaras !== "" ? `Recámaras: ${p.recamaras}` : ""}
${p.banos !== undefined && p.banos !== "" ? `Baños: ${p.banos}` : ""}
Estatus: ${p.status}
Uso de suelo: ${p.usoDeSuelo || "No registrado — indicar que se verificará"}
Características: ${(p.caracteristicas || []).join(", ")}
Servicios: ${(p.servicios || []).join(", ")}
Descripción: ${p.descripcion}`;
}

function buildSystemPrompt(inventario) {
  const inventarioTexto = inventario.map(formatPropertyForAgent).join("\n\n---\n\n");

  return `Eres Luis, el asesor inmobiliario de BIHGO (Bienes Inmuebles Hidalgo), con cobertura en todo el Estado de Hidalgo, México.

# Quién eres
Hablas como una persona mexicana, cálida, empática, profesional y consultiva. Tu objetivo es generar confianza, resolver dudas, entender la necesidad del cliente, calificarlo y avanzar hacia agendar una visita o una llamada.
SIEMPRE le hablas de "usted" al cliente, nunca de "tú" — es una relación profesional con un cliente, no una conversación entre amigos.
NUNCA digas que eres una IA ni un modelo. No uses frases como "como inteligencia artificial" o "no tengo acceso". Si no sabes algo o el dato no está en el inventario, NO respondas algo genérico ni sin relación: di que ese dato no lo tienes registrado en este momento pero con gusto se lo confirman, y pregunta EXACTAMENTE: "¿Prefiere que le comparta nuestro WhatsApp para brindarle más información, o le agendo una cita?" (el sitio se encarga de abrir la agenda o mostrar el botón de WhatsApp según lo que elija).

# Lo que puedes hacer
Informar precio, ubicación, superficie, tipo de propiedad, disponibilidad, características registradas, uso de suelo (si está cargado), servicios disponibles, y mencionar que hay fotos/video/mapa/ficha técnica disponibles. Saludar de forma natural, mantener el contexto de la conversación, hacer preguntas para entender la necesidad, resolver dudas, detectar interés de compra, calificar al prospecto, proponer y agendar visitas o llamadas, confirmar citas, solicitar datos de contacto y dar seguimiento.

# Lo que NUNCA puedes hacer
- Negociación: nunca ofreces descuentos, bajas de precio, condiciones especiales ni apartados. Si preguntan por el mejor precio, respondes EXACTAMENTE: "Con gusto puedo revisar ese punto con usted y consultar la posibilidad de negociación."
- Información privada: nunca revelas nombre, teléfono o correo del propietario, comisión, margen de negociación, documentos internos, observaciones privadas, estrategias de venta ni historial interno.
- Inventar información: si un dato no existe en el inventario, nunca lo inventes; di que ese detalle no lo tienes registrado en este momento pero con gusto se lo confirman, y pregunta EXACTAMENTE: "¿Prefiere que le comparta nuestro WhatsApp para brindarle más información, o le agendo una cita?"
- Asesoría legal: no interpretas escrituras, no garantizas permisos ni cambios de uso de suelo, no validas aspectos notariales, no das asesoría fiscal ni jurídica.
- Promesas: no prometes disponibilidad futura, aceptación de ofertas, tiempos de respuesta del propietario, aprobación de financiamiento, entrega de documentos ni cierre de operaciones.

# Regla del inventario (estricta)
Si el cliente pregunta por una propiedad específica, solo hablas de esa propiedad. No digas "tengo otra propiedad mejor" a menos que el cliente pregunte explícitamente algo como "¿tienen otra opción similar?" — en ese caso, y solo en ese caso, puedes mencionar otra del inventario.

# Regla de la conversación
Nunca termines una conversación en frío. Si el cliente dice "gracias" o algo similar, propone un siguiente paso natural, por ejemplo: "Con mucho gusto. Si le parece, también puedo ayudarle a coordinar una visita para que conozca la propiedad y resolver cualquier duda directamente en el lugar."

# Cuando alguien quiere VENDER (no comprar/rentar)
Si el cliente dice que quiere vender su propiedad (terreno, casa, departamento, edificio, etc.), responde EXACTAMENTE con este mensaje la primera vez:
"Con gusto le ayudamos a vender su propiedad.
Compártame: ubicación, superficie, si cuenta con escritura y el precio que tiene en mente.
También podemos agendar una visita para hacer una valoración sin compromiso."
Después, recopila los datos que el cliente vaya dando. Si el cliente indica que no tiene esos datos a la mano, no insistas — dile que con gusto lo pasas con el equipo de BIHGO por WhatsApp para darle seguimiento personalizado con lo que ya compartió, y nunca dejes ir a un prospecto vendedor sin ese siguiente paso.

# Oficina de BIHGO
La palabra "oficina", el horario de atención, "su dirección", "su ubicación", "dónde están" o "dónde se encuentran" se refieren SIEMPRE a la oficina de BIHGO. Si el cliente menciona la oficina, pregunta si tienes o tienen oficina, o pregunta por dirección, ubicación, mapa u horario sin referirse a una propiedad del inventario, responde EXACTAMENTE:
"Claro que sí. Nuestra oficina se encuentra en H. Colegio Militar 9, San Antonio el Desmonte, Pachuca, Hidalgo. Nuestro horario de atención es de lunes a viernes de 10:00 a.m. a 6:00 p.m. Puede comunicarse con nosotros al 771 339 8946. Le comparto la ubicación en el mapa: https://maps.app.goo.gl/WXpzrydnGqhSnWiV6 ¿Le gustaría agendar una cita en oficina?"
Nunca inventes otra dirección, teléfono ni horario. Excepción: si el cliente pregunta por la ubicación de una propiedad específica del inventario, dale la ubicación de esa propiedad, no la de la oficina. Si pregunta por oficinas en venta o renta, trátalo como búsqueda de inmueble: revisa el inventario (tipo "oficina" o "oficina" en el título, solo disponibles) y menciona únicamente las que existan, con precio y ubicación. Si no hay en la operación que pide (renta o venta) pero sí en la otra, dilo y menciónalas. Si no hay ninguna, usa la frase de propiedad fuera de catálogo y pregunta zona y tamaño que necesita. Nunca inventes oficinas.

# Detección de hot leads
Si el cliente pregunta sobre precio negociable, documentos, visitas, disponibilidad, uso de suelo, acceso, financiamiento o tiempos, trata de avanzar hacia agendar una visita o llamada de forma natural. Nunca dejes ir a un prospecto con interés real sin proponerle un siguiente paso.

# Inventario autorizado (lo único de lo que puedes hablar)
${inventarioTexto}

Responde siempre en español, en mensajes breves como una conversación real de WhatsApp (no párrafos largos).`;
}

app.post("/api/agent", async (req, res) => {
  try {
    const { messages, propiedadId, properties } = req.body;

    if (!Array.isArray(messages) || !Array.isArray(properties)) {
      return res.status(400).json({ error: "Faltan 'messages' o 'properties' en la solicitud." });
    }
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "El servidor no tiene configurada OPENAI_API_KEY." });
    }

    const inventario = propiedadId
      ? properties.filter((p) => p.id === propiedadId)
      : properties;

    const systemPrompt = buildSystemPrompt(inventario);

    const chatMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({
        role: m.sender === "agente" ? "assistant" : "user",
        content: m.text,
      })),
    ];

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: chatMessages,
      temperature: 0.6,
    });

    const reply = completion.choices[0].message.content?.trim() ||
      "Con gusto, dame un momento para confirmarte ese dato.";

    res.json({ reply });
  } catch (err) {
    console.error("Error en /api/agent:", err.message);
    res.status(500).json({ error: "No se pudo generar la respuesta." });
  }
});

/* ================= GOOGLE CALENDAR (opcional) =================
 * Requiere una cuenta de servicio de Google Cloud, compartida con permiso
 * de edición al calendario real de Luis. Ver README.md para el paso a
 * paso. Mientras GOOGLE_CLIENT_EMAIL / GOOGLE_PRIVATE_KEY / GOOGLE_CALENDAR_ID
 * no estén configuradas, estas rutas responden con calendarConnected:false
 * y el sitio sigue funcionando solo con las citas guardadas localmente.
 */
const { google } = require("googleapis");

function calendarConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_EMAIL &&
    process.env.GOOGLE_PRIVATE_KEY &&
    process.env.GOOGLE_CALENDAR_ID
  );
}

function getCalendarClient() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
  return google.calendar({ version: "v3", auth });
}

// GET /api/calendar/availability?fecha=YYYY-MM-DD
// Devuelve las horas (9-17) que ya están ocupadas ese día en el Google
// Calendar real de Luis, cruzando contra los bloques de negocio.
app.get("/api/calendar/availability", async (req, res) => {
  const { fecha } = req.query;
  if (!fecha) return res.status(400).json({ error: "Falta 'fecha' (YYYY-MM-DD)." });

  if (!calendarConfigured()) {
    return res.json({ calendarConnected: false, busyHours: [] });
  }

  try {
    const calendar = getCalendarClient();
    const timeMin = new Date(`${fecha}T00:00:00-06:00`).toISOString();
    const timeMax = new Date(`${fecha}T23:59:59-06:00`).toISOString();

    const fb = await calendar.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        timeZone: "America/Mexico_City",
        items: [{ id: process.env.GOOGLE_CALENDAR_ID }],
      },
    });

    const busySlots = fb.data.calendars[process.env.GOOGLE_CALENDAR_ID]?.busy || [];
    const busyHours = [];
    for (let h = 9; h <= 17; h++) {
      const slotStart = new Date(`${fecha}T${String(h).padStart(2, "0")}:00:00-06:00`);
      const slotEnd = new Date(`${fecha}T${String(h + 1).padStart(2, "0")}:00:00-06:00`);
      const ocupado = busySlots.some((b) => {
        const bStart = new Date(b.start);
        const bEnd = new Date(b.end);
        return slotStart < bEnd && slotEnd > bStart;
      });
      if (ocupado) busyHours.push(h);
    }

    res.json({ calendarConnected: true, busyHours });
  } catch (err) {
    console.error("Error consultando disponibilidad de Calendar:", err.message);
    res.status(500).json({ error: "No se pudo consultar Google Calendar.", calendarConnected: false, busyHours: [] });
  }
});

// POST /api/calendar/book — crea el evento real en Google Calendar
app.post("/api/calendar/book", async (req, res) => {
  if (!calendarConfigured()) {
    return res.status(200).json({ booked: false, reason: "calendar_not_configured" });
  }

  try {
    const { nombre, telefono, fecha, hora, propiedadId, properties, lugar, ubicacionCita } = req.body;
    if (!nombre || !telefono || !fecha || hora === undefined) {
      return res.status(400).json({ error: "Faltan datos de la cita." });
    }

    const BIHGO_OFFICE_ADDRESS = "H. Colegio Militar 9, San Antonio el Desmonte, Pachuca, Hidalgo";
    const BIHGO_OFFICE_MAPS_LINK = "https://maps.app.goo.gl/WXpzrydnGqhSnWiV6";
    const BIHGO_OFFICE_PHONE_DISPLAY = "771 339 8946";

    const p = propiedadId && Array.isArray(properties)
      ? properties.find((prop) => prop.id === propiedadId)
      : null;

    const calendar = getCalendarClient();
    const startDateTime = `${fecha}T${String(hora).padStart(2, "0")}:00:00`;
    const endDateTime = `${fecha}T${String(hora + 1).padStart(2, "0")}:00:00`;

    const lugarTexto = lugar === "oficina" ? "Oficina BIHGO" : "En la propiedad";
    const ubicacionFinal = lugar === "oficina" ? BIHGO_OFFICE_ADDRESS : (ubicacionCita || "");

    const descripcionLineas = [
      `Cliente: ${nombre}`,
      `Teléfono: ${telefono}`,
      `Lugar de la cita: ${lugarTexto} — ${ubicacionFinal}`,
      lugar === "oficina" ? `Tel. oficina: ${BIHGO_OFFICE_PHONE_DISPLAY}` : "",
      lugar === "oficina" ? BIHGO_OFFICE_MAPS_LINK : "",
      "",
      p ? "— Propiedad —" : "",
      p ? `${p.titulo} (${p.id})` : "",
      p ? `${p.operacion === "venta" ? "Venta" : "Renta"} · ${p.tipo}` : "",
      p ? `Precio: $${Number(p.precio).toLocaleString("es-MX")}` : "",
      p ? `Ubicación registrada: ${p.colonia}, ${p.municipio}, Hidalgo` : "",
      p ? `Superficie: ${p.superficieM2} m²` : "",
      p && p.usoDeSuelo ? `Uso de suelo: ${p.usoDeSuelo}` : "",
      "",
      "Agendado automáticamente desde el sitio BIHGO.",
    ].filter(Boolean);

    const event = await calendar.events.insert({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      requestBody: {
        summary: p ? `Visita BIHGO — ${p.titulo}` : `Visita BIHGO — ${nombre}`,
        description: descripcionLineas.join("\n"),
        location: ubicacionFinal || (p ? `${p.colonia}, ${p.municipio}, Hidalgo` : "Hidalgo"),
        start: { dateTime: startDateTime, timeZone: "America/Mexico_City" },
        end: { dateTime: endDateTime, timeZone: "America/Mexico_City" },
      },
    });

    res.json({ booked: true, eventId: event.data.id, htmlLink: event.data.htmlLink });
  } catch (err) {
    console.error("Error creando evento en Calendar:", err.message);
    res.status(500).json({ booked: false, error: "No se pudo crear el evento." });
  }
});

/* ================= CONTEO DE VISITAS (real, de todos los visitantes) =================
 * Se guarda en un archivo JSON local (data/visits.json) en el propio
 * servidor — así el conteo es el mismo sin importar desde qué navegador o
 * dispositivo entre cada visitante, a diferencia del conteo local del
 * sitio (que solo ve lo que pasa en un navegador).
 */
const fs = require("fs");
const path = require("path");
const VISITS_FILE = path.join(__dirname, "data", "visits.json");

function readVisitsLog() {
  try {
    return JSON.parse(fs.readFileSync(VISITS_FILE, "utf-8"));
  } catch (e) {
    return {};
  }
}
function writeVisitsLog(log) {
  try {
    fs.mkdirSync(path.dirname(VISITS_FILE), { recursive: true });
    fs.writeFileSync(VISITS_FILE, JSON.stringify(log, null, 2));
  } catch (e) {
    console.warn("No se pudo guardar el conteo de visitas:", e.message);
  }
}

app.post("/api/visits/record", (req, res) => {
  const log = readVisitsLog();
  const hoy = new Date().toISOString().slice(0, 10);
  log[hoy] = (log[hoy] || 0) + 1;
  writeVisitsLog(log);
  res.json({ ok: true });
});

app.get("/api/visits/stats", (req, res) => {
  const log = readVisitsLog();
  const dias = Object.keys(log).sort();
  const total = Object.values(log).reduce((a, b) => a + b, 0);
  const hoy = new Date().toISOString().slice(0, 10);
  const ultimos7 = dias.slice(-7).reverse().map((fecha) => ({ fecha, visitas: log[fecha] }));
  res.json({ connected: true, total, hoy: log[hoy] || 0, dias: ultimos7 });
});

/* ================= BASE DE DATOS (propiedades, citas, prospectos) =================
 * Estas rutas reemplazan el localStorage del navegador como fuente de
 * verdad: cualquier dispositivo que hable con este servidor ve la misma
 * información. El sitio sigue funcionando con localStorage si este
 * servidor no está corriendo (ver bihgo-preview.html), pero en cuanto
 * está disponible, se vuelve la fuente real y compartida.
 */

// --- Propiedades ---
app.get("/api/properties", (req, res) => {
  try {
    res.json({ connected: true, properties: db.getAllProperties() });
  } catch (err) {
    console.error("Error leyendo propiedades:", err.message);
    res.status(500).json({ connected: false, error: "No se pudieron leer las propiedades." });
  }
});

app.post("/api/properties", (req, res) => {
  try {
    const property = req.body;
    if (!property || !property.id) return res.status(400).json({ error: "Falta 'id' de la propiedad." });
    res.json({ ok: true, property: db.upsertProperty(property) });
  } catch (err) {
    console.error("Error guardando propiedad:", err.message);
    res.status(500).json({ error: "No se pudo guardar la propiedad." });
  }
});

app.delete("/api/properties/:id", (req, res) => {
  try {
    db.deleteProperty(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error("Error eliminando propiedad:", err.message);
    res.status(500).json({ error: "No se pudo eliminar la propiedad." });
  }
});

// --- Citas ---
app.get("/api/appointments", (req, res) => {
  try {
    res.json({ connected: true, appointments: db.getAllAppointments() });
  } catch (err) {
    res.status(500).json({ connected: false, error: "No se pudieron leer las citas." });
  }
});

app.post("/api/appointments", (req, res) => {
  try {
    const appt = req.body;
    if (!appt || !appt.id) return res.status(400).json({ error: "Falta 'id' de la cita." });
    res.json({ ok: true, appointment: db.insertAppointment(appt) });
  } catch (err) {
    console.error("Error guardando cita:", err.message);
    res.status(500).json({ error: "No se pudo guardar la cita." });
  }
});

// --- Prospectos de alta prioridad ---
app.get("/api/hotleads", (req, res) => {
  try {
    res.json({ connected: true, hotLeads: db.getAllHotLeads() });
  } catch (err) {
    res.status(500).json({ connected: false, error: "No se pudieron leer los prospectos." });
  }
});

app.post("/api/hotleads", (req, res) => {
  try {
    res.json({ ok: true, hotLead: db.insertHotLead(req.body || {}) });
  } catch (err) {
    console.error("Error guardando prospecto:", err.message);
    res.status(500).json({ error: "No se pudo guardar el prospecto." });
  }
});

// --- Visitas por propiedad ---
app.post("/api/properties/:id/view", (req, res) => {
  try {
    const count = db.incrementPropertyView(req.params.id);
    res.json({ ok: true, count });
  } catch (err) {
    res.status(500).json({ error: "No se pudo registrar la visita." });
  }
});

app.get("/api/properties/views", (req, res) => {
  try {
    res.json({ connected: true, views: db.getPropertyViewCounts() });
  } catch (err) {
    res.status(500).json({ connected: false, views: {} });
  }
});

// --- CRM: prospectos y pipeline de ventas ---
app.get("/api/leads", (req, res) => {
  try {
    res.json({ connected: true, leads: db.getAllLeads() });
  } catch (err) {
    res.status(500).json({ connected: false, error: "No se pudieron leer los prospectos." });
  }
});

app.post("/api/leads", (req, res) => {
  try {
    const lead = req.body;
    if (!lead || !lead.id) return res.status(400).json({ error: "Falta 'id' del prospecto." });
    res.json({ ok: true, lead: db.upsertLead(lead) });
  } catch (err) {
    console.error("Error guardando prospecto del CRM:", err.message);
    res.status(500).json({ error: "No se pudo guardar el prospecto." });
  }
});

app.delete("/api/leads/:id", (req, res) => {
  try {
    db.deleteLead(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "No se pudo eliminar el prospecto." });
  }
});

app.get("/health", (req, res) => res.json({ ok: true, calendarConnected: calendarConfigured() }));

app.listen(PORT, () => {
  console.log(`✅ Servidor del Asesor BIHGO escuchando en http://localhost:${PORT}`);
});
