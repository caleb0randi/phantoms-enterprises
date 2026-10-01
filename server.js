const express = require('express');
const path = require('path');

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

// Mock In-Memory Asset Storage
let assetPrototypes = [
  { id: '1', name: 'Commercial Refrigerator X1', category: 'Appliances', leaseCost: 150.00, dailyYield: 4.50, durationDays: 30, icon: '❄️' },
  { id: '2', name: 'Industrial Washing Machine', category: 'Laundry', leaseCost: 220.00, dailyYield: 5.35, durationDays: 45, icon: '🧺' }
];

// Serve login page explicitly when visiting /login
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

// API ROUTE 1: Login Endpoint with Credentials Verification
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required' });
  }

  const cleanUsername = username.trim().toLowerCase();
  const targetUsername = SUPER_ADMIN_CREDENTIALS.username.toLowerCase();

  // Check if provided credentials match Super Admin
  if (
    cleanUsername === targetUsername && 
    password === SUPER_ADMIN_CREDENTIALS.password
  ) {
    return res.json({
      success: true,
      user: {
        username: SUPER_ADMIN_CREDENTIALS.username,
        email: SUPER_ADMIN_CREDENTIALS.email,
        role: 'superadmin'
      }
    });
  }

  // Reject invalid attempts or fallback for standard user
  return res.status(401).json({
    success: false,
    message: 'Invalid username or password'
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
            
