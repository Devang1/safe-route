import express from 'express';
import cors from 'cors';
import pkg from 'pg';
import bodyParser from 'body-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();
const { Pool } = pkg;

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// Database connection using connection string
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:@Devang119@localhost:5432/SafeRoute';

const pool = new Pool({
  connectionString: connectionString,
  // Optional: Add SSL configuration for production (e.g., Render, Heroku)
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Test database connection
pool.connect()
  .then(() => console.log('✅ Connected to PostgreSQL database'))
  .catch(err => console.error('❌ Failed to connect to PostgreSQL:', err.message));

/* ================================
   AUTH ROUTES
================================ */
app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password required' });

  try {
    const existing = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0)
      return res.status(400).json({ error: 'User already exists' });

    const hashed = await bcrypt.hash(password, 10);
    await pool.query('INSERT INTO users (email, password) VALUES ($1, $2)', [email, hashed]);
    res.status(201).json({ message: 'Registered successfully' });
  } catch (error) {
    console.error('❌ Error during register:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Missing email or password' });

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0)
      return res.status(401).json({ error: 'Invalid email or password' });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET || 'safekey', { expiresIn: '7d' });
    res.json({ message: 'Login successful', token, email: user.email });
  } catch (error) {
    console.error('❌ Error during login:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* ================================
   REPORT ROUTES
================================ */
app.get('/api/reports', async (req, res) => {
  try {
    const result = await pool.query('SELECT type, latitude, longitude FROM report');
    const formatted = result.rows.map(row => ({
      category: row.type,
      location: [parseFloat(row.latitude), parseFloat(row.longitude)],
    }));
    res.json(formatted);
  } catch (err) {
    console.error('Error fetching reports:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/reportsDetails', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM report ORDER BY date DESC LIMIT 10');
    const formatted = result.rows.map(row => ({
      date: row.date,
      time: row.time,
      category: row.type,
      description: row.description,
      location: [parseFloat(row.latitude), parseFloat(row.longitude)],
    }));
    res.json(formatted);
  } catch (err) {
    console.error('Error fetching reports:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/submitReport', async (req, res) => {
  try {
    const { category, description, location, timestamp, latitude, longitude } = req.body;
    console.log('Received report:', req.body);
    
    // Validate required fields
    if (!category) {
      return res.status(400).json({ error: 'Category is required.' });
    }
    if (!description) {
      return res.status(400).json({ error: 'Description is required.' });
    }

    // Parse location data
    let lat, lng;
    if (location && Array.isArray(location) && location.length === 2) {
      [lat, lng] = location.map(coord => parseFloat(coord));
    } else if (latitude !== undefined && longitude !== undefined) {
      lat = parseFloat(latitude);
      lng = parseFloat(longitude);
    } else {
      return res.status(400).json({ 
        error: 'Location data required. Provide either location array or latitude/longitude.' 
      });
    }

    // Validate coordinates
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'Invalid coordinates.' });
    }

    // Parse timestamp
    const dateObj = timestamp ? new Date(timestamp) : new Date();
    if (isNaN(dateObj.getTime())) {
      return res.status(400).json({ error: 'Invalid timestamp.' });
    }

    const date = dateObj.toISOString().split('T')[0];
    const time = dateObj.toTimeString().split(' ')[0];

    // Insert into database WITHOUT specifying id (let database generate it)
    const result = await pool.query(
      `INSERT INTO report (type, description, latitude, longitude, date, time)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [category, description, lat, lng, date, time]
    );
    
    console.log('✅ Report saved with ID:', result.rows[0].id);
    
    res.status(201).json({ 
      message: 'Report submitted successfully.', 
      id: result.rows[0].id
    });

  } catch (error) {
    console.error('❌ Error saving report:', error);
    
    // Handle duplicate key error specifically
    if (error.code === '23505') {
      return res.status(400).json({ 
        error: 'Report ID conflict. Please try again.' 
      });
    }
    
    res.status(500).json({ 
      error: 'Internal server error while saving report.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/* ================================
   SOS CONTACT ROUTES
================================ */
app.post('/api/sos', async (req, res) => {
  const { email, sosContacts } = req.body;
  if (!email || !sosContacts?.length)
    return res.status(400).json({ error: 'Missing email or contacts.' });

  try {
    const existing = await pool.query('SELECT * FROM sos_contacts WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      await pool.query('UPDATE sos_contacts SET contacts = $1 WHERE email = $2', [sosContacts, email]);
      res.json({ message: 'SOS contacts updated successfully.' });
    } else {
      await pool.query('INSERT INTO sos_contacts (email, contacts) VALUES ($1, $2)', [email, sosContacts]);
      res.status(201).json({ message: 'SOS contacts saved successfully.' });
    }
  } catch (err) {
    console.error('Error saving SOS contacts:', err.message);
    res.status(500).json({ error: 'Failed to save SOS contacts.' });
  }
});

app.get('/api/sos/:email', async (req, res) => {
  const { email } = req.params;
  try {
    const result = await pool.query('SELECT contacts FROM sos_contacts WHERE email = $1', [email]);
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'No SOS contacts found for this user.' });

    res.json({ contacts: result.rows[0].contacts });
  } catch (err) {
    console.error('Error fetching SOS contacts:', err.message);
    res.status(500).json({ error: 'Database error while fetching SOS contacts.' });
  }
});

/* ================================
   NEARBY ROUTE (Free Overpass API)
================================ */
app.get('/nearby', async (req, res) => {
  const { lat, lon, types } = req.query;
  if (!lat || !lon || !types)
    return res.status(400).json({ error: 'Missing lat, lon, or types' });

  const typeList = types.split(',');
  const radius = 3000; // 3 km

  try {
    const queries = typeList
      .map(
        (t) => `
        node["amenity"="${t}"](around:${radius},${lat},${lon});
        way["amenity"="${t}"](around:${radius},${lat},${lon});
        relation["amenity"="${t}"](around:${radius},${lat},${lon});
      `
      )
      .join('');

    const query = `[out:json];(${queries});out center;`;
    const response = await axios.post('https://overpass-api.de/api/interpreter', query, {
      headers: { 'Content-Type': 'text/plain' },
    });

    const results = (response.data.elements || []).map((el) => ({
      name: el.tags?.name || 'Unknown',
      type: el.tags?.amenity,
      lat: el.lat || el.center?.lat,
      lon: el.lon || el.center?.lon,
    }));

    res.json({ count: results.length, results });
  } catch (err) {
    console.error('Nearby route error:', err.message);
    res.status(500).json({ error: 'Failed to fetch nearby data' });
  }
});

/* ================================
   EMERGENCY ROUTE
================================ */
app.post('/api/emergency', async (req, res) => {
  const { email, location } = req.body;
  if (!email || !location)
    return res.status(400).json({ error: 'Missing email or location.' });

  try {
    const result = await pool.query('SELECT contacts FROM sos_contacts WHERE email = $1', [email]);
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'No SOS contacts found.' });

    const contacts = result.rows[0].contacts;
    const emergencyMsg = `🚨 EMERGENCY ALERT 🚨
User: ${email}
Location: https://www.google.com/maps?q=${location[0]},${location[1]}
Please reach out immediately!`;

    console.log('🚨 Sending SOS alert to:', contacts);
    console.log('Message:', emergencyMsg);

    res.json({ message: 'Emergency alert triggered successfully.', sentTo: contacts, preview: emergencyMsg });
  } catch (err) {
    console.error('Error during emergency trigger:', err.message);
    res.status(500).json({ error: 'Failed to send emergency alerts.' });
  }
});

/* ================================
   CHATBOT ROUTE
================================ */
app.post('/api/chatbot', async (req, res) => {
  const { message, lat, lon } = req.body;
  if (!message) return res.status(400).json({ reply: 'Message required.' });

  const text = message.toLowerCase();

  if (text.includes('hospital'))
    return res.redirect(`/nearby?lat=${lat}&lon=${lon}&types=hospital`);
  if (text.includes('police'))
    return res.redirect(`/nearby?lat=${lat}&lon=${lon}&types=police`);
  if (text.includes('restroom') || text.includes('toilet'))
    return res.redirect(`/nearby?lat=${lat}&lon=${lon}&types=toilets`);
  if (text.includes('help') || text.includes('danger'))
    return res.json({ reply: '🚨 SOS mode activated! Sending alert to your emergency contacts...' });

  return res.json({ reply: 'I can help you find hospitals, police stations, restrooms, or send SOS alerts. Try typing "nearest hospital".' });
});

/* ================================
   HEALTH CHECK ROUTE
================================ */
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'OK', database: 'Connected', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ status: 'Error', database: 'Disconnected', error: error.message });
  }
});

/* ================================
   START SERVER
================================ */
app.listen(port, () => {
  console.log(`🚀 SafeRoute backend running on http://localhost:${port}`);
  console.log(`📊 Database: ${connectionString.split('@')[1] || connectionString}`);
});