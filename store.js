const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const HABITS_FILE = path.join(DATA_DIR, 'habits.json');

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, '[]', 'utf8');
  }

  if (!fs.existsSync(HABITS_FILE)) {
    fs.writeFileSync(HABITS_FILE, '[]', 'utf8');
  }
}

function readJson(filePath) {
  ensureDataFiles();
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    if (!content.trim()) return [];
    return JSON.parse(content);
  } catch (error) {
    return [];
  }
}

function writeJson(filePath, data) {
  ensureDataFiles();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function normalizeEmail(email = '') {
  return String(email).trim().toLowerCase();
}

function readUsers() {
  return readJson(USERS_FILE);
}

function writeUsers(users) {
  writeJson(USERS_FILE, users);
}

function readHabits() {
  return readJson(HABITS_FILE);
}

function writeHabits(habits) {
  writeJson(HABITS_FILE, habits);
}

function findUserByEmail(email) {
  const users = readUsers();
  const normalized = normalizeEmail(email);
  return users.find((user) => normalizeEmail(user.email) === normalized) || null;
}

module.exports = {
  readUsers,
  writeUsers,
  readHabits,
  writeHabits,
  findUserByEmail,
  normalizeEmail,
  ensureDataFiles,
};