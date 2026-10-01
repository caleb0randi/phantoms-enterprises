 const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// -------------------------------------------------------------
// SUPER ADMIN CREDENTIALS
// -------------------------------------------------------------
const SUPER_ADMIN_CREDENTIALS = {
  username: 'phantomenterprises@gmail.com',
  password: '@18922caleb',
  email: 'phantomenterprises@gmail.com'
};

// In-Memory Storage for Users & Verification Codes
const registeredUsers = [];
const verificationCodes = {};

// Mock In-Memory Asset Storage
let assetPrototypes = [
  { id: '1', name: 'Commercial Refrigerator X1', category: 'Appliances', leaseCost: 150.00, dailyYield: 4.50, durationDays: 30, icon: '❄️' },
  { id: '2', name: 'Industrial Washing Machine', category: 'Laundry', leaseCost: 220.00, dailyYield: 5.35, durationDays: 45, icon: '🧺' }
];

// Helper: Send Brevo Verification Email
async function sendBrevoEmail(toEmail, code) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.warn("BREVO_API_KEY environment variable not set. Code:", code);
    return false;
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      sender: { name: 'Phantoms Enterprises', email: 'phantomsenterprises@gmail.com' },
      to: [{ email: toEmail }],
      subject: 'Your Verification Code - Phantoms Enterprises',
      htmlContent: `<div style="font-family:sans-serif;padding:20px;">
        <h2>Welcome to Phantoms Enterprises</h2>
        <p>Your 6-digit registration verification code is:</p>
        <h1 style="color:#d97706;letter-spacing:4px;">${code}</h1>
      </div>`
    })
  });

  return response.ok;
}

// Route: Explicit Login Page
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

// ROUTE 1: Login (Super Admin & Registered Users)
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required' });
  }

  const cleanUsername = username.trim().toLowerCase();
  const superAdminUser = SUPER_ADMIN_CREDENTIALS.username.toLowerCase();

  // Check Super Admin Credentials
  if (cleanUsername === superAdminUser && password === SUPER_ADMIN_CREDENTIALS.password) {
    return res.json({
      success: true,
      user: {
        username: SUPER_ADMIN_CREDENTIALS.username,
        email: SUPER_ADMIN_CREDENTIALS.email,
        role: 'superadmin'
      }
    });
  }

  // Check Registered Users
  const user = registeredUsers.find(u => u.email.toLowerCase() === cleanUsername && u.password === password);
  if (user) {
    return res.json({
      success: true,
      user: {
        username: user.email,
        email: user.email,
        role: 'user'
      }
    });
  }

  return res.status(401).json({ success: false, message: 'Invalid credentials' });
});

// ROUTE 2: Register & Request Brevo Verification Code
app.post('/api/register/send-code', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'Email required' });

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  verificationCodes[email.toLowerCase()] = code;

  const sent = await sendBrevoEmail(email, code);
  return res.json({ success: true, message: 'Verification code sent via Brevo.' });
});

// ROUTE 3: Verify Code & Create Account
app.post('/api/register/verify', (req, res) => {
  const { email, password, code } = req.body;
  const cleanEmail = email.toLowerCase();

  if (verificationCodes[cleanEmail] && verificationCodes[cleanEmail] === code) {
    delete verificationCodes[cleanEmail];
    registeredUsers.push({ email: cleanEmail, password });
    return res.json({ success: true, message: 'Account verified successfully!' });
  }

  return res.status(400).json({ success: false, message: 'Invalid or expired verification code' });
});

// ROUTE 4: Assets Endpoint
app.get('/api/assets', (req, res) => {
  res.json({ success: true, assets: assetPrototypes });
});

// Fallback Route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

