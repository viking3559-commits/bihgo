const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  throw new Error("Falta la variable de entorno DATABASE_URL");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

let initialized = false;

async function initDatabase() {
  if (initialized) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS properties (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL
    );

    CREATE TABLE IF NOT EXISTS hot_leads (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL
    );

    CREATE TABLE IF NOT EXISTS property_views (
      property_id TEXT PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL
    );
  `);

  initialized = true;

  console.log("✅ PostgreSQL BIHGO inicializado correctamente.");
}

// ---------- Propiedades ----------

async function getAllProperties() {
  await initDatabase();

  const result = await pool.query(`
    SELECT data
    FROM properties
    ORDER BY id
  `);

  return result.rows.map(row => row.data);
}

async function upsertProperty(property) {
  await initDatabase();

  await pool.query(
    `
      INSERT INTO properties (id, data)
      VALUES ($1, $2::jsonb)
      ON CONFLICT (id)
      DO UPDATE SET data = EXCLUDED.data
    `,
    [property.id, JSON.stringify(property)]
  );

  return property;
}

async function deleteProperty(id) {
  await initDatabase();

  await pool.query(
    `DELETE FROM properties WHERE id = $1`,
    [id]
  );
}

// ---------- Citas ----------

async function getAllAppointments() {
  await initDatabase();

  const result = await pool.query(`
    SELECT data
    FROM appointments
    ORDER BY id
  `);

  return result.rows.map(row => row.data);
}

async function insertAppointment(appt) {
  await initDatabase();

  await pool.query(
    `
      INSERT INTO appointments (id, data)
      VALUES ($1, $2::jsonb)
      ON CONFLICT (id)
      DO UPDATE SET data = EXCLUDED.data
    `,
    [appt.id, JSON.stringify(appt)]
  );

  return appt;
}

// ---------- Hot Leads ----------

async function getAllHotLeads() {
  await initDatabase();

  const result = await pool.query(`
    SELECT data
    FROM hot_leads
    ORDER BY id DESC
  `);

  return result.rows.map(row => row.data);
}

async function insertHotLead(lead) {
  await initDatabase();

  const id =
    `lead-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const record = {
    id,
    ...lead
  };

  await pool.query(
    `
      INSERT INTO hot_leads (id, data)
      VALUES ($1, $2::jsonb)
    `,
    [id, JSON.stringify(record)]
  );

  return record;
}

// ---------- Visitas por propiedad ----------

async function incrementPropertyView(propertyId) {
  await initDatabase();

  const result = await pool.query(
    `
      INSERT INTO property_views (property_id, count)
      VALUES ($1, 1)
      ON CONFLICT (property_id)
      DO UPDATE SET count = property_views.count + 1
      RETURNING count
    `,
    [propertyId]
  );

  return result.rows[0].count;
}

async function getPropertyViewCounts() {
  await initDatabase();

  const result = await pool.query(`
    SELECT property_id, count
    FROM property_views
  `);

  const views = {};

  for (const row of result.rows) {
    views[row.property_id] = row.count;
  }

  return views;
}

// ---------- CRM: Leads ----------

async function getAllLeads() {
  await initDatabase();

  const result = await pool.query(`
    SELECT data
    FROM leads
    ORDER BY id
  `);

  return result.rows.map(row => row.data);
}

async function upsertLead(lead) {
  await initDatabase();

  const now = new Date().toISOString();

  const record = {
    ...lead,
    actualizado: now,
    creado: lead.creado || now
  };

  await pool.query(
    `
      INSERT INTO leads (id, data)
      VALUES ($1, $2::jsonb)
      ON CONFLICT (id)
      DO UPDATE SET data = EXCLUDED.data
    `,
    [record.id, JSON.stringify(record)]
  );

  return record;
}

async function deleteLead(id) {
  await initDatabase();

  await pool.query(
    `DELETE FROM leads WHERE id = $1`,
    [id]
  );
}

module.exports = {
  initDatabase,

  getAllProperties,
  upsertProperty,
  deleteProperty,

  getAllAppointments,
  insertAppointment,

  getAllHotLeads,
  insertHotLead,

  incrementPropertyView,
  getPropertyViewCounts,

  getAllLeads,
  upsertLead,
  deleteLead
};
