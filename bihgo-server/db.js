/**
 * Base de datos real del sitio BIHGO — versión en archivos JSON, sin
 * dependencias nativas que necesiten compilarse.
 *
 * Antes esto usaba SQLite (better-sqlite3), pero ese paquete necesita
 * compilar código en tu computadora (requiere Python instalado), lo cual
 * complicaba la instalación para quien no es programador. Esta versión
 * guarda exactamente la misma información, de la misma forma permanente
 * (archivos dentro de la carpeta data/), pero usando JSON plano — no
 * necesita compilar nada ni instalar Python.
 */
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
fs.mkdirSync(DATA_DIR, { recursive: true });

const FILES = {
  properties: path.join(DATA_DIR, "properties.json"),
  appointments: path.join(DATA_DIR, "appointments.json"),
  hotLeads: path.join(DATA_DIR, "hot_leads.json"),
  propertyViews: path.join(DATA_DIR, "property_views.json"),
  leads: path.join(DATA_DIR, "leads.json"),
};

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (e) {
    return fallback;
  }
}
function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Semilla inicial: si el archivo de propiedades no existe todavía (primera
// vez que se corre el servidor), se carga el mismo inventario de ejemplo
// que trae el sitio.
const SEED_PROPERTIES = [
  { id:"bihgo-001", titulo:"Casa en Zona Esmeralda, Pachuca", operacion:"venta", tipo:"casa", municipio:"Pachuca de Soto", colonia:"Zona Esmeralda", precio:4850000, superficieM2:210, construccionM2:240, recamaras:3, banos:3.5, status:"disponible",
    descripcion:"Casa de dos niveles en privada con vigilancia, acabados de lujo, cocina integral y jardín. A 5 minutos de Plaza Perisur.",
    caracteristicas:["Cocina integral","Jardín privado","Roof garden","Walk-in closet en recámara principal","Cuarto de servicio"],
    servicios:["Vigilancia 24/7","Áreas verdes comunes","Casa club"],
    imagenes:["https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=1600","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=1600","https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?q=80&w=1600"],
    lat:20.1181, lng:-98.7591, usoDeSuelo:null, documentosPublicos:[], destacada:true, financiamiento:["bancario","infonavit","fovissste"], regimenPropiedad:"propiedad" },
  { id:"bihgo-002", titulo:"Terreno industrial cercano a AIFA", operacion:"venta", tipo:"industrial", municipio:"Tizayuca", colonia:"Parque Industrial Tizayuca", precio:32000000, superficieM2:36447, status:"disponible",
    descripcion:"Terreno industrial de gran superficie con acceso directo a Arco Norte, a 20 minutos de AIFA. Ideal para naves logísticas o desarrollo industrial.",
    caracteristicas:["Acceso directo a carretera","Uso de suelo industrial","Topografía plana","Factibilidad de servicios en proceso de verificación"],
    servicios:["Energía eléctrica cercana","Agua potable en zona"],
    imagenes:["https://images.unsplash.com/photo-1553413077-190dd305871c?q=80&w=1600","https://images.unsplash.com/photo-1581093458791-9d42e3f0e3d5?q=80&w=1600"],
    lat:19.8365, lng:-98.9805, usoDeSuelo:"Industrial (registrado en el sitio)", documentosPublicos:["Plano de ubicación","Constancia de uso de suelo"], destacada:true, financiamiento:["bancario"], regimenPropiedad:"propiedad" },
  { id:"bihgo-003", titulo:"Departamento en Mineral de la Reforma", operacion:"renta", tipo:"departamento", municipio:"Mineral de la Reforma", colonia:"Real de Minas", precio:12500, superficieM2:78, recamaras:2, banos:2, status:"disponible",
    descripcion:"Departamento en edificio de reciente construcción, amueblado, con amenidades y excelente ubicación cerca de plazas comerciales.",
    caracteristicas:["Amueblado","Balcón","Cocina equipada"],
    servicios:["Elevador","Roof garden común","Gimnasio"],
    imagenes:["https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=1600","https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?q=80&w=1600"],
    lat:20.0967, lng:-98.7331, usoDeSuelo:null, documentosPublicos:[], destacada:false },
  { id:"bihgo-004", titulo:"Local comercial en avenida principal", operacion:"renta", tipo:"comercial", municipio:"Pachuca de Soto", colonia:"Centro", precio:18000, superficieM2:95, status:"disponible",
    descripcion:"Local comercial en planta baja con gran flujo peatonal y vehicular, ideal para franquicia o negocio propio.",
    caracteristicas:["Fachada amplia","Doble altura","Sanitario propio"],
    servicios:["Estacionamiento cercano público"],
    imagenes:["https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1600"],
    lat:20.1225, lng:-98.7364, usoDeSuelo:null, documentosPublicos:[], destacada:false },
];

function loadProperties() {
  if (!fs.existsSync(FILES.properties)) {
    writeJson(FILES.properties, SEED_PROPERTIES);
    console.log(`🌱 Se cargó el inventario de ejemplo (${SEED_PROPERTIES.length} propiedades) en la base de datos por primera vez.`);
    return JSON.parse(JSON.stringify(SEED_PROPERTIES));
  }
  return readJson(FILES.properties, []);
}

// ---------- Propiedades ----------
function getAllProperties() {
  return loadProperties();
}
function upsertProperty(property) {
  const list = loadProperties();
  const idx = list.findIndex((p) => p.id === property.id);
  if (idx >= 0) list[idx] = property;
  else list.push(property);
  writeJson(FILES.properties, list);
  return property;
}
function deleteProperty(id) {
  const list = loadProperties().filter((p) => p.id !== id);
  writeJson(FILES.properties, list);
}

// ---------- Citas ----------
function getAllAppointments() {
  return readJson(FILES.appointments, []);
}
function insertAppointment(appt) {
  const list = readJson(FILES.appointments, []);
  list.push(appt);
  writeJson(FILES.appointments, list);
  return appt;
}

// ---------- Prospectos de alta prioridad ----------
function getAllHotLeads() {
  const list = readJson(FILES.hotLeads, []);
  return list.slice().reverse();
}
function insertHotLead(lead) {
  const id = `lead-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const record = { id, ...lead };
  const list = readJson(FILES.hotLeads, []);
  list.push(record);
  writeJson(FILES.hotLeads, list);
  return record;
}

// ---------- Visitas por propiedad ----------
function incrementPropertyView(propertyId) {
  const views = readJson(FILES.propertyViews, {});
  views[propertyId] = (views[propertyId] || 0) + 1;
  writeJson(FILES.propertyViews, views);
  return views[propertyId];
}
function getPropertyViewCounts() {
  return readJson(FILES.propertyViews, {});
}

// ---------- CRM: prospectos y pipeline de ventas ----------
function getAllLeads() {
  return readJson(FILES.leads, []);
}
function upsertLead(lead) {
  const list = getAllLeads();
  const idx = list.findIndex((l) => l.id === lead.id);
  const now = new Date().toISOString();
  const record = { ...lead, actualizado: now, creado: lead.creado || now };
  if (idx >= 0) list[idx] = record;
  else list.push(record);
  writeJson(FILES.leads, list);
  return record;
}
function deleteLead(id) {
  const list = getAllLeads().filter((l) => l.id !== id);
  writeJson(FILES.leads, list);
}

module.exports = {
  getAllProperties, upsertProperty, deleteProperty,
  getAllAppointments, insertAppointment,
  getAllHotLeads, insertHotLead,
  incrementPropertyView, getPropertyViewCounts,
  getAllLeads, upsertLead, deleteLead,
};
