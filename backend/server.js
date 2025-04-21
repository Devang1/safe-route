import express from 'express';
import cors from 'cors';
import pkg from 'pg';
import bodyParser from 'body-parser';
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
import session from "express-session";
import env from "dotenv";
const saltRounds = 10;
const { Pool } = pkg;

const app = express();
const port = 5000;

app.use(cors());
app.use(bodyParser.json());
app.use(
  session({
    secret: "TOPSECRETWORD",
    resave: false,
    saveUninitialized: true,
  })
);
app.use(passport.initialize());
app.use(passport.session());
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
// Auth*********************************************************************************8
app.get("/api/isAuth",async(req,res)=>{
  if(req.isAuthenticated()){
    const mail=req.user.email;
    const Bdata= await pool.query("SELECT * FROM users WHERE email = $1", [
        mail,
      ]);
      res.send(Bdata.rows[0]);
  }else{
   res.send("not authenticated");
  }
})

app.get("/api/logout", (req, res) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.send("logout");
  });
});
app.post("/api/register",async(req,res)=>{
  const email = req.body.email;
  const password = req.body.password;
    try {
      const checkResult = await pool.query("SELECT * FROM users WHERE email = $1", [
        email,
      ]);
      if (checkResult.rows.length > 0) {
        res.send("user already exists");
      } else {
        bcrypt.hash(password, saltRounds, async (err, hash) => {
          if (err) {
            console.error("Error hashing password:", err);
          } else {
            const result = await pool.query(
              "INSERT INTO users (email,password) VALUES ($1, $2) RETURNING *",
              [email, hash]
            );
            const user = result.rows[0];
            req.login(user, (err) => {
              console.log("success");
              res.redirect("/api/isAuth");
            });
            console.log(req.isAuthenticated())
          }
        });
      }
    } catch (err) {
      console.log(err);
    }
})
app.post("/api/log", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) return res.status(500).json({ error: "Internal Server Error" });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    req.logIn(user, (loginErr) => {
      if (loginErr) return res.status(500).json({ error: "Login failed" });
      return res.json({ message: "Login successful", user });
    });
  })(req, res, next);
});

passport.use(
  "local",
  new Strategy({ usernameField: "email" },async function verify(email, password, cb){
    try {
      const result = await pool.query("SELECT * FROM users WHERE email = $1 ", [email,]);
      if (result.rows.length > 0) {
        const user = result.rows[0];
        const storedHashedPassword = user.password;
        bcrypt.compare(password, storedHashedPassword, (err, valid) => {
          if (err) {
            console.error("Error comparing passwords:", err);
            return cb(err);
          } else {
            if (valid) {
              return cb(null, user);

            } else {
              return cb(null, false);
            }
          }
        });
      } else {
        return cb("User not found");
      }
    } catch (err) {
      console.log(err);
    }
  })
);
passport.serializeUser((user, cb) => {
  cb(null, user);
});

passport.deserializeUser((user, cb) => {
  cb(null, user);
});
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
