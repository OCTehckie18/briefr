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
async function transcribeChunk(audioBuffer, chunkIndex) {
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
      try { fs.unlinkSync(tmpPath); } catch {}
      return {
        text: data.text || "",
        segments: Array.isArray(data.segments) ? data.segments : [],
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
    try { fs.unlinkSync(tmpPath); } catch {}
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
    try { fs.unlinkSync(tmpPath); } catch {}
  }
}

/**
 * Ship the final assembled transcript to the Briefr backend.
 */
async function sendTranscriptToBackend(fullTranscript, segments) {
  log(`Sending transcript (${fullTranscript.length} chars) to backend...`);
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
        // Keep the timestamped chunks. Speaker is intentionally null until a
        // diarization/voice-identity step assigns it; guessing from wording
        // produces incorrect names.
        segments,
        meeting_date: MEETING_DATE,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      log(`Backend rejected transcript: HTTP ${res.status} — ${text}`);
    } else {
      log("Transcript accepted by backend. Pipeline triggered.");
    }
  } catch (e) {
    log(`Failed to send transcript: ${e.message}`);
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

  // Track collected audio chunk texts
  const audioChunks = [];
  const transcriptSegments = [];
  // Keep every in-flight Whisper request alive until it has completed. The
  // Whisper service can take longer than the final recorder flush delay.
  const pendingTranscriptions = new Set();
  let chunkIndex = 0;

  // Expose a function the in-page recorder calls to deliver each audio blob
  await page.exposeFunction("__briefrAudioChunk__", async (base64Audio) => {
    const transcription = (async () => {
      const buf = Buffer.from(base64Audio, "base64");
      const currentChunk = chunkIndex++;
      const result = await transcribeChunk(buf, currentChunk);
      if (result.text.trim()) audioChunks[currentChunk] = result.text.trim();
      for (const segment of result.segments) {
        transcriptSegments.push({
          ...segment,
          chunkIndex: currentChunk,
          speaker: segment.speaker || null,
        });
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
      } catch {}
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
      } catch {}
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
          } catch {}
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

      const recorder = new MediaRecorder(dest.stream, mimeType ? { mimeType } : {});
      let chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        if (chunks.length === 0) {
          console.log("[Briefr] Recorder stopped with 0 chunks.");
          window.__briefrRecorderDone__?.();
          window.__briefrRecorderDone__ = null;
          return;
        }
        const blob = new Blob(chunks, { type: recorder.mimeType });
        console.log(`[Briefr] Blob ready: ${blob.size} bytes, type=${blob.type}`);

        // Convert blob → base64 without btoa string-length limits
        const arrayBuffer = await blob.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);
        let binary = "";
        // Process in 8192-byte chunks to avoid call stack limits
        for (let i = 0; i < uint8.length; i += 8192) {
          binary += String.fromCharCode(...uint8.subarray(i, i + 8192));
        }
        const base64 = btoa(binary);
        // Await the exposed Node callback so the final page evaluation can
        // observe that the chunk has been handed off to Whisper.
        await window.__briefrAudioChunk__(base64);
        chunks = [];
        window.__briefrRecorderDone__?.();
        window.__briefrRecorderDone__ = null;
      };

      recorder.start();
      window.__briefrRecorder__ = recorder;

      // ── FIX: guard against recorder race condition ─────────────────────────
      // onstop is async (blob encode + Node callback). If we call recorder.start()
      // before onstop resolves, the new recorder captures audio before the
      // previous chunk has been handed off, corrupting both chunks.
      // __briefrIsFlushing__ is set true during onstop and cleared once done.
      window.__briefrIsFlushing__ = false;

      // Flush every CHUNK_DURATION_MS — but only when the previous flush is done
      window.__briefrChunkTimer__ = setInterval(() => {
        if (recorder.state === "recording" && !window.__briefrIsFlushing__) {
          window.__briefrIsFlushing__ = true;
          // Swap onstop to a one-shot that restarts the recorder after flushing
          const originalOnstop = recorder.onstop;
          recorder.onstop = async (e) => {
            if (originalOnstop) await originalOnstop.call(recorder, e);
            recorder.start();
            window.__briefrIsFlushing__ = false;
          };
          recorder.stop();
        }
      }, chunkDurationMs);

      console.log("[Briefr] Recorder started.");
    }, CHUNK_DURATION_MS);

    // ── 7. Wait for meeting to end or timeout ──────────────────────────────
    log(`Waiting for meeting to end (max ${MAX_DURATION_MS / 60000} min)...`);
    const reason = await Promise.race([
      page.waitForSelector(
        '[data-call-type="post_call"], [jsname="r4nke"], h1:has-text("left"), h1:has-text("ended")',
        { timeout: MAX_DURATION_MS }
      ).then(() => "ended").catch(() => "timeout"),
      new Promise((resolve) => setTimeout(() => resolve("timeout"), MAX_DURATION_MS)),
    ]);

    log(`Meeting session over: ${reason}`);

    // Stop recorder and flush last chunk
    await page.evaluate(() => new Promise((resolve) => {
      clearInterval(window.__briefrChunkTimer__);
      window.__briefrRecorderDone__ = resolve;
      if (window.__briefrRecorder__?.state === "recording") {
        window.__briefrRecorder__.stop();
      } else {
        resolve();
      }
    })).catch(() => {});

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
  const fullTranscript = audioChunks.filter(Boolean).join(" ").trim();
  transcriptSegments.sort((a, b) => a.chunkIndex - b.chunkIndex || a.start - b.start);
  log(`Total chunks: ${audioChunks.length}, transcript length: ${fullTranscript.length} chars.`);

  if (fullTranscript.length > 0) {
    await sendTranscriptToBackend(fullTranscript, transcriptSegments);
    await updateBotStatus("done");
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
