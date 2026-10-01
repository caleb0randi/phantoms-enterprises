```javascript
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const SUPER_ADMIN_CREDENTIALS = {
  username: process.env.SUPER_ADMIN_USERNAME || 'phantomsenterprises@gmail.com',
  password: process.env.SUPER_ADMIN_PASSWORD || '@18922caleb',
  email: process.env.SUPER_ADMIN_EMAIL || 'phantomsenterprises@gmail.com'
};

const registeredUsers = []; 
const verificationCodes = {}; 
const passwordResetCodes = {}; 
const pendingWithdrawals = []; 

function generateReferralCode(email) {
  const prefix = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${random}`;
}

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

app.get('/login', (req, res) => {
  const rootLoginPath = path.join(__dirname, 'login.html');
  const publicLoginPath = path.join(__dirname, 'public', 'login.html');

  if (fs.existsSync(rootLoginPath)) {
    res.sendFile(rootLoginPath);
  } else if (fs.existsSync(publicLoginPath)) {
    res.sendFile(publicLoginPath);
  } else {
    res.status(404).send('login.html not found in root or public directory.');
  }
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username/Email and password are required' });
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

  const user = registeredUsers.find(u => u.email.toLowerCase() === cleanInput && u.password === password);
  if (user) {
    return res.json({
      success: true,
      user: {
        username: user.email,
        email: user.email,
        role: 'user',
        referralCode: user.referralCode,
        referredCount: user.referredCount || 0
      }
    });
  }

  return res.status(401).json({ success: false, message: 'Invalid credentials. Please verify email and password.' });
});

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

app.post('/api/register/verify', (req, res) => {
  const { email, password, code, referredBy } = req.body;
  const cleanEmail = email ? email.toLowerCase() : '';

  if (verificationCodes[cleanEmail] && verificationCodes[cleanEmail] === code) {
    delete verificationCodes[cleanEmail];
    
    const userRefCode = generateReferralCode(cleanEmail);
    
    if (referredBy) {
      const referrer = registeredUsers.find(u => u.referralCode === referredBy || u.email.toLowerCase() === referredBy.toLowerCase());
      if (referrer) {
        referrer.referredCount = (referrer.referredCount || 0) + 1;
      }
    }

    const newUser = {
      email: cleanEmail,
      password,
      referralCode: userRefCode,
      referredBy: referredBy || null,
      referredCount: 0
    };

    registeredUsers.push(newUser);

    return res.json({ 
      success: true, 
      message: 'Account verified and created successfully!',
      user: {
        email: newUser.email,
        referralCode: newUser.referralCode
      }
    });
  }

  return res.status(400).json({ success: false, message: 'Invalid or expired verification code' });
});

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

app.get('/api/user/referrals', (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ success: false, message: 'User email is required' });

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

app.get('/api/admin/withdrawals', (req, res) => {
  res.json({ success: true, withdrawals: pendingWithdrawals });
});

app.post('/api/admin/approve-withdrawal', (req, res) => {
  const { withdrawalId, action } = req.body;
  const index = pendingWithdrawals.findIndex(w => w.id === withdrawalId);

  if (index !== -1) {
    pendingWithdrawals[index].status = action === 'Approve' ? 'Approved' : 'Rejected';
    return res.json({ success: true, message: `Withdrawal request ${action.toLowerCase()}d successfully!` });
  }

  return res.status(404).json({ success: false, message: 'Withdrawal request not found' });
});

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

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Phantoms Enterprises Server running on port ${PORT}`);
});
```
