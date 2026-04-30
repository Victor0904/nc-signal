const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

const app     = express();
const PORT    = process.env.PORT || 3000;

// Sur Glitch, .data/ est le dossier persistant entre les redémarrages
const DATA    = path.join(__dirname, '.data', 'data.json');
const UPLOADS = path.join(__dirname, '.data', 'uploads');

fs.mkdirSync(UPLOADS, { recursive: true });

// ─── Fichier JSON comme base de données ───────
function read()     { try { return JSON.parse(fs.readFileSync(DATA, 'utf-8')); } catch { return { ncs: [], next: 1 }; } }
function save(data) { fs.writeFileSync(DATA, JSON.stringify(data, null, 2)); }

// ─── Multer ───────────────────────────────────
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS,
    filename: (_, file, cb) => cb(null, `${Date.now()}${path.extname(file.originalname) || '.jpg'}`)
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_, file, cb) =>
    file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Images uniquement'))
});

// ─── Middleware ───────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS));

// ─── Routes ───────────────────────────────────
app.get('/api/ncs', (_, res) => {
  const { ncs } = read();
  res.json([...ncs].reverse());
});

app.post('/api/ncs', upload.single('photo'), (req, res) => {
  const { title, location, reporter } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Le titre est requis' });

  const data = read();
  const nc = {
    id:         data.next++,
    title:      title.trim(),
    location:   (location  || '').trim(),
    reporter:   (reporter  || '').trim() || 'Anonyme',
    photo:      req.file ? `/uploads/${req.file.filename}` : null,
    status:     'pending',
    takenBy:    null,
    resolvedBy: null,
    createdAt:  new Date().toISOString(),
    takenAt:    null,
    resolvedAt: null
  };
  data.ncs.push(nc);
  save(data);
  res.status(201).json(nc);
});

app.patch('/api/ncs/:id/take', (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Le nom est requis' });

  const data = read();
  const nc   = data.ncs.find(n => n.id === +req.params.id);
  if (!nc)                     return res.status(404).json({ error: 'NC introuvable' });
  if (nc.status !== 'pending') return res.status(400).json({ error: 'NC déjà prise en charge' });

  nc.status  = 'taken';
  nc.takenBy = name.trim();
  nc.takenAt = new Date().toISOString();
  save(data);
  res.json(nc);
});

app.patch('/api/ncs/:id/resolve', (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Le nom est requis' });

  const data = read();
  const nc   = data.ncs.find(n => n.id === +req.params.id);
  if (!nc)                      return res.status(404).json({ error: 'NC introuvable' });
  if (nc.status === 'resolved') return res.status(400).json({ error: 'NC déjà résolue' });

  nc.status     = 'resolved';
  nc.resolvedBy = name.trim();
  nc.resolvedAt = new Date().toISOString();
  save(data);
  res.json(nc);
});

app.listen(PORT, () => console.log(`\n  NC Signal  →  http://localhost:${PORT}\n`));
