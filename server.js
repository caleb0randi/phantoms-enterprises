const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Super Admin Credentials
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

// Helper: Send Brevo Verification Email with Detailed Response Handling
async function sendBrevoEmail(toEmail, code) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.warn("BREVO_API_KEY environment variable not set. Code generated:", code);
    return { success: false, reason: "API key missing" };
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: 'Phantoms Enterprises', email: 'phantomenterprises@gmail.com' },
        to: [{ email: toEmail }],
        subject: 'Your Verification Code - Phantoms Enterprises',
        htmlContent: `<div style="font-family:sans-serif;padding:20px;background:#0f172a;color:#f8fafc;border-radius:12px;">
          <h2 style="color:#ffffff;">Welcome to Phantoms Enterprises</h2>
          <p style="color:#cbd5e1;">Your 6-digit registration verification code is:</p>
          <h1 style="color:#f59e0b;letter-spacing:6px;font-size:36px;">${code}</h1>
          <p style="color:#94a3b8;font-size:12px;">If you did not request this code, please ignore this email.</p>
        </div>`
      })
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error("Brevo API error response:", responseData);
      return { success: false, data: responseData };
    }

    console.log("Brevo email dispatched successfully:", responseData);
    return { success: true, data: responseData };
  } catch (error) {
    console.error("Brevo connection error:", error);
    return { success: false, error: error.message };
  }
}

// Dedicated /login route (Checks both root and public/ directory for login.html)
app.get('/login', (req, res) => {
  const rootLoginPath = path.join(__dirname, 'login.html');
  const publicLoginPath = path.join(__dirname, 'public', 'login.html');

  if (fs.existsSync(rootLoginPath)) {
    res.sendFile(rootLoginPath);
  } else if (fs.existsSync(publicLoginPath)) {
    res.sendFile(publicLoginPath);
  } else {
    res.status(404).send('login.html not found. Please ensure login.html exists in your root or public folder.');
  }
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
  if (!email) return res.status(400).json({ success: false, message: 'Email address is required' });

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  verificationCodes[email.toLowerCase()] = code;

  const result = await sendBrevoEmail(email, code);

  if (result.success) {
    return res.json({ success: true, message: 'Verification code sent! Please check your inbox and spam folder.' });
  } else {
    return res.json({ 
      success: true, 
      message: 'Code generated. If email delivery is delayed, check spam or Brevo sender status.',
      debugCode: process.env.NODE_ENV !== 'production' ? code : undefined 
    });
  }
});

// ROUTE 3: Verify Code & Create Account
app.post('/api/register/verify', (req, res) => {
  const { email, password, code } = req.body;
  const cleanEmail = email ? email.toLowerCase() : '';

  if (verificationCodes[cleanEmail] && verificationCodes[cleanEmail] === code) {
    delete verificationCodes[cleanEmail];
    registeredUsers.push({ email: cleanEmail, password });
    return res.json({ success: true, message: 'Account verified and created successfully!' });
  }

  return res.status(400).json({ success: false, message: 'Invalid or expired verification code' });
});

// ROUTE 4: Assets Endpoint
app.get('/api/assets', (req, res) => {
  res.json({ success: true, assets: assetPrototypes });
});

// Fallback Route (Only serves main dashboard for unknown routes)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
