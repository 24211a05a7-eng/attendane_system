import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'placenix.db');
const db = new Database(DB_PATH);

// Enable WAL for better concurrent reads
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    mobile TEXT,
    college TEXT,
    branch TEXT,
    year TEXT,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    is_active INTEGER DEFAULT 1,
    role TEXT DEFAULT 'user'
  );

  CREATE TABLE IF NOT EXISTS otp_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    used INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    questions_solved TEXT DEFAULT '[]',
    bookmarks TEXT DEFAULT '[]',
    xp INTEGER DEFAULT 0,
    streak_days INTEGER DEFAULT 0,
    last_activity DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT,
    type TEXT
  );

  CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    subcategory TEXT,
    type TEXT,
    difficulty TEXT,
    year INTEGER,
    time_limit INTEGER,
    points INTEGER,
    times_asked INTEGER,
    success_rate INTEGER,
    question_text TEXT,
    options_json TEXT,
    correct_option TEXT,
    explanation TEXT,
    tags_json TEXT,
    hints_json TEXT,
    examples_json TEXT,
    constraints_json TEXT,
    starter_code_json TEXT,
    test_cases_json TEXT,
    model_answer TEXT,
    solution_code TEXT
  );

  CREATE TABLE IF NOT EXISTS question_companies (
    question_id TEXT,
    company_id TEXT,
    PRIMARY KEY (question_id, company_id),
    FOREIGN KEY (question_id) REFERENCES questions(id),
    FOREIGN KEY (company_id) REFERENCES companies(id)
  );

  CREATE TABLE IF NOT EXISTS resume_analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    filename TEXT,
    overall_score INTEGER,
    analysis_json TEXT,
    extracted_text TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS interview_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    round_type TEXT,
    overall_score INTEGER,
    transcript_json TEXT,
    feedback_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    config_key TEXT PRIMARY KEY,
    config_value TEXT,
    config_description TEXT
  );

  INSERT OR IGNORE INTO settings (config_key, config_value, config_description) 
  VALUES ('admin_pin', '1234', '4-digit PIN for admin access');
`);

// Attempt to add role column if table already exists
try {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'");
} catch (e) {
  // Column likely already exists
}

// ── Helper Functions ──

export function createUser({ name, email, mobile, college, branch, year, password }) {
  const hash = bcrypt.hashSync(password, 10);
  const stmt = db.prepare(`
    INSERT INTO users (name, email, mobile, college, branch, year, password_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(name, email, mobile || null, college || null, branch || null, year || null, hash);
  
  // Create initial progress row
  db.prepare('INSERT INTO user_progress (user_id) VALUES (?)').run(result.lastInsertRowid);
  
  return result.lastInsertRowid;
}

export function findUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

export function findUserById(id) {
  return db.prepare('SELECT id, name, email, mobile, college, branch, year, created_at, last_login FROM users WHERE id = ?').get(id);
}

export function verifyPassword(plaintext, hash) {
  return bcrypt.compareSync(plaintext, hash);
}

export function updateLastLogin(userId) {
  db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
}

export function storeOTP(email, code, expiresInMinutes = 5) {
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString();
  // Invalidate previous OTPs for this email
  db.prepare('UPDATE otp_codes SET used = 1 WHERE email = ? AND used = 0').run(email);
  db.prepare('INSERT INTO otp_codes (email, code, expires_at) VALUES (?, ?, ?)').run(email, code, expiresAt);
}

export function verifyOTP(email, code) {
  const row = db.prepare(`
    SELECT * FROM otp_codes 
    WHERE email = ? AND code = ? AND used = 0 AND expires_at > datetime('now')
    ORDER BY created_at DESC LIMIT 1
  `).get(email, code);
  
  if (row) {
    db.prepare('UPDATE otp_codes SET used = 1 WHERE id = ?').run(row.id);
    return true;
  }
  return false;
}

export function getUserProgress(userId) {
  return db.prepare('SELECT * FROM user_progress WHERE user_id = ?').get(userId);
}

export function updateUserProgress(userId, data) {
  const current = db.prepare('SELECT * FROM user_progress WHERE user_id = ?').get(userId);
  if (!current) return;

  const fields = [];
  const values = [];
  
  if (data.solve_question) {
    const solved = JSON.parse(current.questions_solved || '[]');
    if (!solved.includes(data.solve_question)) {
      solved.push(data.solve_question);
      fields.push('questions_solved = ?');
      values.push(JSON.stringify(solved));
    }
  }

  if (data.bookmark_question) {
    const bookmarks = JSON.parse(current.bookmarks || '[]');
    if (!bookmarks.includes(data.bookmark_question)) {
      bookmarks.push(data.bookmark_question);
      fields.push('bookmarks = ?');
      values.push(JSON.stringify(bookmarks));
    }
  }

  if (data.xp !== undefined) { fields.push('xp = xp + ?'); values.push(data.xp); }
  if (data.streak_days !== undefined) { fields.push('streak_days = ?'); values.push(data.streak_days); }
  
  if (fields.length === 0) return;
  
  fields.push('last_activity = CURRENT_TIMESTAMP');
  values.push(userId);
  
  db.prepare(`UPDATE user_progress SET ${fields.join(', ')} WHERE user_id = ?`).run(...values);
}

export function getCompanies() {
  return db.prepare('SELECT * FROM companies').all();
}

export function getQuestions(filters = {}) {
  let query = `
    SELECT q.*, GROUP_CONCAT(qc.company_id) as companies
    FROM questions q
    LEFT JOIN question_companies qc ON q.id = qc.question_id
  `;
  const conditions = [];
  const params = [];

  if (filters.category && filters.category !== 'all') {
    conditions.push('q.category = ?');
    params.push(filters.category);
  }
  if (filters.difficulty && filters.difficulty !== 'all') {
    conditions.push('q.difficulty = ?');
    params.push(filters.difficulty);
  }
  if (filters.type && filters.type !== 'all') {
    conditions.push('q.type = ?');
    params.push(filters.type);
  }
  if (filters.search) {
    conditions.push('(q.title LIKE ? OR q.question_text LIKE ?)');
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(' AND ')}`;
  }

  query += ' GROUP BY q.id';

  // Handle company filtering in a subquery or post-process for simplicity in SQLite
  let results = db.prepare(query).all(...params);

  if (filters.company && filters.company !== 'all' && filters.company !== '') {
    results = results.filter(q => q.companies && q.companies.split(',').includes(filters.company));
  }

  return results.map(q => ({
    ...q,
    companies: q.companies ? q.companies.split(',') : [],
    options: q.options_json ? JSON.parse(q.options_json) : null,
    tags: q.tags_json ? JSON.parse(q.tags_json) : [],
    hints: q.hints_json ? JSON.parse(q.hints_json) : [],
    examples: q.examples_json ? JSON.parse(q.examples_json) : [],
    constraints: q.constraints_json ? JSON.parse(q.constraints_json) : [],
    starterCode: q.starter_code_json ? JSON.parse(q.starter_code_json) : null,
    testCases: q.test_cases_json ? JSON.parse(q.test_cases_json) : []
  }));
}

export function getQuestionById(id) {
  const q = db.prepare(`
    SELECT q.*, GROUP_CONCAT(qc.company_id) as companies
    FROM questions q
    LEFT JOIN question_companies qc ON q.id = qc.question_id
    WHERE q.id = ?
    GROUP BY q.id
  `).get(id);

  if (!q) return null;

  return {
    ...q,
    companies: q.companies ? q.companies.split(',') : [],
    options: q.options_json ? JSON.parse(q.options_json) : null,
    tags: q.tags_json ? JSON.parse(q.tags_json) : [],
    hints: q.hints_json ? JSON.parse(q.hints_json) : [],
    examples: q.examples_json ? JSON.parse(q.examples_json) : [],
    constraints: q.constraints_json ? JSON.parse(q.constraints_json) : [],
    starterCode: q.starter_code_json ? JSON.parse(q.starter_code_json) : null,
    testCases: q.test_cases_json ? JSON.parse(q.test_cases_json) : []
  };
}

export function saveResumeAnalysis(userId, analysis) {
  const { filename, overall_score, analysis_json, extracted_text } = analysis;
  return db.prepare(`
    INSERT INTO resume_analyses (user_id, filename, overall_score, analysis_json, extracted_text)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, filename, overall_score, JSON.stringify(analysis_json), extracted_text);
}

export function getResumeHistory(userId, limit = 10) {
  return db.prepare(`
    SELECT * FROM resume_analyses WHERE user_id = ? ORDER BY created_at DESC LIMIT ?
  `).all(userId, limit);
}

export function saveInterviewSession(userId, session) {
  const { round_type, overall_score, transcript_json, feedback_json } = session;
  return db.prepare(`
    INSERT INTO interview_sessions (user_id, round_type, overall_score, transcript_json, feedback_json)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, round_type, overall_score, JSON.stringify(transcript_json), JSON.stringify(feedback_json));
}

export function getInterviewHistory(userId, limit = 10) {
  return db.prepare(`
    SELECT * FROM interview_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?
  `).all(userId, limit);
}

export function getDashboardSummary(userId) {
  // 1. Fetch user progress to get the JSON array of solved questions
  const progressRow = db.prepare('SELECT questions_solved, last_activity FROM user_progress WHERE user_id = ?').get(userId);
  const solvedArray = progressRow && progressRow.questions_solved ? JSON.parse(progressRow.questions_solved) : [];
  
  let questionStats = { solvedTotal: 0, solvedDsa: 0, solvedAptitude: 0, solvedTech: 0 };
  let qAct = [];

  if (solvedArray.length > 0) {
    // Generate placeholders for IN clause
    const placeholders = solvedArray.map(() => '?').join(',');
    
    questionStats = db.prepare(`
      SELECT 
        COUNT(*) as solvedTotal,
        COUNT(CASE WHEN category = 'dsa' THEN 1 END) as solvedDsa,
        COUNT(CASE WHEN category = 'aptitude' THEN 1 END) as solvedAptitude,
        COUNT(CASE WHEN category = 'technical' THEN 1 END) as solvedTech
      FROM questions
      WHERE id IN (${placeholders})
    `).get(...solvedArray);
    
    // For recent activity, use the last_activity timestamp for all recent questions
    const recentQuestions = db.prepare(`
      SELECT 'question' as type, title as label 
      FROM questions WHERE id IN (${placeholders}) LIMIT 5
    `).all(...solvedArray);
    
    qAct = recentQuestions.map(q => ({
        ...q,
        time: progressRow.last_activity || new Date().toISOString()
    }));
  }

  // 2. Latest Resume Score
  const resumeStats = db.prepare(`
    SELECT overall_score, created_at FROM resume_analyses 
    WHERE user_id = ? ORDER BY created_at DESC LIMIT 1
  `).get(userId);

  // 3. Interview Stats (Averages)
  const interviewStats = db.prepare(`
    SELECT 
      AVG(overall_score) as avgScore,
      COUNT(*) as totalInterviews
    FROM interview_sessions 
    WHERE user_id = ?
  `).get(userId);

  // 4. Recent Activity (Resume and Interview)
  const rAct = db.prepare(`
    SELECT 'resume' as type, filename as label, created_at as time 
    FROM resume_analyses WHERE user_id = ? ORDER BY created_at DESC LIMIT 5
  `).all(userId);
  
  const iAct = db.prepare(`
    SELECT 'interview' as type, round_type as label, created_at as time 
    FROM interview_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 5
  `).all(userId);

  return {
    questions: questionStats || { solvedTotal: 0, solvedDsa: 0, solvedAptitude: 0, solvedTech: 0 },
    resume: resumeStats || { overall_score: 0 },
    interview: interviewStats || { avgScore: 0, totalInterviews: 0 },
    activities: [...qAct, ...rAct, ...iAct].sort((a,b) => new Date(b.time) - new Date(a.time)).slice(0, 10)
  };
}

export { db };
