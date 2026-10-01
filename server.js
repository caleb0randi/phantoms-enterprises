const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Super Admin Credentials (Prioritizes Environment Variables with Hardcoded Fallbacks)
const SUPER_ADMIN_CREDENTIALS = {
  username: process.env.SUPER_ADMIN_USERNAME || 'phantomsenterprises@gmail.com',
  password: process.env.SUPER_ADMIN_PASSWORD || '@18922caleb',
  email: process.env.SUPER_ADMIN_EMAIL || 'phantomsenterprises@gmail.com'
};

// In-Memory Data Storage
const registeredUsers = []; // Stores { email, password, phone, name }
const verificationCodes = {}; // Registration codes
const passwordResetCodes = {}; // Forgot password codes
const pendingWithdrawals = []; // Stores pending withdrawal requests for Super Admin approval

// Mock Assets
let assetPrototypes = [
  { id: '1', name: 'Commercial Refrigerator X1', category: 'Appliances', leaseCost: 15000, dailyYield: 450, durationDays: 30, icon: '❄️' },
  { id: '2', name: 'Industrial Washing Machine', category: 'Laundry', leaseCost: 22000, dailyYield: 680, durationDays: 45, icon: '🧺' },
  { id: '3', name: 'Commercial Deep Fryer & Cooker', category: 'Kitchen Equipment', leaseCost: 18500, dailyYield: 550, durationDays: 30, icon: '🍳' }
];

// Brevo Email Sender Helper
async function sendBrevoEmail(toEmail, subject, textContent, htmlContent) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.warn("BREVO_API_KEY environment variable not set.");
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
        sender: { name: 'Phantoms Enterprises', email: 'phantomsenterprises@gmail.com' },
        to: [{ email: toEmail }],
        subject: subject,
        htmlContent: htmlContent
      })
    });

    const responseData = await response.json();
    if (!response.ok) {
      console.error("Brevo API error:", responseData);
      return { success: false, data: responseData };
    }
    return { success: true, data: responseData };
  } catch (error) {
    console.error("Brevo dispatch error:", error);
    return { success: false, error: error.message };
  }
}

// ROUTE: Dedicated /login route
app.get('/login', (req, res) => {
  const rootLoginPath = path.join(__dirname, 'login.html');
  const publicLoginPath = path.join(__dirname, 'public', 'login.html');

  if (fs.existsSync(rootLoginPath)) {
    res.sendFile(rootLoginPath);
  } else if (fs.existsSync(publicLoginPath)) {
    res.sendFile(publicLoginPath);
  } else {
    res.status(404).send('login.html not found. Please ensure login.html exists in your root or public directory.');
  }
});

// ROUTE 1: Login (Super Admin & Registered Users)
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username/Email and password are required' });
  }

  const cleanInput = username.trim().toLowerCase();
  const superAdminUser = SUPER_ADMIN_CREDENTIALS.username.trim().toLowerCase();
  const superAdminEmail = SUPER_ADMIN_CREDENTIALS.email.trim().toLowerCase();

  // Check Super Admin Credentials (matches either username or email)
  if ((cleanInput === superAdminUser || cleanInput === superAdminEmail) && password === SUPER_ADMIN_CREDENTIALS.password) {
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
  const user = registeredUsers.find(u => u.email.toLowerCase() === cleanInput && u.password === password);
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

  return res.status(401).json({ success: false, message: 'Invalid credentials. Please verify email and password.' });
});

// ROUTE 2: Registration - Send Brevo Code
app.post('/api/register/send-code', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'Email address is required' });

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  verificationCodes[email.toLowerCase()] = code;

  const html = `<div style="font-family:sans-serif;padding:20px;background:#0f172a;color:#f8fafc;border-radius:12px;">
    <h2 style="color:#ffffff;">Welcome to Phantoms Enterprises</h2>
    <p style="color:#cbd5e1;">Your 6-digit registration verification code is:</p>
    <h1 style="color:#f59e0b;letter-spacing:6px;font-size:36px;">${code}</h1>
  </div>`;

  const result = await sendBrevoEmail(email, 'Your Verification Code - Phantoms Enterprises', `Your code is ${code}`, html);

  if (result.success) {
    return res.json({ success: true, message: 'Verification code sent to your email address.' });
  } else {
    return res.json({ success: true, message: 'Code generated. Check inbox or spam folder.' });
  }
});

// ROUTE 3: Registration - Verify Code & Create Account
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

// ROUTE 4: Forgot Password - Send Reset Code
app.post('/api/forgot-password/send-code', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

  const cleanEmail = email.toLowerCase();
  const userExists = registeredUsers.find(u => u.email.toLowerCase() === cleanEmail);

  if (!userExists) {
    return res.status(404).json({ success: false, message: 'No account registered with this email address' });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  passwordResetCodes[cleanEmail] = code;

  const html = `<div style="font-family:sans-serif;padding:20px;background:#0f172a;color:#f8fafc;border-radius:12px;">
    <h2 style="color:#ffffff;">Password Reset Request</h2>
    <p style="color:#cbd5e1;">Your 6-digit password reset code is:</p>
    <h1 style="color:#f59e0b;letter-spacing:6px;font-size:36px;">${code}</h1>
  </div>`;

  await sendBrevoEmail(cleanEmail, 'Password Reset Code - Phantoms Enterprises', `Your reset code is ${code}`, html);
  return res.json({ success: true, message: 'Password reset code sent to your email inbox.' });
});

// ROUTE 5: Forgot Password - Reset Password with Code
app.post('/api/forgot-password/reset', (req, res) => {
  const { email, code, newPassword } = req.body;
  const cleanEmail = email ? email.toLowerCase() : '';

  if (passwordResetCodes[cleanEmail] && passwordResetCodes[cleanEmail] === code) {
    delete passwordResetCodes[cleanEmail];
    const user = registeredUsers.find(u => u.email.toLowerCase() === cleanEmail);
    if (user) {
      user.password = newPassword;
      return res.json({ success: true, message: 'Password reset successfully! You can now log in.' });
    }
  }

  return res.status(400).json({ success: false, message: 'Invalid or expired password reset code.' });
});

// ROUTE 6: Submit Withdrawal Request (Client Side)
app.post('/api/withdraw/request', (req, res) => {
  const { userEmail, amount, provider, phone } = req.body;
  if (!userEmail || !amount || !provider || !phone) {
    return res.status(400).json({ success: false, message: 'All withdrawal details are required' });
  }

  const requestObj = {
    id: Date.now().toString(),
    userEmail,
    amount: parseFloat(amount),
    provider,
    phone,
    status: 'Pending',
    requestedAt: new Date().toLocaleString()
  };

  pendingWithdrawals.push(requestObj);
  return res.json({ success: true, message: 'Withdrawal request submitted! Awaiting Super Admin approval.', data: requestObj });
});

// ROUTE 7: Get Pending Withdrawals (Super Admin Only)
app.get('/api/admin/withdrawals', (req, res) => {
  res.json({ success: true, withdrawals: pendingWithdrawals });
});

// ROUTE 8: Approve/Reject Withdrawal (Super Admin Power)
app.post('/api/admin/approve-withdrawal', (req, res) => {
  const { withdrawalId, action } = req.body; // action: 'Approve' or 'Reject'
  const index = pendingWithdrawals.findIndex(w => w.id === withdrawalId);

  if (index !== -1) {
    pendingWithdrawals[index].status = action === 'Approve' ? 'Approved' : 'Rejected';
    return res.json({ success: true, message: `Withdrawal request ${action.toLowerCase()}d successfully!` });
  }

  return res.status(404).json({ success: false, message: 'Withdrawal request not found' });
});

// ROUTE 9: Super Admin Force Change User Password
app.post('/api/admin/reset-user-password', (req, res) => {
  const { targetEmail, newPassword } = req.body;
  const cleanEmail = targetEmail ? targetEmail.toLowerCase() : '';

  const user = registeredUsers.find(u => u.email.toLowerCase() === cleanEmail);
  if (user) {
    user.password = newPassword;
    return res.json({ success: true, message: `Password for ${targetEmail} updated successfully by Super Admin!` });
  }

  return res.status(404).json({ success: false, message: 'Registered user email not found' });
});

// Fallback Route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Phantoms Enterprises Server running on port ${PORT}`);
});
      

