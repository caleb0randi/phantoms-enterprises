const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const { sendVerificationEmail } = require('./mailer');

const app = express();
const PORT = process.env.PORT || 3000;
const USERS_FILE = path.join(__dirname, 'users.json');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure session management
app.use(session({
    secret: process.env.SESSION_SECRET || 'phantoms_secret_key_2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 3600000 } // 1 hour session
}));

// Serve static assets without auto-serving index.html
app.use(express.static(__dirname, { index: false }));
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

const verificationCodes = {};

// Helper functions for user storage
function getUsers() {
    if (!fs.existsSync(USERS_FILE)) {
        fs.writeFileSync(USERS_FILE, JSON.stringify([]));
    }
    try {
        return JSON.parse(fs.readFileSync(USERS_FILE));
    } catch (e) {
        return [];
    }
}

function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Auto-seed Admin Account on Startup
function seedAdmin() {
    const users = getUsers();
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@Phantoms2026';

    const adminExists = users.some(u => u.username === adminUsername);
    if (!adminExists) {
        users.push({
            id: 1,
            username: adminUsername,
            contact: process.env.EMAIL_USER || 'admin@phantoms.com',
            password: adminPassword,
            role: 'admin'
        });
        saveUsers(users);
        console.log(`[SEED] Admin account '${adminUsername}' created successfully.`);
    }
}
seedAdmin();

// Authentication Middleware to lock protected routes
function requireAuth(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    }
    return res.redirect('/');
}

// Root Route - Always serve Login Page
app.get('/', (req, res) => {
    const rootLogin = path.join(__dirname, 'login.html');
    const publicLogin = path.join(__dirname, 'public', 'login.html');

    if (fs.existsSync(rootLogin)) {
        res.sendFile(rootLogin);
    } else if (fs.existsSync(publicLogin)) {
        res.sendFile(publicLogin);
    } else {
        res.status(404).send('login.html not found');
    }
});

// Dashboard Route - LOCKED down with requireAuth middleware
app.get('/dashboard', requireAuth, (req, res) => {
    const publicIndexPath = path.join(__dirname, 'public', 'index.html');
    const rootIndexPath = path.join(__dirname, 'index.html');

    if (fs.existsSync(publicIndexPath)) {
        res.sendFile(publicIndexPath);
    } else {
        res.sendFile(rootIndexPath);
    }
});

// Request Verification Code via Email
app.post('/api/send-code', async (req, res) => {
    const { contact } = req.body;
    if (!contact) {
        return res.status(400).json({ success: false, message: 'Email address is required.' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    verificationCodes[contact] = code;

    try {
        await sendVerificationEmail(contact, code);
        return res.json({ success: true, message: 'Verification code sent to your email!' });
    } catch (error) {
        console.error('Mailer error:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Failed to send email. Ensure server environment variables are configured.' 
        });
    }
});

// Signup Endpoint
app.post('/api/signup', (req, res) => {
    const { username, contact, password, code } = req.body;
    const users = getUsers();

    if (!username || !contact || !password || !code) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    if (verificationCodes[contact] !== code) {
        return res.status(400).json({ success: false, message: 'Invalid or expired verification code.' });
    }

    if (users.find(u => u.username === username)) {
        return res.status(400).json({ success: false, message: 'Username already taken.' });
    }

    const newUser = { id: Date.now(), username, contact, password, role: 'user' };
    users.push(newUser);
    saveUsers(users);

    delete verificationCodes[contact];
    return res.json({ success: true, message: 'Account created successfully!' });
});

// Login Endpoint - Creates Session
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const users = getUsers();

    const user = users.find(u => u.username === username && u.password === password);
    if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    req.session.user = { id: user.id, username: user.username, role: user.role || 'user' };

    return res.json({ 
        success: true, 
        user: req.session.user 
    });
});

// Logout Endpoint
app.get('/api/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
            
