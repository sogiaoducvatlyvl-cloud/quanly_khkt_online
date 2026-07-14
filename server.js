const express = require('express');
const database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Kh?i t?o file CSDL SQLite ngay trên server
const db = new database(path.join(__dirname, 'data.db'));

// Kh?i t?o các b?ng d? li?u n?u chua có
db.exec(`
    CREATE TABLE IF NOT EXISTS schools (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        school_name TEXT NOT NULL,
        school_type TEXT NOT NULL,       
        management_unit TEXT NOT NULL    
    );
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,              
        managed_unit TEXT NOT NULL       
    );
    CREATE TABLE IF NOT EXISTS project_registrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_name TEXT NOT NULL,
        field_name TEXT NOT NULL,
        field_code TEXT NOT NULL,
        school_id INTEGER,
        status TEXT DEFAULT 'Submitted',
        feedback TEXT,
        FOREIGN KEY (school_id) REFERENCES schools(id)
    );
    CREATE TABLE IF NOT EXISTS scores (
        project_id INTEGER,
        jury_id INTEGER,
        score_report REAL DEFAULT 0,
        score_display REAL DEFAULT 0,
        score_interview REAL DEFAULT 0,
        total_score REAL DEFAULT 0,
        PRIMARY KEY (project_id, jury_id)
    );
`);

// T?o tài kho?n Demo n?u CSDL tr?ng (M?t kh?u m?c d?nh: 123456)
const hash = crypto.createHash('sha256').update('123456').digest('hex');
const userCheck = db.prepare('SELECT count(*) as count FROM users').get();
if (userCheck.count === 0) {
    db.prepare("INSERT INTO users (username, password_hash, role, managed_unit) VALUES ('phuongphukhuong', ?, 'ROLE_XA_PHUONG', 'Phu?ng Phú Khuong')").run(hash);[cite: 1]
    db.prepare("INSERT INTO users (username, password_hash, role, managed_unit) VALUES ('admin_so', ?, 'ADMIN_SO', 'S? GDÐT')").run(hash);
    db.prepare("INSERT INTO schools (school_name, school_type, management_unit) VALUES ('THCS Phú Hung', 'THCS', 'Phu?ng Phú Khuong')").run(I => {});[cite: 1]
}

// --- CÁC ÐU?NG D?N ÐÓN NH?N D? LI?U (API) ---

// 1. API Ðang nh?p t? xa
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
    const user = db.prepare('SELECT id, username, role, managed_unit FROM users WHERE username = ? AND password_hash = ?').get(username, passwordHash);
    
    if (!user) return res.status(400).json({ error: 'Tài kho?n ho?c m?t kh?u không dúng!' });
    res.json(user);
});

// 2. API L?y danh sách d? án (Phân quy?n: Xã/Phu?ng ch? th?y THCS c?a mình)
app.post('/api/projects', (req, res) => {
    const { role, managed_unit } = req.body;
    let projects;
    if (role === 'ROLE_XA_PHUONG') {
        projects = db.prepare(`SELECT p.*, s.school_name FROM project_registrations p JOIN schools s ON p.school_id = s.id WHERE s.management_unit = ?`).all(managed_unit);[cite: 1]
    } else {
        projects = db.prepare(`SELECT p.*, s.school_name FROM project_registrations p JOIN schools s ON p.school_id = s.id`).all();
    }
    res.json(projects);
});

// 3. API Nh?p di?m (Giám kh?o ch?m di?m tr?c ti?p t? xa)
app.post('/api/scores/submit', (req, res) => {
    const { projectId, juryId, report, display, interview } = req.body;
    const total = report * 0.3 + display * 0.3 + interview * 0.4;
    
    db.prepare(`
        INSERT INTO scores (project_id, jury_id, score_report, score_display, score_interview, total_score)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(project_id, jury_id) DO UPDATE SET total_score = excluded.total_score
    `).run(projectId, juryId, report, display, interview, total);
    
    res.json({ success: true, message: 'Giám kh?o ch?m di?m thành công!' });
});

// 4. API T? d?ng x?p gi?i theo thang di?m m?i
app.get('/api/results', (req, res) => {
    const results = db.prepare(`
        SELECT p.project_name, s.school_name, AVG(sc.total_score) as avg_score,
        CASE 
            WHEN AVG(sc.total_score) >= 90 THEN 'Gi?i Nh?t'
            WHEN AVG(sc.total_score) >= 80 THEN 'Gi?i Nhì'
            WHEN AVG(sc.total_score) >= 70 THEN 'Gi?i Ba'
            WHEN AVG(sc.total_score) >= 60 THEN 'Gi?i Tu'
            ELSE 'Không d?t gi?i'
        END as award
        FROM project_registrations p 
        JOIN schools s ON p.school_id = s.id 
        LEFT JOIN scores sc ON p.id = sc.project_id
        GROUP BY p.id ORDER BY avg_score DESC
    `).all();
    res.json(results);
});

// Kh?i d?ng server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`?? Ph?n m?m KHKT Online dang ch?y ?n d?nh t?i c?ng ${PORT}`));