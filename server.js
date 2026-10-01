  const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const USERS_FILE = path.join(__dirname, 'users.json');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Temporary in-memory store for verification codes
const verificationCodes = {};

// Helper functions to read/write persistent user data
function getUsers() {
    if (!fs.existsSync(USERS_FILE)) {
        fs.writeFileSync(USERS_FILE, JSON.stringify([]));
    }
    try {
        const data = fs.readFileSync(USERS_FILE);
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// 1. Serve Login Page as Default Route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// 2. Serve Main Dashboard
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 3. Request Verification Code API
app.post('/api/send-code', (req, res) => {
    const { contact } = req.body;
    if (!contact) {
        return res.status(400).json({ success: false, message: 'Email or phone required.' });
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    verificationCodes[contact] = code;

    console.log(`[VERIFICATION CODE] For ${contact}: ${code}`);

    // In production, integrate an email service (Nodemailer) or SMS gateway here.
    return res.json({ 
        success: true, 
        message: 'Verification code generated!',
        devCode: code // Displayed for easy testing
    });
});

// 4. Sign Up API
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

    // Create user and persist to storage
    const newUser = { id: Date.now(), username, contact, password };
    users.push(newUser);
    saveUsers(users);

    delete verificationCodes[contact]; // Clear used code

    return res.json({ success: true, message: 'Account created successfully!' });
});

// 5. Login API
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const users = getUsers();

    const user = users.find(u => u.username === username && u.password === password);

    if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    return res.json({ success: true, user: { username: user.username, id: user.id } });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
          
