/**
 * Briefr Meeting Bot — HTTP Server
 * ----------------------------------
 * Accepts POST /start-bot requests from the Briefr backend (triggered by APScheduler)
 * and spawns a Playwright bot process for each meeting session.
 *
 * POST /start-bot
 *   Body: { meetingUrl, meetingId, meetingDate, backendUrl, backendToken }
 *
 * GET /health
 *   Returns { status: "ok" }
 */

import "dotenv/config";
import express from "express";
import { fork } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());

const PORT = process.env.BOT_PORT || 3001;

// Track active bot processes by meetingId to prevent duplicate joins
const activeBots = new Map();

app.get("/health", (_req, res) => {
  res.json({ status: "ok", activeBots: activeBots.size });
});

app.post("/start-bot", (req, res) => {
  const { meetingUrl, meetingId, meetingDate, backendUrl, backendToken } = req.body;

  if (!meetingUrl || !meetingId) {
    return res.status(400).json({ error: "meetingUrl and meetingId are required" });
  }

  try {
    const url = new URL(meetingUrl);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported protocol');
  } catch {
    return res.status(400).json({ error: "meetingUrl must be a valid HTTP(S) URL" });
  }

  if (activeBots.has(meetingId)) {
    return res.status(409).json({ error: "Bot already running for this meeting" });
  }

  console.log(`[BotServer] Spawning bot for meeting ${meetingId} at ${meetingUrl}`);

  let botProcess;
  try {
    botProcess = fork(path.join(__dirname, "bot.js"), [], {
      env: {
        ...process.env,
        MEETING_URL: meetingUrl,
        MEETING_ID: meetingId,
        MEETING_DATE: meetingDate || new Date().toISOString().slice(0, 10),
        BACKEND_URL: backendUrl || process.env.BACKEND_URL || "http://localhost:8000",
        BACKEND_TOKEN: backendToken || process.env.BACKEND_TOKEN || "",
        WHISPER_URL: process.env.WHISPER_URL || "http://localhost:9000",
      },
    });
  } catch (err) {
    console.error(`[BotServer] Failed to spawn bot for ${meetingId}:`, err.message);
    return res.status(503).json({ error: "Unable to start bot process" });
  }

  activeBots.set(meetingId, botProcess);

  botProcess.on("exit", (code) => {
    console.log(`[BotServer] Bot for ${meetingId} exited with code ${code}`);
    activeBots.delete(meetingId);
  });

  botProcess.on("error", (err) => {
    console.error(`[BotServer] Bot process error for ${meetingId}:`, err.message);
    activeBots.delete(meetingId);
  });

  res.json({ status: "started", meetingId });
});

app.listen(PORT, () => {
  console.log(`[BotServer] Briefr Meeting Bot server running on port ${PORT}`);
});
