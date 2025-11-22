const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const validator = require('validator');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting - prevent spam
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP to 10 requests per windowMs
    message: { 
        success: false, 
        message: 'Too many subscription attempts, please try again later.' 
    }
});
app.use('/api/newsletter', limiter);

// Database setup
const db = new sqlite3.Database('./newsletter.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('✅ Connected to SQLite database.');
        // Create subscribers table if it doesn't exist
        db.run(`CREATE TABLE IF NOT EXISTS subscribers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            subscription_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT 1
        )`, (err) => {
            if (err) {
                console.error('Error creating table:', err);
            } else {
                console.log('✅ Subscribers table ready');
            }
        });
    }
});

// Newsletter subscription endpoint
app.post('/api/newsletter/subscribe', (req, res) => {
    const { email } = req.body;
    
    console.log('📧 Subscription attempt:', email);
    
    // Validation
    if (!email) {
        return res.status(400).json({ 
            success: false, 
            message: 'Email address is required.' 
        });
    }
    
    if (!validator.isEmail(email)) {
        return res.status(400).json({ 
            success: false, 
            message: 'Please provide a valid email address.' 
        });
    }
    
    // Insert into database
    const sql = `INSERT OR IGNORE INTO subscribers (email) VALUES (?)`;
    
    db.run(sql, [email], function(err) {
        if (err) {
            console.error('❌ Database error:', err);
            return res.status(500).json({ 
                success: false, 
                message: 'Subscription failed. Please try again.' 
            });
        }
        
        if (this.changes === 0) {
            console.log('ℹ️ Already subscribed:', email);
            return res.json({ 
                success: true, 
                message: 'You are already subscribed to our newsletter!' 
            });
        }
        
        console.log('✅ New subscriber:', email);
        res.json({ 
            success: true, 
            message: 'Thank you for subscribing to our newsletter!' 
        });
    });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Ar-Risalah Academy Newsletter API is running',
        timestamp: new Date().toISOString()
    });
});

// Get all subscribers (for admin)
app.get('/api/admin/subscribers', (req, res) => {
    db.all('SELECT email, subscription_date FROM subscribers WHERE is_active = 1 ORDER BY subscription_date DESC', (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows);
    });
});

// Start server
app.listen(PORT, () => {
    console.log('🚀 Server started successfully!');
    console.log(`📍 Port: ${PORT}`);
    console.log(`📬 Newsletter API: http://localhost:${PORT}/api/newsletter/subscribe`);
    console.log(`❤️ Health check: http://localhost:${PORT}/api/health`);
    console.log(`👥 Subscribers list: http://localhost:${PORT}/api/admin/subscribers`);
});