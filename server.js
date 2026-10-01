const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend files from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// In-Memory Database State for Prototypes & Users
let assets = [
  {
    id: 'asset-1',
    name: 'Smart Double-Door Refrigerator',
    category: 'Kitchen Appliances',
    icon: '\u{1F9CA}',
    leaseCost: 150,
    dailyYield: 3.75,
    durationDays: 30,
    totalUnits: 25,
    rentedUnits: 12
  },
  {
    id: 'asset-2',
    name: 'Commercial Front-Load Washing Machine',
    category: 'Laundry Equipment',
    icon: '\u{1F9FA}',
    leaseCost: 220,
    dailyYield: 6.10,
    durationDays: 45,
    totalUnits: 15,
    rentedUnits: 9
  },
  {
    id: 'asset-3',
    name: 'Solar-Powered Cold Storage Fridge',
    category: 'Commercial Cooling',
    icon: '\u{26A1}',
    leaseCost: 400,
    dailyYield: 12.00,
    durationDays: 60,
    totalUnits: 10,
    rentedUnits: 4
  }
];

let users = [
  {
    id: 'usr-admin-1',
    name: 'Primary Admin',
    email: 'admin@phantoms.com',
    role: 'SUPER_ADMIN',
    walletBalance: 5000.00,
    activeLeases: []
  }
];

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', app: 'Phantoms Enterprises API' });
});

app.get('/api/assets', (req, res) => {
  res.json({ success: true, assets });
});

// Admin Route: Add new asset prototype
app.post('/api/admin/assets', (req, res) => {
  const { name, category, icon, leaseCost, dailyYield, durationDays, totalUnits } = req.body;
  
  if (!name || !leaseCost || !dailyYield) {
    return res.status(400).json({ success: false, message: 'Missing required asset fields' });
  }

  const newAsset = {
    id: `asset-${Date.now()}`,
    name,
    category: category || 'General Electronics',
    icon: icon || '\u{1F4FB}',
    leaseCost: parseFloat(leaseCost),
    dailyYield: parseFloat(dailyYield),
    durationDays: parseInt(durationDays) || 30,
    totalUnits: parseInt(totalUnits) || 10,
    rentedUnits: 0
  };

  assets.push(newAsset);
  res.status(201).json({ success: true, asset: newAsset });
});

// Admin Route: Delete asset prototype
app.delete('/api/admin/assets/:id', (req, res) => {
  const { id } = req.params;
  assets = assets.filter(item => item.id !== id);
  res.json({ success: true, message: 'Asset prototype removed successfully' });
});

// Catch-all route to serve the frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Render Dynamic Port Binding
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Phantoms Enterprises running on http://0.0.0.0:${PORT}`);
});
    
