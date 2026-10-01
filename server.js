const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// Super Admin Credentials
const SUPER_ADMIN_CREDENTIALS = {
  username: process.env.SUPER_ADMIN_USERNAME || 'phantomsenterprises@gmail.com',
  password: process.env.SUPER_ADMIN_PASSWORD || '@18922caleb',
  email: process.env.SUPER_ADMIN_EMAIL || 'phantomsenterprises@gmail.com'
};

// In-Memory Storage
const registeredUsers = [];
const verificationCodes = {};
const passwordResetCodes = {};
const pendingWithdrawals = [];

function generateReferralCode(emailOrPhone) {
  const prefix = emailOrPhone.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5).toUpperCase();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${random}`;
}

// Brevo Email Dispatch Helper
function sendBrevoEmail(toEmail, subject, textContent, htmlContent) {
  return new Promise((resolve) => {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
      console.warn("BREVO_API_KEY missing.");
      return resolve({ success: false, reason: "API key missing" });
    }

    const payload = JSON.stringify({
      sender: { name: 'Phantoms Enterprises', email: 'phantomsenterprises@gmail.com' },
      to: [{ email: toEmail }],
      subject: subject,
      htmlContent: htmlContent
    });

    const options = {
      hostname: 'api.brevo.com',
      port: 443,
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({ success: res.statusCode >= 200 && res.statusCode < 300, data: body });
      });
    });

    req.on('error', (err) => resolve({ success: false, error: err.message }));
    req.write(payload);
    req.end();
  });
}

// ROOT ROUTE: Direct landing page is Registration/Login
app.get('/', (req, res) => {
  const loginPath = path.join(__dirname, 'login.html');
  if (fs.existsSync(loginPath)) {
    return res.sendFile(loginPath);
  }
  return res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// LOGIN PAGE ROUTE
app.get('/login', (req, res) => {
  const loginPath = path.join(__dirname, 'login.html');
  if (fs.existsSync(loginPath)) {
    return res.sendFile(loginPath);
  }
  return res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// DASHBOARD ROUTE (Protected view target)
app.get('/dashboard', (req, res) => {
  const dashboardPath = path.join(__dirname, 'public', 'dashboard.html');
  const rootDashPath = path.join(__dirname, 'dashboard.html');

  if (fs.existsSync(dashboardPath)) {
    return res.sendFile(dashboardPath);
  } else if (fs.existsSync(rootDashPath)) {
    return res.sendFile(rootDashPath);
  } else {
    return res.status(404).send('dashboard.html not found.');
  }
});

// API: Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username/Phone and password are required' });
  }

  const cleanInput = username.trim().toLowerCase();
  const superAdminUser = SUPER_ADMIN_CREDENTIALS.username.trim().toLowerCase();
  const superAdminEmail = SUPER_ADMIN_CREDENTIALS.email.trim().toLowerCase();

  if ((cleanInput === superAdminUser || cleanInput === superAdminEmail) && password === SUPER_ADMIN_CREDENTIALS.password) {
    return res.json({
      success: true,
      user: {
        username: SUPER_ADMIN_CREDENTIALS.username,
        email: SUPER_ADMIN_CREDENTIALS.email,
        role: 'superadmin',
        referralCode: 'ADMIN'
      }
    });
  }

  const user = registeredUsers.find(u => (u.email.toLowerCase() === cleanInput || u.phone === cleanInput) && u.password === password);
  if (user) {
    return res.json({
      success: true,
      user: {
        username: user.phone || user.email,
        email: user.email,
        role: 'user',
        referralCode: user.referralCode,
        referredCount: user.referredCount || 0
      }
    });
  }

  return res.status(401).json({ success: false, message: 'Invalid credentials.' });
});

// API: Registration Code
app.post('/api/register/send-code', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'Email address is required' });

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  verificationCodes[email.toLowerCase()] = code;

  const html = `<div style="font-family:sans-serif;padding:20px;background:#0f172a;color:#f8fafc;border-radius:12px;">
    <h2 style="color:#ffffff;">Welcome to Phantoms Enterprises</h2>
    <p style="color:#cbd5e1;">Your 6-digit registration code is:</p>
    <h1 style="color:#f59e0b;letter-spacing:6px;font-size:36px;">${code}</h1>
  </div>`;

  await sendBrevoEmail(email, 'Your Verification Code - Phantoms Enterprises', `Your code is ${code}`, html);
  return res.json({ success: true, message: 'Verification code sent to your email.' });
});

// API: Register Verify
app.post('/api/register/verify', (req, res) => {
  const { phone, password, confirmPassword, inviteCode, captcha, email, code } = req.body;

  if (password !== confirmPassword) {
    return res.status(400).json({ success: false, message: 'Passwords do not match.' });
  }

  const cleanEmail = email ? email.toLowerCase() : `${phone}@phantoms.app`;

  if (email && verificationCodes[cleanEmail] && verificationCodes[cleanEmail] !== code) {
    return res.status(400).json({ success: false, message: 'Invalid email verification code.' });
  }

  if (email) delete verificationCodes[cleanEmail];

  const userRefCode = generateReferralCode(phone || cleanEmail);

  if (inviteCode) {
    const referrer = registeredUsers.find(u => u.referralCode === inviteCode);
    if (referrer) {
      referrer.referredCount = (referrer.referredCount || 0) + 1;
    }
  }

  const newUser = {
    phone: phone || '',
    email: cleanEmail,
    password,
    referralCode: userRefCode,
    referredBy: inviteCode || null,
    referredCount: 0
  };

  registeredUsers.push(newUser);

  return res.json({
    success: true,
    message: 'Account created successfully!',
    user: { email: newUser.email, phone: newUser.phone, referralCode: newUser.referralCode }
  });
});

// API: Password Reset Code
app.post('/api/forgot-password/send-code', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

  const cleanEmail = email.toLowerCase();
  const user = registeredUsers.find(u => u.email.toLowerCase() === cleanEmail);

  if (!user) {
    return res.status(404).json({ success: false, message: 'No registered account found with this email.' });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  passwordResetCodes[cleanEmail] = code;

  const html = `<div style="font-family:sans-serif;padding:20px;background:#0f172a;color:#f8fafc;border-radius:12px;">
    <h2 style="color:#ffffff;">Password Reset Request</h2>
    <p style="color:#cbd5e1;">Your password reset code is:</p>
    <h1 style="color:#f59e0b;letter-spacing:6px;font-size:36px;">${code}</h1>
  </div>`;

  await sendBrevoEmail(cleanEmail, 'Password Reset Code - Phantoms Enterprises', `Your reset code is ${code}`, html);
  return res.json({ success: true, message: 'Password reset code sent to your inbox.' });
});

// API: Reset Password
app.post('/api/forgot-password/reset', (req, res) => {
  const { email, code, newPassword } = req.body;
  const cleanEmail = email ? email.toLowerCase() : '';

  if (passwordResetCodes[cleanEmail] && passwordResetCodes[cleanEmail] === code) {
    delete passwordResetCodes[cleanEmail];
    const user = registeredUsers.find(u => u.email.toLowerCase() === cleanEmail);
    if (user) {
      user.password = newPassword;
      return res.json({ success: true, message: 'Password reset successfully!' });
    }
  }

  return res.status(400).json({ success: false, message: 'Invalid or expired reset code.' });
});

// API: Referrals
app.get('/api/user/referrals', (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

  const user = registeredUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (user) {
    return res.json({
      success: true,
      referralCode: user.referralCode,
      referredCount: user.referredCount || 0
    });
  }

  return res.json({ success: true, referralCode: generateReferralCode(email), referredCount: 0 });
});

// API: Withdrawals
app.post('/api/withdraw/request', (req, res) => {
  const { userEmail, amount, provider, phone } = req.body;
  if (!userEmail || !amount || !provider || !phone) {
    return res.status(400).json({ success: false, message: 'All details are required' });
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
  return res.json({ success: true, message: 'Withdrawal submitted for Super Admin approval.', data: requestObj });
});

// API: Admin Withdrawals
app.get('/api/admin/withdrawals', (req, res) => {
  res.json({ success: true, withdrawals: pendingWithdrawals });
});

// API: Admin Approve
app.post('/api/admin/approve-withdrawal', (req, res) => {
  const { withdrawalId, action } = req.body;
  const index = pendingWithdrawals.findIndex(w => w.id === withdrawalId);

  if (index !== -1) {
    pendingWithdrawals[index].status = action === 'Approve' ? 'Approved' : 'Rejected';
    return res.json({ success: true, message: `Withdrawal ${action.toLowerCase()}d successfully!` });
  }

  return res.status(404).json({ success: false, message: 'Withdrawal request not found.' });
});

// API: Admin Password Reset
app.post('/api/admin/reset-user-password', (req, res) => {
  const { targetEmail, newPassword } = req.body;
  const cleanEmail = targetEmail ? targetEmail.toLowerCase() : '';

  const user = registeredUsers.find(u => u.email.toLowerCase() === cleanEmail);
  if (user) {
    user.password = newPassword;
    return res.json({ success: true, message: `Password for ${targetEmail} updated successfully!` });
  }

  return res.status(404).json({ success: false, message: 'User email not found.' });
});

app.listen(PORT, () => {
  console.log(`Phantoms Enterprises Server running on port ${PORT}`);
});
      
