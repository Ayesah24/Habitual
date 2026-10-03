const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { readUsers, writeUsers, findUserByEmail, normalizeEmail } = require('../utils/store');

const router = express.Router();

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, username: user.username },
    process.env.JWT_SECRET || 'habitual-secret-change-this-in-production',
    { expiresIn: '7d' }
  );
}

router.post('/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body || {};

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Username, email and password are required.' });
    }

    const normalizedEmail = normalizeEmail(email);
    const users = readUsers();

    if (users.some((user) => normalizeEmail(user.email) === normalizedEmail)) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    if (users.some((user) => user.username.toLowerCase() === String(username).trim().toLowerCase())) {
      return res.status(409).json({ message: 'That username is already taken.' });
    }

    if (String(password).length < 4) {
      return res.status(400).json({ message: 'Password must be at least 4 characters.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      username: String(username).trim(),
      email: normalizedEmail,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    writeUsers(users);

    const token = generateToken(newUser);

    return res.status(201).json({
      message: 'Account created successfully.',
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Signup failed.', error: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ message: 'Account not found. Please sign up first.' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Incorrect password.' });
    }

    const token = generateToken(user);

    return res.status(200).json({
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Login failed.', error: error.message });
  }
});

router.get('/me', require('../middleware/auth'), (req, res) => {
  const { id, email, username } = req.user || {};
  if (!id) {
    return res.status(401).json({ message: 'User not found.' });
  }

  return res.status(200).json({
    user: {
      id,
      email,
      username,
    },
  });
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email, password, confirmPassword } = req.body || {};

    if (!email || !password || !confirmPassword) {
      return res.status(400).json({ message: 'Email, new password and confirmation are required.' });
    }

    const user = findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ message: 'No account was found with that email address.' });
    }

    if (String(password).length < 4) {
      return res.status(400).json({ message: 'Password must be at least 4 characters.' });
    }

    if (String(password) !== String(confirmPassword)) {
      return res.status(400).json({ message: 'Passwords do not match.' });
    }

    const users = readUsers();
    const targetIndex = users.findIndex((item) => normalizeEmail(item.email) === normalizeEmail(email));

    if (targetIndex === -1) {
      return res.status(404).json({ message: 'Account could not be found.' });
    }

    users[targetIndex].password = await bcrypt.hash(password, 10);
    writeUsers(users);

    return res.status(200).json({ message: 'Password updated successfully. You can log in with your new password.' });
  } catch (error) {
    return res.status(500).json({ message: 'Password reset failed.', error: error.message });
  }
});

module.exports = router;