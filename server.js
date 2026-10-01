const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Whitelist of authorized Super Admin email addresses
const ADMIN_EMAILS = [
  'phantomsenterprises@gmail.com'
];

// Mock In-Memory Asset Storage
let assetPrototypes = [
  { id: '1', name: 'Commercial Refrigerator X1', category: 'Appliances', leaseCost: 150.00, dailyYield: 4.50, durationDays: 30, icon: '❄️' },
  { id: '2', name: 'Industrial Washing Machine', category: 'Laundry', leaseCost: 220.00, dailyYield: 5.35, durationDays: 45, icon: '🧺' }
];

// Serve login page explicitly when visiting /login
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

// API ROUTE 1: Login Endpoint with Whitelist Role Assignment
app.post('/api/login', (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  const cleanEmail = email.trim().toLowerCase();
  
  // Check if logging-in email exists in ADMIN_EMAILS whitelist
  const isAdmin = ADMIN_EMAILS.includes(cleanEmail);
  const userRole = isAdmin ? 'admin' : 'user';

  return res.json({
    success: true,
    user: {
      email: cleanEmail,
      role: userRole
    }
  });
});

// API ROUTE 2: Get All Lease Assets
app.get('/api/assets', (req, res) => {
  res.json({ success: true, assets: assetPrototypes });
});

// API ROUTE 3: Admin Only - Delete Asset Prototype
app.delete('/api/admin/assets/:id', (req, res) => {
  const { id } = req.params;
  assetPrototypes = assetPrototypes.filter(asset => asset.id !== id);
  res.json({ success: true, message: 'Asset deleted successfully' });
});

// Fallback route serving the main dashboard
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
         
