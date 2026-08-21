/**
 * Read.ai Meeting Bot — Playwright Core
 * --------------------------------------
 * Joins a Google Meet as "Briefr Bot", captures WebRTC audio in 30-second chunks,
 * sends each chunk to the local Whisper Docker service for transcription,
 * then ships the assembled transcript to the Briefr FastAPI backend.
 *
 * Environment variables (set by server.js via fork env):
 *   MEETING_URL      — Google Meet URL to join
 *   MEETING_ID       — MongoDB meeting ID (for the backend callback)
 *   MEETING_DATE     — ISO date string (YYYY-MM-DD) used by the process endpoint
 *   BACKEND_URL      — Base URL of the Briefr FastAPI backend
 *   BACKEND_TOKEN    — JWT token for authenticating with the backend
 *   WHISPER_URL      — Base URL of the local Whisper service (default: http://localhost:9000)
 */

import "dotenv/config";
import { chromium } from "playwright";
import fetch from "node-fetch";
import FormData from "form-data";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { makeAbsoluteSegments, formatTranscriptAsTxt, buildStructuredTranscript } from "./transcript-utils.js";
import { getSpeakerTrackerScript } from "./speaker-tracker.js";

// `import.meta.dirname` is only available in newer Node versions. Keep the
// bot compatible with the Node >=18 engine declared in package.json.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MEETING_URL = process.env.MEETING_URL;
const MEETING_ID = process.env.MEETING_ID;
const MEETING_DATE = process.env.MEETING_DATE || new Date().toISOString().slice(0, 10);
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const BACKEND_TOKEN = process.env.BACKEND_TOKEN || "";
const WHISPER_URL = process.env.WHISPER_URL || "http://localhost:9000";
// Guest mode is the default. Set BOT_USE_GOOGLE_AUTH=true only when the
// meeting requires a signed-in Google account and auth.json is authorized.
const BOT_NAME = process.env.BOT_NAME || "Briefr Bot";
const BOT_USE_GOOGLE_AUTH = process.env.BOT_USE_GOOGLE_AUTH === "true";
const MAX_DURATION_MS = parseInt(process.env.BOT_MAX_DURATION_MINUTES || "120", 10) * 60 * 1000;

// HuggingFace Inference API — fallback when local Whisper is unreachable.
// Set HF_TOKEN in .env. Leave blank to disable the fallback gracefully.
const HF_TOKEN = process.env.HF_TOKEN || "";
const HF_WHISPER_MODEL = process.env.HF_WHISPER_MODEL || "openai/whisper-large-v3";
const CHUNK_DURATION_MS = 30_000; // 30 seconds per audio chunk

// Minimum audio blob size (bytes) to bother sending to Whisper.
// A real 30-second 16kHz mono webm chunk is typically 50-500 KB.
// Anything under 2 KB is just a container header with no audio frames.
const MIN_CHUNK_BYTES = 2_000;

// ── Helpers ──────────────────────────────────────────────────────────────────

function log(msg) {
  console.log(`[Bot ${MEETING_ID}] ${msg}`);
}

async function updateBotStatus(status) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/meetings/${MEETING_ID}/bot-status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${BACKEND_TOKEN}`,
      },
      body: JSON.stringify({ status }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`HTTP ${res.status} — ${body}`);
    }

    log(`Bot status → ${status}`);
  } catch (e) {
    log(`Failed to update status to ${status}: ${e.message}`);
  }
}

/**
 * Send a webm/opus buffer to the local Whisper service for transcription.
 * Returns the Whisper result, including timestamps, or an empty result.
 */
async function transcribeChunk(audioBuffer, chunkIndex, chunkOffsetMs = 0) {
  if (audioBuffer.length < MIN_CHUNK_BYTES) {
    log(`Chunk ${chunkIndex} too small (${audioBuffer.length} bytes) — skipping (no real audio).`);
    return { text: "", segments: [] };
  }

  // Save as .webm (the actual format from MediaRecorder)
  const tmpPath = path.join(os.tmpdir(), `briefr_chunk_${MEETING_ID}_${chunkIndex}.webm`);
  fs.writeFileSync(tmpPath, audioBuffer);

  // ── Attempt 1: Local faster-whisper Docker service ─────────────────────────
  try {
    const form = new FormData();
    form.append("file", fs.createReadStream(tmpPath), {
      filename: `chunk_${chunkIndex}.webm`,
      contentType: "audio/webm",
    });

    log(`Sending chunk ${chunkIndex} to local Whisper (${audioBuffer.length} bytes)...`);
    const res = await fetch(`${WHISPER_URL}/transcribe`, {
      method: "POST",
      body: form,
      headers: form.getHeaders(),
    });

    if (res.ok) {
      const data = await res.json();
      const preview = (data.text || "").slice(0, 100);
      log(`Chunk ${chunkIndex} [local]: "${preview}${preview.length === 100 ? "…" : ""}"`);
      try { fs.unlinkSync(tmpPath); } catch { }
      return {
        text: data.text || "",
        segments: makeAbsoluteSegments(
          Array.isArray(data.segments) ? data.segments : [],
          chunkOffsetMs,
          chunkIndex,
        ),
      };
    }

    const errBody = await res.text();
    log(`Local Whisper error on chunk ${chunkIndex}: HTTP ${res.status} — ${errBody}. Trying HuggingFace fallback...`);
  } catch (localErr) {
    log(`Local Whisper unreachable for chunk ${chunkIndex}: ${localErr.message}. Trying HuggingFace fallback...`);
  }

  // ── Attempt 2: HuggingFace Inference API fallback ──────────────────────────
  // NOTE: HF Inference API does not return timestamped segments — segments will
  // be empty when the fallback is used. Full transcript text is preserved.
  if (!HF_TOKEN) {
    log(`Chunk ${chunkIndex}: No HF_TOKEN configured — cannot fall back. Skipping chunk.`);
    try { fs.unlinkSync(tmpPath); } catch { }
    return { text: "", segments: [] };
  }

  try {
    log(`Sending chunk ${chunkIndex} to HuggingFace (${HF_WHISPER_MODEL})...`);
    const hfRes = await fetch(
      `https://api-inference.huggingface.co/models/${HF_WHISPER_MODEL}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          "Content-Type": "audio/webm",
        },
        body: audioBuffer,
      }
    );

    if (!hfRes.ok) {
      const hfErr = await hfRes.text();
      log(`HuggingFace error on chunk ${chunkIndex}: HTTP ${hfRes.status} — ${hfErr}`);
    };


    const errBody = await res.text();
    log(`Local Whisper error on chunk ${chunkIndex}: HTTP ${res.status} — ${errBody}. Trying HuggingFace fallback...`);
  } catch (localErr) {
    log(`Local Whisper unreachable for chunk ${chunkIndex}: ${localErr.message}. Trying HuggingFace fallback...`);
  }

  // ── Attempt 2: HuggingFace Inference API fallback ──────────────────────────
  // NOTE: HF Inference API does not return timestamped segments — segments will
  // be empty when the fallback is used. Full transcript text is preserved.
  if (!HF_TOKEN) {
    log(`Chunk ${chunkIndex}: No HF_TOKEN configured — cannot fall back. Skipping chunk.`);
    try { fs.unlinkSync(tmpPath); } catch { }
    return { text: "", segments: [] };
  }

  try {
    log(`Sending chunk ${chunkIndex} to HuggingFace (${HF_WHISPER_MODEL})...`);
    const hfRes = await fetch(
      `https://api-inference.huggingface.co/models/${HF_WHISPER_MODEL}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          "Content-Type": "audio/webm",
        },
        body: audioBuffer,
      }
    );

    if (!hfRes.ok) {
      const hfErr = await hfRes.text();
      log(`HuggingFace error on chunk ${chunkIndex}: HTTP ${hfRes.status} — ${hfErr}`);
      return { text: "", segments: [] };
    }

    const hfData = await hfRes.json();
    const text = hfData.text || "";
    const preview = text.slice(0, 100);
    log(`Chunk ${chunkIndex} [HuggingFace]: "${preview}${preview.length === 100 ? "…" : ""}"`);
    return { text, segments: [] };
  } catch (hfErr) {
    log(`HuggingFace request failed for chunk ${chunkIndex}: ${hfErr.message}`);
    return { text: "", segments: [] };
  } finally {
    try { fs.unlinkSync(tmpPath); } catch { }
  }
}

/**
 * Ship the final assembled transcript to the Briefr backend.
 *
 * @param {string}  fullTranscript  Plain-text transcript ("[HH:MM:SS] Name: text" per line)
 * @param {Array}   segments        Structured dialogue entries or Whisper segments
 * @param {string}  captureMode     "speaker_glow" | "fallback_chunked"
 */
async function sendTranscriptToBackend(fullTranscript, segments, captureMode = "speaker_glow") {
  log(`Sending transcript (${fullTranscript.length} chars, mode=${captureMode}) to backend...`);
  try {
    const res = await fetch(`${BACKEND_URL}/api/bot/transcript-ready`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${BACKEND_TOKEN}`,
      },
      body: JSON.stringify({
        meetingId: MEETING_ID,
        transcript: fullTranscript,
        segments,
        meeting_date: MEETING_DATE,
        captureMode,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      log(`Backend rejected transcript: HTTP ${res.status} — ${text}`);
      return false;
    } else {
      log("Transcript accepted by backend. Pipeline triggered.");
      return true;
    }
  } catch (e) {
    log(`Failed to send transcript: ${e.message}`);
    return false;
  }
}

// ── Main Bot Logic ────────────────────────────────────────────────────────────

async function run() {
  if (!MEETING_URL || !MEETING_ID) {
    console.error("[Bot] MEETING_URL and MEETING_ID must be set.");
    process.exit(1);
  }

  // Guard: if Google Auth mode is enabled, auth.json must exist.
  // Without it the bot will be hard-blocked by Google Meet with no clear error.
  if (BOT_USE_GOOGLE_AUTH) {
    const authPath = path.join(__dirname, "auth.json");

    // If BOT_GOOGLE_AUTH_DATA env var is set, materialize auth.json from it.
    // server.js normally does this on startup, but handle it here too in case
    // bot.js is run directly (e.g. during development).
    if (!fs.existsSync(authPath) && process.env.BOT_GOOGLE_AUTH_DATA) {
      try {
        const decoded = Buffer.from(process.env.BOT_GOOGLE_AUTH_DATA, "base64").toString("utf-8");
        JSON.parse(decoded); // validate
        fs.writeFileSync(authPath, decoded, "utf-8");
        log("auth.json materialized from BOT_GOOGLE_AUTH_DATA env var.");
      } catch (err) {
        log(`Failed to decode BOT_GOOGLE_AUTH_DATA: ${err.message}`);
      }
    }

    if (!fs.existsSync(authPath)) {
      console.error(
        "[Bot] BOT_USE_GOOGLE_AUTH=true but auth.json is missing.\n" +
        "      Set BOT_GOOGLE_AUTH_DATA env var (base64-encoded auth.json),\n" +
        "      or run `node auth-setup.js` in the bot/ directory to create it,\n" +
        "      then restart the bot."
      );
      await updateBotStatus("failed");
      process.exit(1);
    }
  }

  log(`Starting. Target: ${MEETING_URL}`);
  await updateBotStatus("joining");

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--use-fake-ui-for-media-stream",              // Auto-accept camera/mic permission prompts
      "--use-fake-device-for-media-stream",          // Virtual mic/camera (doesn't affect incoming RTC audio)
      "--disable-blink-features=AutomationControlled",
      "--autoplay-policy=no-user-gesture-required",  // Allow AudioContext to start without user gesture
      // NOTE: --mute-audio is intentionally omitted — it can suppress the Web Audio API
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });

  const context = await browser.newContext({
    permissions: ["microphone", "camera"],
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    // Only load a saved Google session when explicitly enabled. Otherwise the
    // bot uses Meet's guest flow and enters as BOT_NAME.
    ...(BOT_USE_GOOGLE_AUTH && fs.existsSync(path.join(__dirname, "auth.json"))
      ? { storageState: path.join(__dirname, "auth.json") }
      : {}),
  });

  const page = await context.newPage();

  // ── KEY FIX: Patch RTCPeerConnection BEFORE page load ─────────────────────
  // The previous approach used page.evaluate() AFTER admission, which missed
  // all existing WebRTC tracks. This init script patches RTCPeerConnection so
  // every incoming audio track — from the first frame onwards — is captured.
  await page.addInitScript(() => {
    const _RTCPeerConnection = window.RTCPeerConnection;

    // Lazily create a shared AudioContext + destination on first audio track
    function ensureBriefr() {
      if (window.__briefr) return window.__briefr;
      const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      const destination = ctx.createMediaStreamDestination();
      window.__briefr = { ctx, destination, sources: new Set() };
      return window.__briefr;
    }

    function attachTrack(track) {
      if (track.kind !== "audio") return;
      const b = ensureBriefr();
      // Deduplicate by track id
      if (b.sources.has(track.id)) return;
      b.sources.add(track.id);
      const stream = new MediaStream([track]);
      const src = b.ctx.createMediaStreamSource(stream);
      src.connect(b.destination);
      console.log("[Briefr] Attached audio track:", track.id);
    }

    // Wrap RTCPeerConnection constructor
    function PatchedRTC(...args) {
      const pc = new _RTCPeerConnection(...args);

      // Intercept the ontrack property
      let _ontrack = null;
      Object.defineProperty(pc, "ontrack", {
        get: () => _ontrack,
        set: (handler) => {
          _ontrack = handler;
        },
      });

      // Always listen for track events at the lowest level
      pc.addEventListener("track", (evt) => {
        attachTrack(evt.track);
        // Also connect streams in the event
        if (evt.streams) {
          evt.streams.forEach((s) =>
            s.getAudioTracks().forEach(attachTrack)
          );
        }
        // Call the original ontrack handler
        if (_ontrack) _ontrack.call(pc, evt);
      });

      return pc;
    }

    // Copy static methods + prototype so Meet's code still works.
    // Use Object.create so PatchedRTC instances still satisfy instanceof checks
    // without sharing the exact same prototype object as the original.
    PatchedRTC.prototype = Object.create(_RTCPeerConnection.prototype, {
      constructor: { value: PatchedRTC, writable: true, configurable: true },
    });
    Object.setPrototypeOf(PatchedRTC, _RTCPeerConnection);
    Object.defineProperty(window, "RTCPeerConnection", {
      value: PatchedRTC,
      writable: true,
      configurable: true,
    });
  });

  // ── Speaker-aware capture state ─────────────────────────────────────────
  // Dialogue entries produced by the speaker-glow tracker + Whisper.
  // Each entry: { speakerId, speakerName, timestamp, dialogue, short, hadOverlap }
  const dialogueEntries = [];

  // Pending in-page speaker turns: speakerId → turn metadata.
  // Filled by __briefrSpeakerTurnStart__, consumed by __briefrSpeakerTurnEnd__.
  const pendingTurns = new Map();

  // Whether the speaker-glow tracker produced at least one entry.
  // Used to decide whether to fall back to chunk-based assembly at the end.
  let captureMode = "speaker_glow";

  // Track collected audio chunk texts (fallback / legacy path)
  const audioChunks = [];
  const transcriptSegments = [];
  // Keep every in-flight Whisper request alive until it has completed. The
  // Whisper service can take longer than the final recorder flush delay.
  const pendingTranscriptions = new Set();
  let chunkIndex = 0;

  // Meeting wall-clock start time (set once admitted).
  let meetingStartedAt = null;

  // ── Expose callbacks for the in-page speaker tracker ──────────────────────

  // Called when a speaker's glow turns ON (turn starts).
  await page.exposeFunction("__briefrSpeakerTurnStart__", (turnMeta) => {
    if (turnMeta.isOverlap) {
      log(`[OVERLAP] ${turnMeta.speakerName} started speaking during an active turn.`);
      return;
    }
    log(`Turn START: ${turnMeta.speakerName} (${turnMeta.speakerId})`);
  });

  // Called when a speaker's glow turns OFF (after MIN_SILENCE_MS debounce).
  // The audio blob will arrive via __briefrAudioChunk__ shortly after, tagged
  // with this same turnMeta so we can join them.
  await page.exposeFunction("__briefrSpeakerTurnEnd__", (turnMeta) => {
    log(`Turn END:   ${turnMeta.speakerName} (${turnMeta.durationMs}ms${turnMeta.short ? " [short]" : ""}${turnMeta.hadOverlap ? " [overlap]" : ""})`);
  });

  // Expose a function the in-page recorder calls to deliver each audio blob.
  // turnMeta is set by the speaker-glow recorder wrapper (null in fallback mode).
  await page.exposeFunction("__briefrAudioChunk__", async (base64Audio, chunkOffsetMs = 0, turnMeta = null) => {
    const transcription = (async () => {
      const buf = Buffer.from(base64Audio, "base64");
      const currentChunk = chunkIndex++;
      const result = await transcribeChunk(buf, currentChunk, chunkOffsetMs);

      if (turnMeta && turnMeta.speakerId) {
        // ── Speaker-glow path ───────────────────────────────────────────────
        const text = result.text.trim();
        if (text) {
          dialogueEntries.push({
            speakerId: turnMeta.speakerId,
            speakerName: turnMeta.speakerName || "Unknown",
            timestamp: turnMeta.timestamp || "00:00:00",
            dialogue: text,
            short: turnMeta.short || false,
            hadOverlap: turnMeta.hadOverlap || false,
          });
          log(`Dialogue [${turnMeta.timestamp}] ${turnMeta.speakerName}: "${text.slice(0, 80)}${text.length > 80 ? "…" : ""}"`);
        }
      } else {
        // ── Fallback / legacy path (no speaker attribution) ─────────────────
        if (result.text.trim()) audioChunks[currentChunk] = result.text.trim();
        for (const segment of result.segments) {
          transcriptSegments.push({ ...segment });
        }
      }
    })();

    pendingTranscriptions.add(transcription);
    try {
      await transcription;
    } finally {
      pendingTranscriptions.delete(transcription);
    }
  });

  try {
    // ── 1. Navigate to the meeting ──────────────────────────────────────────
    log("Navigating to Google Meet...");
    await page.goto(MEETING_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });

    // Short pause for the page to fully hydrate
    await page.waitForTimeout(3_000);

    // ── Detect hard-block pages immediately ────────────────────────────────
    const pageTitle = await page.title();
    const bodyText = await page.locator("body").innerText().catch(() => "");
    if (
      bodyText.includes("You can't join this video call") ||
      bodyText.includes("can't join") ||
      pageTitle.includes("can't join")
    ) {
      const shotPath2 = path.join(os.tmpdir(), `briefr_blocked_${MEETING_ID}.png`);
      await page.screenshot({ path: shotPath2 });
      throw new Error(
        `Google Meet blocked entry: "You can't join this video call". ` +
        `This usually means the meeting requires a signed-in Google account. ` +
        `Set up a Google auth session (see bot/README-auth.md). Screenshot: ${shotPath2}`
      );
    }

    log("Looking for name input...");
    try {
      const nameInput = await page.waitForSelector(
        'input[placeholder="Your name"], input[aria-label="Your name"], input[jsname="YPqjbf"]',
        { timeout: 15_000, state: "visible" }
      );
      await nameInput.fill(BOT_NAME);
      log(`Filled name: "${BOT_NAME}"`);
    } catch {
      log("Name input not found — may already be signed in or Meet UI changed.");
    }

    // ── 3. Turn off mic and camera ──────────────────────────────────────────
    for (const label of ["Turn off microphone", "Mute microphone", "Turn off camera", "Disable camera"]) {
      try {
        const btn = page.locator(`button[aria-label="${label}"]`).first();
        if (await btn.isVisible({ timeout: 2_000 })) {
          await btn.click();
          log(`Clicked: "${label}"`);
        }
      } catch { }
    }

    // ── 4. Ask to join ──────────────────────────────────────────────────────
    let joined = false;
    for (const text of ["Ask to join", "Join now", "Request to join", "Solliciter l'accès"]) {
      try {
        const btn = page.getByRole("button", { name: text, exact: false }).first();
        if (await btn.isVisible({ timeout: 4_000 })) {
          await btn.click();
          log(`Clicked join button: "${text}"`);
          joined = true;
          break;
        }
      } catch { }
    }

    if (!joined) {
      // Take a screenshot to debug what the page looks like
      const shotPath = path.join(os.tmpdir(), `briefr_meet_${MEETING_ID}.png`);
      await page.screenshot({ path: shotPath });
      log(`Could not find join button. Screenshot saved to: ${shotPath}`);
    }

    // ── 5. Wait to be admitted ──────────────────────────────────────────────
    log("Waiting to be admitted from lobby (up to 10 min)...");
    await page.waitForFunction(
      () => {
        // Meet shows the in-call UI once admitted — look for the participant count
        // or the end-call button as evidence we're in the call
        return (
          !document.querySelector('[data-call-type="waiting_room"]') &&
          (
            !!document.querySelector('[data-tooltip="Leave call"]') ||
            !!document.querySelector('button[aria-label="Leave call"]') ||
            !!document.querySelector('[jsname="CQylAd"]')
          )
        );
      },
      { timeout: 10 * 60_000 }
    );
    log("Admitted to meeting! Starting audio capture.");
    await updateBotStatus("recording");
    meetingStartedAt = new Date();

    // Inject the speaker-glow tracker. We do this after admission so the
    // participant tiles are already in the DOM.
    await page.evaluate(getSpeakerTrackerScript({
      minSilenceMs: 1500,
      minUtteranceMs: 800,
      pollMs: 300,
    }));

    // Expose the meeting start time to the in-page tracker for timestamp math.
    await page.evaluate((startMs) => {
      window.__briefrMeetingStartMs__ = startMs;
    }, performance.now ? performance.now() : Date.now());

    // Give WebRTC a moment to fully establish streams after admission
    await page.waitForTimeout(2_000);

    // ── 6. Start MediaRecorder on the intercepted RTCPeerConnection stream ──
    await page.evaluate((chunkDurationMs) => {
      // Resume AudioContext — required by browser autoplay policy even with the flag
      if (window.__briefr?.ctx?.state === "suspended") {
        window.__briefr.ctx.resume().then(() => console.log("[Briefr] AudioContext resumed"));
      }

      const destination = window.__briefr?.destination;
      if (!destination) {
        console.error("[Briefr] No RTCPeerConnection audio tracks captured yet. Audio capture may be empty.");
        // Don't bail — start recording anyway; tracks might arrive shortly
      }

      // Create a destination if none captured yet (fallback)
      const ctx = window.__briefr?.ctx || new AudioContext({ sampleRate: 16000 });
      const dest = destination || ctx.createMediaStreamDestination();

      if (!window.__briefr) {
        window.__briefr = { ctx, destination: dest, sources: new Set() };
      }

      // Also try to connect any existing <audio>/<video> elements as a fallback
      document.querySelectorAll("audio, video").forEach((el) => {
        if (!el.srcObject || el.__briefrConnected) return;
        el.__briefrConnected = true;
        try {
          const src = ctx.createMediaStreamSource(el.srcObject);
          src.connect(dest);
          console.log("[Briefr] Connected DOM media element as fallback.");
        } catch (e) {
          console.warn("[Briefr] Failed to connect element:", e.message);
        }
      });

      // Observe for late-arriving media elements
      const observer = new MutationObserver(() => {
        document.querySelectorAll("audio, video").forEach((el) => {
          if (!el.srcObject || el.__briefrConnected) return;
          el.__briefrConnected = true;
          try {
            const src = ctx.createMediaStreamSource(el.srcObject);
            src.connect(dest);
          } catch { }
        });
      });
      observer.observe(document.body, { childList: true, subtree: true });

      // Choose best supported mimeType
      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
      ].find((t) => MediaRecorder.isTypeSupported(t)) || "";

      console.log("[Briefr] Starting MediaRecorder with mimeType:", mimeType || "(browser default)");

      // When the speaker tracker fires __briefrSpeakerTurnEnd__, we need to
      // emit the current audio buffer tagged with that speaker's metadata.
      // We store the latest turn metadata so the onstop handler can attach it
      // to the blob before calling __briefrAudioChunk__.
      let currentTurnMeta = null;

      // Listen for turn-end signals from the tracker (injected after admission)
      window.__briefrSpeakerTurnEnd__ = window.__briefrSpeakerTurnEnd__ || function () { };
      const _origTurnEnd = window.__briefrSpeakerTurnEnd__;
      window.__briefrSpeakerTurnEnd__ = function (meta) {
        _origTurnEnd(meta);  // still call the exposed Node callback
        currentTurnMeta = meta;
        // Flush the recorder now so this blob maps 1-to-1 to this speaker turn
        if (recorder.state === 'recording' && !window.__briefrIsFlushing__) {
          window.__briefrIsFlushing__ = true;
          flushing = true;
          restartAfterFlush = true;
          recorder.stop();
        }
      };

      const recorder = new MediaRecorder(dest.stream, mimeType ? { mimeType } : {});
      let chunks = [];
      let recorderStartedAt = performance.now();
      let chunkStartOffsetMs = 0;
      let restartAfterFlush = false;
      let flushing = false;

      const resolveRecorderDone = () => {
        window.__briefrRecorderDone__?.();
        window.__briefrRecorderDone__ = null;
      };

      const startRecorder = () => {
        chunkStartOffsetMs = performance.now() - recorderStartedAt;
        recorder.start();
      };

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        flushing = true;
        const intendedRestart = restartAfterFlush;
        restartAfterFlush = false;
        if (chunks.length === 0) {
          console.log("[Briefr] Recorder stopped with 0 chunks.");
        } else {
          const blob = new Blob(chunks, { type: recorder.mimeType });
          const blobChunkStartOffsetMs = chunkStartOffsetMs;
          console.log(`[Briefr] Blob ready: ${blob.size} bytes, type=${blob.type}`);

          // Convert blob → base64 without btoa string-length limits
          const arrayBuffer = await blob.arrayBuffer();
          const uint8 = new Uint8Array(arrayBuffer);
          let binary = "";
          for (let i = 0; i < uint8.length; i += 8192) {
            binary += String.fromCharCode(...uint8.subarray(i, i + 8192));
          }
          const base64 = btoa(binary);
          // Pass the current speaker turn metadata alongside the audio blob
          const turnSnapshot = currentTurnMeta;
          currentTurnMeta = null;
          await window.__briefrAudioChunk__(base64, blobChunkStartOffsetMs, turnSnapshot);
        }
        chunks = [];
        flushing = false;
        window.__briefrIsFlushing__ = false;

        if (intendedRestart && !window.__briefrStopping__) {
          startRecorder();
        } else {
          resolveRecorderDone();
        }
      };

      recorderStartedAt = performance.now();
      startRecorder();
      window.__briefrRecorder__ = recorder;

      // ── FIX: guard against recorder race condition ─────────────────────────
      // onstop is async (blob encode + Node callback). If we call recorder.start()
      // before onstop resolves, the new recorder captures audio before the
      // previous chunk has been handed off, corrupting both chunks.
      // Keep the state on the page so the final stop can wait for an in-flight
      // Whisper handoff instead of closing the browser mid-flush.
      window.__briefrIsFlushing__ = false;

      // Flush every CHUNK_DURATION_MS — but only when the previous flush is done
      window.__briefrChunkTimer__ = setInterval(() => {
        if (recorder.state === "recording" && !window.__briefrIsFlushing__) {
          window.__briefrIsFlushing__ = true;
          flushing = true;
          restartAfterFlush = true;
          recorder.stop();
        }
        window.__briefrIsFlushing__ = flushing;
      }, chunkDurationMs);

      console.log("[Briefr] Recorder started.");
    }, CHUNK_DURATION_MS);

    // ── 7. Wait for meeting to end or timeout ──────────────────────────────
    const reason = await page.waitForFunction(() => {
      const bodyText = (document.body?.innerText || "").toLowerCase();
      const endMessages = [
        "you left the meeting",
        "you've left the meeting",
        "you have left the meeting",
        "the meeting has ended",
        "meeting ended",
        "call ended",
        "you were removed from the meeting",
        "you've been removed from the meeting",
        "you can't join this video call",
        "return to home screen",
      ];

      return (
        endMessages.some((message) => bodyText.includes(message)) ||
        Boolean(document.querySelector('[data-call-type="post_call"]'))
      );
    }, { timeout: 0 })
      .then(() => "ended")
      .catch((e) => `error: ${e.message}`);

    log(`Meeting session over: ${reason}`);

    // Stop recorder and flush last chunk
    await page.evaluate(() => new Promise((resolve) => {
      clearInterval(window.__briefrChunkTimer__);
      window.__briefrRecorderDone__ = resolve;
      window.__briefrStopping__ = true;
      if (window.__briefrRecorder__?.state === "recording") {
        // The stable onstop handler will resolve after the final Whisper
        // handoff. It will not restart because stopping is true.
        window.__briefrRecorder__.stop();
      } else if (!window.__briefrIsFlushing__) {
        resolve();
      }
    })).catch(() => { });

    // Wait for the final MediaRecorder callback and every Whisper request.
    // A fixed delay was unreliable because faster-whisper can take longer
    // than six seconds, especially on CPU.
    const flushDeadline = Date.now() + 120_000;
    while (pendingTranscriptions.size > 0 && Date.now() < flushDeadline) {
      await Promise.all([...pendingTranscriptions]);
    }

    if (pendingTranscriptions.size > 0) {
      log(`Timed out waiting for ${pendingTranscriptions.size} Whisper request(s).`);
    }

  } catch (err) {
    log(`Error during meeting: ${err.message}`);
    log(err.stack || "");
    await updateBotStatus("failed");
  } finally {
    await browser.close();
  }

  // ── 8. Assemble and ship transcript ────────────────────────────────────
  const meetingEndedAt = new Date();

  let fullTranscript;
  let finalSegments;
  let finalCaptureMode;

  if (dialogueEntries.length > 0) {
    // ── Primary path: speaker-glow capture produced entries ─────────────
    finalCaptureMode = "speaker_glow";
    fullTranscript = formatTranscriptAsTxt(dialogueEntries);
    finalSegments = buildStructuredTranscript(
      dialogueEntries,
      MEETING_ID,
      finalCaptureMode,
      meetingStartedAt,
      meetingEndedAt,
    ).timeline;
    log(`Speaker-glow capture: ${dialogueEntries.length} dialogue entries, ${fullTranscript.length} chars.`);
  } else {
    // ── Fallback path: glow detection yielded nothing, use raw chunks ────
    finalCaptureMode = "fallback_chunked";
    fullTranscript = audioChunks.filter(Boolean).join(" ").trim();
    transcriptSegments.sort((a, b) => a.chunkIndex - b.chunkIndex || a.start - b.start);
    finalSegments = transcriptSegments;
    log(`Fallback capture: ${audioChunks.length} chunks, ${fullTranscript.length} chars.`);
  }

  if (fullTranscript.length > 0) {
    const accepted = await sendTranscriptToBackend(fullTranscript, finalSegments, finalCaptureMode);
    await updateBotStatus(accepted ? "done" : "failed");
  } else {
    log("No transcript captured — nothing to send.");
    await updateBotStatus("failed");
  }

  log("Bot session complete.");
  process.exit(0);
}

run().catch((err) => {
  console.error("[Bot] Fatal error:", err);
  process.exit(1);
});
