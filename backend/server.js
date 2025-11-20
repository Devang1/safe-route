import express from "express";
import cors from "cors";
import pkg from "pg";
import bodyParser from "body-parser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import axios from "axios";
import ImageKit from "imagekit";
import path from "path";

// dotenv.config({ path: path.resolve("./backend/.env") });
dotenv.config();
const { Pool } = pkg;

const app = express();
const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://safe-route-119-frontend.onrender.com",
    ],
    credentials: true,
  })
);
app.use(bodyParser.json());

// Authentication middleware to check user is logged in or not

export const authMiddleware = (req, res, next) => {
  // 1. Get Authorization header
  const authHeader = req.headers.authorization;

  if (!authHeader)
    return res.status(401).json({ error: "Missing Authorization header" });

  // 2. Extract token
  const token = authHeader.split(" ")[1];

  if (!token)
    return res.status(401).json({ error: "Token missing after Bearer" });

  // 3. Try decoding token
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "safekey");

    req.user = decoded;
    next();
  } catch (e) {
    console.log("TOKEN VERIFY ERROR:", e.message);
    return res.status(401).json({ error: "Invalid token" });
  }
};

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

app.get("/api/imagekit-auth", async (req, res) => {
  try {
    const authenticationParameters = imagekit.getAuthenticationParameters();
    res.json(authenticationParameters);
  } catch (error) {
    console.error("❌ Error generating ImageKit auth params:", error.message);
    res.status(500).json({
      error: "Failed to generate ImageKit authentication parameters.",
    });
  }
});

// Database connection using connection string
const connectionString =
  process.env.DATABASE_URL|| "postgresql://postgres:123456789@localhost:5432/SafeRoute";

const pool = new Pool({
  connectionString: connectionString,
  // Optional: Add SSL configuration for production (e.g., Render, Heroku)
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

// Test database connection
pool
  .connect()
  .then(() => console.log("✅ Connected to PostgreSQL database"))
  .catch((err) =>
    console.error("❌ Failed to connect to PostgreSQL:", err.message)
  );

/* ================================
   AUTH ROUTES
================================ */
app.post("/api/register", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password required" });

  try {
    const existing = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    if (existing.rows.length > 0)
      return res.status(400).json({ error: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);
    await pool.query("INSERT INTO users (email, password) VALUES ($1, $2)", [
      email,
      hashed,
    ]);
    res.status(201).json({ message: "Registered successfully" });
  } catch (error) {
    console.error("❌ Error during register:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  console.log("Login attempt for:", req.body);
  if (!email || !password)
    return res.status(400).json({ error: "Missing email or password" });

  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    if (result.rows.length === 0)
      return res.status(401).json({ error: "Invalid email or password" });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(401).json({ error: "Invalid email or password" });

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.json({ message: "Login successful", token, email: user.email });
  } catch (error) {
    console.error("❌ Error during login:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ================================
   REPORT ROUTES
================================ */
// app.get('/api/reports', async (req, res) => {
//   try {
//     const result = await pool.query('SELECT type, latitude, longitude FROM report');
//     const formatted = result.rows.map(row => ({
//       category: row.type,
//       location: [parseFloat(row.latitude), parseFloat(row.longitude)],
//     }));
//     res.json(formatted);
//   } catch (err) {
//     console.error('Error fetching reports:', err.message);
//     res.status(500).json({ error: 'Database error' });
//   }
// });

// app.get('/api/reportsDetails', async (req, res) => {
//   try {
//     const result = await pool.query('SELECT * FROM report ORDER BY date DESC LIMIT 10');
//     const formatted = result.rows.map(row => ({
//       date: row.date,
//       time: row.time,
//       category: row.type,
//       description: row.description,
//       location: [parseFloat(row.latitude), parseFloat(row.longitude)],
//     }));
//     res.json(formatted);
//   } catch (err) {
//     console.error('Error fetching reports:', err.message);
//     res.status(500).json({ error: 'Database error' });
//   }
// });

// Revised report fetching with more details
/* ================================
   REPORT ROUTES
================================ */
app.get("/api/reports", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, type, latitude, longitude, image_url, upvotes, downvotes, created_by FROM report"
    );
    const formatted = result.rows.map((row) => ({
      id: row.id,
      category: row.type,
      location: [parseFloat(row.latitude), parseFloat(row.longitude)],
      image_url: row.image_url,
      upvotes: row.upvotes,
      downvotes: row.downvotes,
    }));
    res.json(formatted);
  } catch (err) {
    console.error("Error fetching reports:", err.message);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/reportsDetails", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM report ORDER BY date DESC LIMIT 10"
    );
    const formatted = result.rows.map((row) => ({
      id: row.id,
      date: row.date,
      time: row.time,
      category: row.type,
      description: row.description,
      location: [parseFloat(row.latitude), parseFloat(row.longitude)],
      image_url: row.image_url,
      upvotes: row.upvotes,
      downvotes: row.downvotes,
      created_by: row.created_by,
    }));
    // console.log('Fetched reports details:', formatted);
    res.json(formatted);
  } catch (err) {
    console.error("Error fetching reports:", err.message);
    res.status(500).json({ error: "Database error" });
  }
});

// OPTIONAL AUTH – allows both logged-in & guest users
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    req.user = null; // guest user
    return next();
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // logged in
  } catch (err) {
    req.user = null; // invalid token → treat as guest
  }

  next();
}

app.post("/api/submitReport", optionalAuth, async (req, res) => {
  try {
    const {
      category,
      description,
      location,
      timestamp,
      latitude,
      longitude,
      image_url,
    } = req.body;

    console.log("Received report:", req.body);

    // userId if logged in, else null
    const userId = req.user ? req.user.id : null;

    // Validate required fields
    if (!category)
      return res.status(400).json({ error: "Category is required." });
    if (!description)
      return res.status(400).json({ error: "Description is required." });

    // Parse coordinates
    let lat, lng;

    if (Array.isArray(location) && location.length === 2) {
      lat = parseFloat(location[0]);
      lng = parseFloat(location[1]);
    } else if (latitude !== undefined && longitude !== undefined) {
      lat = parseFloat(latitude);
      lng = parseFloat(longitude);
    } else {
      return res.status(400).json({
        error: "Location required. Provide location[] or latitude/longitude.",
      });
    }

    // Validate coordinate range
    if (
      isNaN(lat) ||
      isNaN(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return res.status(400).json({ error: "Invalid coordinates." });
    }

    // Parse timestamp
    const dateObj = timestamp ? new Date(timestamp) : new Date();
    if (isNaN(dateObj.getTime())) {
      return res.status(400).json({ error: "Invalid timestamp." });
    }

    const date = dateObj.toISOString().split("T")[0];
    const time = dateObj.toTimeString().split(" ")[0];

    // Insert into database
    const result = await pool.query(
      `INSERT INTO report (type, description, latitude, longitude, date, time, image_url, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, created_by`,
      [category, description, lat, lng, date, time, image_url, userId]
    );

    console.log("✅ Report saved with ID:", result.rows[0]);

    res.status(201).json({
      message: userId
        ? "Report submitted successfully."
        : "Anonymous report submitted.",
      id: result.rows[0].id,
      created_by: result.rows[0].created_by,
    });
  } catch (error) {
    console.error("❌ Error saving report:", error);

    if (error.code === "23505") {
      return res.status(400).json({ error: "Duplicate report. Try again." });
    }

    res.status(500).json({
      error: "Internal server error.",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Vote on a report (upvote or downvote)
// app.put("/api/vote", async (req, res) => {
//   const { type,reportId } = req.body; // 'upvote' or 'downvote'

//   if (type !== "upvote" && type !== "downvote") {
//     return res.status(400).json({ error: "Invalid vote type" });
//   }
// console.log(`Received `, req.body);
//   try {
//     const column = type === "upvote" ? "upvotes" : "downvotes";

//     const result = await pool.query(
//       `UPDATE report
//        SET ${column} = ${column} + 1
//        WHERE id = $1
//        RETURNING id, ${column}`,
//       [reportId]
//     );

//     res.json({
//       message: `${type} added successfully`,
//       reportId: reportId,
//       newCount: result.rows[0][column],
//     });
//   } catch (err) {
//     console.error("Error updating votes:", err.message);
//     res.status(500).json({ error: "Failed to update votes" });
//   }
// });
app.put("/api/vote", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { reportId, type } = req.body;

  // if (!userId) return res.status(400).json({ error: "User must be logged in" });

  try {
    // Check if user already voted
    const existingVote = await pool.query(
      "SELECT vote_type FROM report_votes WHERE user_id=$1 AND report_id=$2",
      [userId, reportId]
    );

    // If same vote → remove it (toggle)
    if (
      existingVote.rows.length > 0 &&
      existingVote.rows[0].vote_type === type
    ) {
      await pool.query(
        "DELETE FROM report_votes WHERE user_id=$1 AND report_id=$2",
        [userId, reportId]
      );

      await pool.query(
        `
        UPDATE report 
        SET ${type === "upvote" ? "upvotes" : "downvotes"} = ${
          type === "upvote" ? "upvotes - 1" : "downvotes - 1"
        }
        WHERE id=$1`,
        [reportId]
      );

      return res.json({ message: "Vote removed" });
    }

    // If different vote → update it
    if (existingVote.rows.length > 0) {
      await pool.query(
        "UPDATE report_votes SET vote_type=$1 WHERE user_id=$2 AND report_id=$3",
        [type, userId, reportId]
      );

      await pool.query(
        `
        UPDATE report SET 
          upvotes = upvotes + ${type === "upvote" ? 1 : -1},
          downvotes = downvotes + ${type === "downvote" ? 1 : -1}
        WHERE id=$1`,
        [reportId]
      );
    } else {
      // First time voting
      await pool.query(
        "INSERT INTO report_votes (user_id, report_id, vote_type) VALUES ($1, $2, $3)",
        [userId, reportId, type]
      );

      await pool.query(
        `
        UPDATE report SET 
          ${
            type === "upvote"
              ? "upvotes = upvotes + 1"
              : "downvotes = downvotes + 1"
          }
        WHERE id=$1`,
        [reportId]
      );
    }

    res.json({ message: "Vote updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// app.post('/api/submitReport', async (req, res) => {
//   try {
//     const { category, description, location, timestamp, latitude, longitude } = req.body;
//     console.log('Received report:', req.body);

//     // Validate required fields
//     if (!category) {
//       return res.status(400).json({ error: 'Category is required.' });
//     }
//     if (!description) {
//       return res.status(400).json({ error: 'Description is required.' });
//     }

//     // Parse location data
//     let lat, lng;
//     if (location && Array.isArray(location) && location.length === 2) {
//       [lat, lng] = location.map(coord => parseFloat(coord));
//     } else if (latitude !== undefined && longitude !== undefined) {
//       lat = parseFloat(latitude);
//       lng = parseFloat(longitude);
//     } else {
//       return res.status(400).json({
//         error: 'Location data required. Provide either location array or latitude/longitude.'
//       });
//     }

//     // Validate coordinates
//     if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
//       return res.status(400).json({ error: 'Invalid coordinates.' });
//     }

//     // Parse timestamp
//     const dateObj = timestamp ? new Date(timestamp) : new Date();
//     if (isNaN(dateObj.getTime())) {
//       return res.status(400).json({ error: 'Invalid timestamp.' });
//     }

//     const date = dateObj.toISOString().split('T')[0];
//     const time = dateObj.toTimeString().split(' ')[0];

//     // Insert into database WITHOUT specifying id (let database generate it)
//     const result = await pool.query(
//       `INSERT INTO report (type, description, latitude, longitude, date, time)
//        VALUES ($1, $2, $3, $4, $5, $6)
//        RETURNING id`,
//       [category, description, lat, lng, date, time]
//     );

//     console.log('✅ Report saved with ID:', result.rows[0].id);

//     res.status(201).json({
//       message: 'Report submitted successfully.',
//       id: result.rows[0].id
//     });

//   } catch (error) {
//     console.error('❌ Error saving report:', error);

//     // Handle duplicate key error specifically
//     if (error.code === '23505') {
//       return res.status(400).json({
//         error: 'Report ID conflict. Please try again.'
//       });
//     }

//     res.status(500).json({
//       error: 'Internal server error while saving report.',
//       details: process.env.NODE_ENV === 'development' ? error.message : undefined
//     });
//   }
// });

/* ================================
   SOS CONTACT ROUTES
================================ */
// app.post("/api/sos", async (req, res) => {
//   const { email, sosContacts } = req.body;
//   if (!email || !sosContacts?.length)
//     return res.status(400).json({ error: "Missing email or contacts." });

//   try {
//     const existing = await pool.query(
//       "SELECT * FROM sos_contacts WHERE email = $1",
//       [email]
//     );
//     if (existing.rows.length > 0) {
//       await pool.query(
//         "UPDATE sos_contacts SET contacts = $1 WHERE email = $2",
//         [sosContacts, email]
//       );
//       res.json({ message: "SOS contacts updated successfully." });
//     } else {
//       await pool.query(
//         "INSERT INTO sos_contacts (email, contacts) VALUES ($1, $2)",
//         [email, sosContacts]
//       );
//       res.status(201).json({ message: "SOS contacts saved successfully." });
//     }
//   } catch (err) {
//     console.error("Error saving SOS contacts:", err.message);
//     res.status(500).json({ error: "Failed to save SOS contacts." });
//   }
// });

// app.get("/api/sos/:email", async (req, res) => {
//   const { email } = req.params;
//   try {
//     const result = await pool.query(
//       "SELECT contacts FROM sos_contacts WHERE email = $1",
//       [email]
//     );
//     if (result.rows.length === 0)
//       return res
//         .status(404)
//         .json({ error: "No SOS contacts found for this user." });

//     res.json({ contacts: result.rows[0].contacts });
//   } catch (err) {
//     console.error("Error fetching SOS contacts:", err.message);
//     res
//       .status(500)
//       .json({ error: "Database error while fetching SOS contacts." });
//   }
// });

/* ================================
   NEARBY ROUTE (Free Overpass API)
================================ */
app.get("/nearby", async (req, res) => {
  const { lat, lon, types } = req.query;
  if (!lat || !lon || !types)
    return res.status(400).json({ error: "Missing lat, lon, or types" });

  const typeList = types.split(",");
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
      .join("");

    const query = `[out:json];(${queries});out center;`;
    const response = await axios.post(
      "https://overpass-api.de/api/interpreter",
      query,
      {
        headers: { "Content-Type": "text/plain" },
      }
    );

    const results = (response.data.elements || []).map((el) => ({
      name: el.tags?.name || "Unknown",
      type: el.tags?.amenity,
      lat: el.lat || el.center?.lat,
      lon: el.lon || el.center?.lon,
    }));

    res.json({ count: results.length, results });
  } catch (err) {
    console.error("Nearby route error:", err.message);
    res.status(500).json({ error: "Failed to fetch nearby data" });
  }
});

/* ================================
   EMERGENCY ROUTE
================================ */
app.post("/api/emergency", async (req, res) => {
  const { email, location } = req.body;
  if (!email || !location)
    return res.status(400).json({ error: "Missing email or location." });

  try {
    const result = await pool.query(
      "SELECT contacts FROM sos_contacts WHERE email = $1",
      [email]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "No SOS contacts found." });

    const contacts = result.rows[0].contacts;
    const emergencyMsg = `🚨 EMERGENCY ALERT 🚨
User: ${email}
Location: https://www.google.com/maps?q=${location[0]},${location[1]}
Please reach out immediately!`;

    console.log("🚨 Sending SOS alert to:", contacts);
    console.log("Message:", emergencyMsg);

    res.json({
      message: "Emergency alert triggered successfully.",
      sentTo: contacts,
      preview: emergencyMsg,
    });
  } catch (err) {
    console.error("Error during emergency trigger:", err.message);
    res.status(500).json({ error: "Failed to send emergency alerts." });
  }
});

/* ================================
   CHATBOT ROUTE
================================ */
app.post("/api/chatbot", async (req, res) => {
  const { message, lat, lon } = req.body;
  if (!message) return res.status(400).json({ reply: "Message required." });

  const text = message.toLowerCase();

  if (text.includes("hospital"))
    return res.redirect(`/nearby?lat=${lat}&lon=${lon}&types=hospital`);
  if (text.includes("police"))
    return res.redirect(`/nearby?lat=${lat}&lon=${lon}&types=police`);
  if (text.includes("restroom") || text.includes("toilet"))
    return res.redirect(`/nearby?lat=${lat}&lon=${lon}&types=toilets`);
  if (text.includes("help") || text.includes("danger"))
    return res.json({
      reply:
        "🚨 SOS mode activated! Sending alert to your emergency contacts...",
    });

  return res.json({
    reply:
      'I can help you find hospitals, police stations, restrooms, or send SOS alerts. Try typing "nearest hospital".',
  });
});

// UPDATE REPORT (Only owner can edit)
app.put("/api/reports/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id; // coming from JWT
  const { title, description, category, image_url } = req.body;

  try {
    // 1. Fetch report
    const reportResult = await pool.query(
      "SELECT * FROM report WHERE id = $1",
      [id]
    );

    if (reportResult.rows.length === 0) {
      return res.status(404).json({ message: "Report not found" });
    }

    const report = reportResult.rows[0];

    // 2. Ensure only owner can edit
    if (Number(report.created_by) !== Number(userId)) {
      return res.status(403).json({ message: "You cannot edit this report" });
    }

    // 3. Update
    const updateQuery = `
      UPDATE report
      SET
          description = $1,
          type = $2,
          image_url = $3
      WHERE id = $4
      RETURNING *;
    `;

    const values = [description, category, image_url, id];

    const updated = await pool.query(updateQuery, values);

    res.json({
      message: "Report updated successfully",
      report: updated.rows[0],
    });
  } catch (err) {
    console.error("Error updating report:", err);
    res.status(500).json({ message: "Server error updating report" });
  }
});

app.get("/api/sos/get", authMiddleware, async (req, res) => {
  try {
    const userEmail = req.user.email;

    const result = await pool.query(
      "SELECT contacts FROM sos_contacts WHERE email=$1",
      [userEmail]
    );

    if (result.rows.length === 0) {
      return res.json({ contacts: [] });
    }

    res.json({ contacts: result.rows[0].contacts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.put("/api/sos/update", authMiddleware, async (req, res) => {
  const userEmail = req.user.email; // email from JWT
  const { contacts } = req.body; // array of numbers

  if (!Array.isArray(contacts)) {
    return res.status(400).json({ error: "contacts must be an array" });
  }

  try {
    // Check if entry exists
    const existing = await pool.query(
      "SELECT * FROM sos_contacts WHERE email=$1",
      [userEmail]
    );

    let result;

    if (existing.rows.length > 0) {
      // Update
      result = await pool.query(
        `UPDATE sos_contacts 
         SET contacts=$1 
         WHERE email=$2 
         RETURNING *`,
        [contacts, userEmail]
      );
    } else {
      // Insert
      result = await pool.query(
        `INSERT INTO sos_contacts (email, contacts) 
         VALUES ($1, $2) 
         RETURNING *`,
        [userEmail, contacts]
      );
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (err) {
    console.error("Error updating SOS contacts:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ================================
   HEALTH CHECK ROUTE
================================ */
app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({
      status: "OK",
      database: "Connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: "Error",
      database: "Disconnected",
      error: error.message,
    });
  }
});
app.get("/api/my-reports", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `
      SELECT id, type, description, latitude, longitude, date, time, image_url, upvotes, downvotes
      FROM report
      WHERE created_by = $1
      ORDER BY date DESC, time DESC
      `,
      [userId]
    );

    res.json({ reports: result.rows });
  } catch (err) {
    console.error("Error fetching user reports:", err);
    res.status(500).json({ error: "Failed to fetch your reports" });
  }
});

app.delete("/api/report/delete/:id", authMiddleware, async (req, res) => {
  try {
    const reportId = req.params.id;
    const userId = req.user.id;

    const check = await pool.query(
      "SELECT created_by FROM report WHERE id=$1",
      [reportId]
    );

    if (check.rows.length === 0)
      return res.status(404).json({ error: "Report not found" });

    if (check.rows[0].created_by !== userId)
      return res.status(403).json({ error: "Not allowed" });

    await pool.query("DELETE FROM report WHERE id=$1", [reportId]);

    res.json({ message: "Report deleted successfully" });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ error: "Failed to delete report" });
  }
});

/* ================================
   START SERVER
================================ */
app.listen(port, () => {
  console.log(`🚀 SafeRoute backend running on http://localhost:${port}`);
  console.log(
    `📊 Database: ${connectionString.split("@")[1] || connectionString}`
  );
});
