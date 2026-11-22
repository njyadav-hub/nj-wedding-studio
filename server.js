
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Render proxy and HTTPS support
app.set('trust proxy', 1);

// Folders
const DATA_DIR = path.join(__dirname, 'data');
const DATA = path.join(DATA_DIR, 'store.json');
const UPLOADS = path.join(__dirname, 'uploads');
const PUBLIC = path.join(__dirname, 'public');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS, { recursive: true });

if (!fs.existsSync(DATA)) {
  fs.writeFileSync(
    DATA,
    JSON.stringify({ users: [], weddings: [] }, null, 2)
  );
}

// Database helpers
const read = () => {
  try {
    return JSON.parse(fs.readFileSync(DATA, 'utf8'));
  } catch (error) {
    console.error('Database read error:', error);
    throw new Error('Unable to read database.');
  }
};

const write = (db) => {
  const temp = DATA + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(db, null, 2));
  fs.renameSync(temp, DATA);
};

const safeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email
});

const slugify = (value) =>
  String(value || 'wedding')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 35) || 'wedding';

// Middleware
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Session configuration
if (!process.env.SESSION_SECRET) {
  console.error('WARNING: SESSION_SECRET is missing.');
}

app.use(session({
  name: 'nj.sid',
  secret: process.env.SESSION_SECRET || 'development-only-change-this-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: 'auto',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

app.use('/uploads', express.static(UPLOADS));
app.use(express.static(PUBLIC));

// Photo upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS);
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    cb(
      null,
      Date.now() + '-' +
      crypto.randomBytes(5).toString('hex') + ext
    );
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 8 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowed = /^image\/(jpeg|png|webp|gif)$/;

    if (allowed.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, WEBP and GIF images are allowed.'));
    }
  }
});

// Authentication middleware
const auth = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      error: 'Please sign in first.'
    });
  }

  next();
};

// Create and save session safely
const createSession = (req, userId) => {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);

      req.session.userId = userId;

      req.session.save((saveError) => {
        if (saveError) return reject(saveError);
        resolve();
      });
    });
  });
};

// REGISTER
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    if (
      !name?.trim() ||
      !email?.trim() ||
      !password ||
      password.length < 8
    ) {
      return res.status(400).json({
        error: 'Name, email and password of at least 8 characters are required.'
      });
    }

    const db = read();
    const cleanEmail = email.trim().toLowerCase();

    if (db.users.some(u => u.email === cleanEmail)) {
      return res.status(409).json({
        error: 'An account with this email already exists. Please sign in instead.'
      });
    }

    const user = {
      id: crypto.randomUUID(),
      name: name.trim(),
      email: cleanEmail,
      password: await bcrypt.hash(password, 12),
      createdAt: new Date().toISOString()
    };

    db.users.push(user);
    write(db);

    await createSession(req, user.id);

    return res.json({
      success: true,
      user: safeUser(user)
    });

  } catch (error) {
    console.error('Registration error:', error);

    return res.status(500).json({
      error: 'Registration failed. Please try again.'
    });
  }
});

// LOGIN
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email?.trim() || !password) {
      return res.status(400).json({
        error: 'Please enter email and password.'
      });
    }

    const db = read();

    const cleanEmail = email.trim().toLowerCase();

    const user = db.users.find(
      u => u.email === cleanEmail
    );

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({
        error: 'Email or password is incorrect.'
      });
    }

    await createSession(req, user.id);

    return res.json({
      success: true,
      user: safeUser(user)
    });

  } catch (error) {
    console.error('Login error:', error);

    return res.status(500).json({
      error: 'Login failed. Please try again.'
    });
  }
});

// CHECK CURRENT USER
app.get('/api/me', (req, res) => {
  try {
    if (!req.session?.userId) {
      return res.json({ user: null });
    }

    const db = read();

    const user = db.users.find(
      u => u.id === req.session.userId
    );

    if (!user) {
      return res.json({ user: null });
    }

    res.json({
      user: safeUser(user)
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to check account.' });
  }
});

// LOGOUT
app.post('/api/logout', (req, res) => {
  if (!req.session) {
    return res.json({ success: true });
  }

  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({
        error: 'Logout failed.'
      });
    }

    res.clearCookie('nj.sid', {
      httpOnly: true,
      sameSite: 'lax',
      secure: 'auto'
    });

    res.json({ success: true });
  });
});

// GET USER'S WEDDINGS
app.get('/api/weddings', auth, (req, res) => {
  try {
    const db = read();

    const weddings = db.weddings.filter(
      w => w.userId === req.session.userId
    );

    res.json(
      weddings.map(({ userId, ...w }) => w)
    );

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to load invitations.' });
  }
});

// UPLOAD PHOTO
app.post('/api/upload', auth, (req, res) => {
  upload.single('photo')(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        error: err.message
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'Please choose a photo.'
      });
    }

    res.json({
      success: true,
      url: '/uploads/' + req.file.filename
    });
  });
});

// CREATE WEDDING INVITATION
app.post('/api/weddings', auth, (req, res) => {
  try {
    const db = read();
    const d = req.body || {};

    if (!d.bride?.trim() || !d.groom?.trim()) {
      return res.status(400).json({
        error: 'Please enter both bride and groom names.'
      });
    }

    const base = slugify(`${d.bride}-${d.groom}`);
    const slug = base + '-' + crypto.randomBytes(3).toString('hex');

    const wedding = {
      ...d,
      id: crypto.randomUUID(),
      userId: req.session.userId,
      slug,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.weddings.push(wedding);
    write(db);

    res.json({
      success: true,
      wedding: {
        ...wedding,
        userId: undefined
      },
      url: `${req.protocol}://${req.get('host')}/w/${slug}`
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Unable to create invitation.'
    });
  }
});

// UPDATE WEDDING
app.put('/api/weddings/:id', auth, (req, res) => {
  try {
    const db = read();

    const wedding = db.weddings.find(
      w =>
        w.id === req.params.id &&
        w.userId === req.session.userId
    );

    if (!wedding) {
      return res.status(404).json({
        error: 'Invitation not found.'
      });
    }

    // Do not allow ownership or ID changes
    const updates = { ...req.body };
    delete updates.id;
    delete updates.userId;
    delete updates.slug;

    Object.assign(wedding, updates, {
      updatedAt: new Date().toISOString()
    });

    write(db);

    res.json({
      success: true,
      wedding: {
        ...wedding,
        userId: undefined
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Unable to update invitation.'
    });
  }
});

// DELETE WEDDING
app.delete('/api/weddings/:id', auth, (req, res) => {
  try {
    const db = read();

    const index = db.weddings.findIndex(
      w =>
        w.id === req.params.id &&
        w.userId === req.session.userId
    );

    if (index === -1) {
      return res.status(404).json({
        error: 'Invitation not found.'
      });
    }

    db.weddings.splice(index, 1);
    write(db);

    res.json({ success: true });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Unable to delete invitation.'
    });
  }
});

// PUBLIC WEDDING INVITATION DATA
app.get('/api/public/:slug', (req, res) => {
  try {
    const db = read();

    const wedding = db.weddings.find(
      w => w.slug === req.params.slug
    );

    if (!wedding) {
      return res.status(404).json({
        error: 'This invitation could not be found.'
      });
    }

    const { userId, ...publicWedding } = wedding;

    res.json(publicWedding);

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Unable to load invitation.'
    });
  }
});

// PUBLIC WEDDING PAGE
app.get('/w/:slug', (req, res) => {
  res.sendFile(
    path.join(PUBLIC, 'invitation.html')
  );
});

// HOME PAGE
app.get('*', (req, res) => {
  res.sendFile(
    path.join(PUBLIC, 'index.html')
  );
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    error: 'Something went wrong. Please try again.'
  });
});

// START SERVER
app.listen(PORT, () => {
  console.log(`NJ Wedding Studio running on port ${PORT}`);
});
