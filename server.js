const express      = require('express');
const multer       = require('multer');
const { Pool }     = require('pg');
const path         = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── PostgreSQL ───────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

pool.query(`
  CREATE TABLE IF NOT EXISTS ncs (
    id          SERIAL PRIMARY KEY,
    title       TEXT NOT NULL,
    location    TEXT DEFAULT '',
    reporter    TEXT DEFAULT 'Anonyme',
    photo_data  TEXT,
    photo_mime  TEXT,
    status      TEXT DEFAULT 'pending',
    taken_by    TEXT,
    resolved_by TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    taken_at    TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ
  )
`).catch(err => { console.error('DB init error:', err.message); process.exit(1); });

// ─── Multer (mémoire) ─────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_, file, cb) =>
    file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Images uniquement'))
});

// ─── Helper snake_case → camelCase ────────────
const fmt = r => ({
  id: r.id, title: r.title, location: r.location,
  reporter: r.reporter, status: r.status,
  photo: r.photo_data ? `/api/ncs/${r.id}/photo` : null,
  takenBy: r.taken_by, resolvedBy: r.resolved_by,
  createdAt: r.created_at, takenAt: r.taken_at, resolvedAt: r.resolved_at,
});

// ─── Middleware ───────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Routes ───────────────────────────────────
app.get('/api/ncs', async (_, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id,title,location,reporter,photo_data,photo_mime,status,taken_by,resolved_by,created_at,taken_at,resolved_at FROM ncs ORDER BY created_at DESC'
    );
    res.json(rows.map(fmt));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Sert l'image d'une NC
app.get('/api/ncs/:id/photo', async (req, res) => {
  try {
    const { rows: [nc] } = await pool.query(
      'SELECT photo_data, photo_mime FROM ncs WHERE id=$1', [req.params.id]
    );
    if (!nc?.photo_data) return res.status(404).end();
    const buf = Buffer.from(nc.photo_data, 'base64');
    res.set('Content-Type', nc.photo_mime || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(buf);
  } catch (err) { res.status(500).end(); }
});

app.post('/api/ncs', upload.single('photo'), async (req, res) => {
  try {
    const { title, location, reporter } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Le titre est requis' });

    const photoData = req.file ? req.file.buffer.toString('base64') : null;
    const photoMime = req.file ? req.file.mimetype : null;

    const { rows } = await pool.query(
      `INSERT INTO ncs (title, location, reporter, photo_data, photo_mime)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [title.trim(), (location||'').trim(), (reporter||'').trim()||'Anonyme', photoData, photoMime]
    );
    res.status(201).json(fmt(rows[0]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/ncs/:id/take', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Le nom est requis' });

    const { rows: [nc] } = await pool.query('SELECT status FROM ncs WHERE id=$1', [req.params.id]);
    if (!nc)                     return res.status(404).json({ error: 'NC introuvable' });
    if (nc.status !== 'pending') return res.status(400).json({ error: 'NC déjà prise en charge' });

    const { rows } = await pool.query(
      `UPDATE ncs SET status='taken', taken_by=$1, taken_at=NOW() WHERE id=$2 RETURNING *`,
      [name.trim(), req.params.id]
    );
    res.json(fmt(rows[0]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/ncs/:id/resolve', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Le nom est requis' });

    const { rows: [nc] } = await pool.query('SELECT status FROM ncs WHERE id=$1', [req.params.id]);
    if (!nc)                      return res.status(404).json({ error: 'NC introuvable' });
    if (nc.status === 'resolved') return res.status(400).json({ error: 'NC déjà résolue' });

    const { rows } = await pool.query(
      `UPDATE ncs SET status='resolved', resolved_by=$1, resolved_at=NOW() WHERE id=$2 RETURNING *`,
      [name.trim(), req.params.id]
    );
    res.json(fmt(rows[0]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(PORT, () => console.log(`\n  NC Signal  →  http://localhost:${PORT}\n`));
