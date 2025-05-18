import express from 'express';
import cors from 'cors';
import pkg from 'pg';
import bodyParser from 'body-parser';

const { Pool } = pkg;

const app = express();
const port = 5000;

app.use(cors());
app.use(bodyParser.json());

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: "SafeRoute",
  password: '@Devang119',
  port: 5432,
});

pool.connect()
  .then(() => console.log('Connected to PostgreSQL'))
  .catch(err => console.error('Failed to connect to PostgreSQL:', err.message));

app.get('/api/reports', async (req, res) => {
  try {
    const result = await pool.query('SELECT type, latitude, longitude FROM report');
    const formatted = result.rows.map((row) => ({
      category: row.type,
      location: [parseFloat(row.latitude), parseFloat(row.longitude)],
    }));
    res.json(formatted);
  } catch (err) {
    console.error('Error fetching reports:', err.message);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});
app.get('/api/reportsDetails', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM report ORDER BY DATE DESC LIMIT 10');
      const formatted = result.rows.map((row) => ({
        date: row.date,
        time: row.time,
        category: row.type,
        description: row.description,
        location: [parseFloat(row.latitude), parseFloat(row.longitude)],
      }));
      res.json(formatted);
    } catch (err) {
      console.error('Error fetching reports:', err.message);
      res.status(500).json({ error: 'Database error2', details: err.message });
    }
  });
  app.post('/api/submitReport', async (req, res) => {
    const { category, description, location, timestamp } = req.body;
  
    if (!category || !description || !location || !timestamp) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }
  
    const [latitude, longitude] = location;
  
    try {
      const dateObj = new Date(timestamp);
      const date = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD
      const time = dateObj.toTimeString().split(' ')[0]; // HH:MM:SS
  
      const result = await pool.query(
        `INSERT INTO report (type, description, latitude, longitude, date, time)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [category, description, latitude, longitude, date, time]
      );
  
      res.status(201).json({ message: 'Report saved successfully.', id: result.rows[0].id });
    } catch (error) {
      console.error('Error saving report:', error);
      res.status(500).json({ error: 'Failed to save report.' });
    }
  });

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
