const express = require('express');
const database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Khởi tạo file CSDL SQLite ngay trên server
const db = new database(path.join(__dirname, 'data.db'));

// Khởi tạo các bảng dữ liệu nếu chưa có
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

// Tạo tài khoản Demo nếu CSDL trống (Mật khẩu mặc định: 123456)
const hash = crypto.createHash('sha256').update('123456').digest('hex');
const userCheck = db.prepare('SELECT count(*) as count FROM users').get();
if (userCheck.count === 0) {
    db.prepare("INSERT INTO users (username, password_hash, role, managed_unit) VALUES ('phuongphukhuong', ?, 'ROLE_XA_PHUONG', 'Phường Phú Khương')").run(hash);
    db.prepare("INSERT INTO users (username, password_hash, role, managed_unit) VALUES ('admin_so', ?, 'ADMIN_SO', 'Sở GDĐT')").run(hash);
    db.prepare("INSERT INTO schools (school_name, school_type, management_unit) VALUES ('THCS Phú Hưng', 'THCS', 'Phường Phú Khương')").run();
}

// --- CÁC ĐƯỜNG DẪN ĐÓN NHẬN DỮ LIỆU (API) ---

// 1. API Đăng nhập từ xa
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
    const user = db.prepare('SELECT id, username, role, managed_unit FROM users WHERE username = ? AND password_hash = ?').get(username, passwordHash);
    
    if (!user) return res.status(400).json({ error: 'Tài khoản hoặc mật khẩu không đúng!' });
    res.json(user);
});

// 2. API Lấy danh sách dự án
app.post('/api/projects', (req, res) => {
    const { role, managed_unit } = req.body;
    let projects;
    if (role === 'ROLE_XA_PHUONG') {
        projects = db.prepare(`SELECT p.*, s.school_name FROM project_registrations p JOIN schools s ON p.school_id = s.id WHERE s.management_unit = ?`).all(managed_unit);
    } else {
        projects = db.prepare(`SELECT p.*, s.school_name FROM project_registrations p JOIN schools s ON p.school_id = s.id`).all();
    }
    res.json(projects);
});

// 3. API Nhập điểm
app.post('/api/scores/submit', (req, res) => {
    const { projectId, juryId, report, display, interview } = req.body;
    const total = report * 0.3 + display * 0.3 + interview * 0.4;
    
    db.prepare(`
        INSERT INTO scores (project_id, jury_id, score_report, score_display, score_interview, total_score)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(project_id, jury_id) DO UPDATE SET total_score = excluded.total_score
    `).run(projectId, juryId, report, display, interview, total);
    
    res.json({ success: true, message: 'Giám khảo chấm điểm thành công!' });
});

// 4. API Tự động xếp giải theo thang điểm mới
app.get('/api/results', (req, res) => {
    const results = db.prepare(`
        SELECT p.project_name, s.school_name, AVG(sc.total_score) as avg_score,
        CASE 
            WHEN AVG(sc.total_score) >= 90 THEN 'Giải Nhất'
            WHEN AVG(sc.total_score) >= 80 THEN 'Giải Nhì'
            WHEN AVG(sc.total_score) >= 70 THEN 'Giải Ba'
            WHEN AVG(sc.total_score) >= 60 THEN 'Giải Tư'
            ELSE 'Không đạt giải'
        END as award
        FROM project_registrations p 
        JOIN schools s ON p.school_id = s.id 
        LEFT JOIN scores sc ON p.id = sc.project_id
        GROUP BY p.id ORDER BY avg_score DESC
    `).all();
    res.json(results);
});

// Khởi động server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Phần mềm KHKT Online đang chạy ổn định tại cổng ${PORT}`));
