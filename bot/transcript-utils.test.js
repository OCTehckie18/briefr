import test from "node:test";
import assert from "node:assert/strict";
import {
  formatTimestamp,
  makeAbsoluteSegments,
  formatTranscriptAsTxt,
  buildStructuredTranscript,
} from "./transcript-utils.js";

test("formats meeting-relative timestamps as HH:MM:SS", () => {
  assert.equal(formatTimestamp(0), "00:00:00");
  assert.equal(formatTimestamp(3723.9), "01:02:03");
});

test("adds the chunk offset to Whisper segment times", () => {
  assert.deepEqual(
    makeAbsoluteSegments(
      [{ start: 1.25, end: 4.5, text: "Hello", speaker: null }],
      30_000,
      1,
    ),
    [{
      start: 31.25,
      end: 34.5,
      text: "Hello",
      speaker: null,
      timestamp: "00:00:31",
      chunkIndex: 1,
      speakerId: null,
      speakerName: null,
    }],
  );
});

// ── formatTranscriptAsTxt ─────────────────────────────────────────────────────

test("formatTranscriptAsTxt: produces [HH:MM:SS] Name: text lines", () => {
  const entries = [
    { speakerId: "a1", speakerName: "Alice", timestamp: "00:01:00", dialogue: "Hello everyone." },
    { speakerId: "b2", speakerName: "Bob",   timestamp: "00:01:12", dialogue: "Good morning." },
  ];
  const out = formatTranscriptAsTxt(entries);
  assert.equal(out, "[00:01:00] Alice: Hello everyone.\n[00:01:12] Bob: Good morning.");
});

test("formatTranscriptAsTxt: adds [~] prefix for overlap entries", () => {
  const entries = [
    { speakerId: "a1", speakerName: "Alice", timestamp: "00:02:00", dialogue: "I agree.", hadOverlap: true },
  ];
  assert.ok(formatTranscriptAsTxt(entries).startsWith("[00:02:00] [~] Alice:"));
});

test("formatTranscriptAsTxt: falls back to 'Unknown' for missing speakerName", () => {
  const entries = [
    { speakerId: null, speakerName: null, timestamp: "00:00:30", dialogue: "Something was said." },
  ];
  assert.ok(formatTranscriptAsTxt(entries).includes("Unknown:"));
});

test("formatTranscriptAsTxt: returns empty string for empty array", () => {
  assert.equal(formatTranscriptAsTxt([]), "");
});

test("formatTranscriptAsTxt: skips entries with no dialogue", () => {
  const entries = [
    { speakerId: "a1", speakerName: "Alice", timestamp: "00:00:05", dialogue: "" },
    { speakerId: "b2", speakerName: "Bob",   timestamp: "00:00:10", dialogue: "Real text." },
  ];
  const lines = formatTranscriptAsTxt(entries).split("\n");
  assert.equal(lines.length, 1);
  assert.ok(lines[0].includes("Bob:"));
});

// ── buildStructuredTranscript ─────────────────────────────────────────────────

test("buildStructuredTranscript: generates sequential event_ids", () => {
  const entries = [
    { speakerId: "a1", speakerName: "Alice", timestamp: "00:00:05", dialogue: "First." },
    { speakerId: "b2", speakerName: "Bob",   timestamp: "00:00:20", dialogue: "Second." },
  ];
  const doc = buildStructuredTranscript(entries, "meet-123", "speaker_glow");
  assert.equal(doc.timeline[0].event_id, "meet-123-0000");
  assert.equal(doc.timeline[1].event_id, "meet-123-0001");
});

test("buildStructuredTranscript: preserves short and hadOverlap flags", () => {
  const entries = [
    { speakerId: "a1", speakerName: "Alice", timestamp: "00:00:01", dialogue: "Yep.", short: true, hadOverlap: true },
  ];
  const { timeline } = buildStructuredTranscript(entries, "m1");
  assert.equal(timeline[0].short, true);
  assert.equal(timeline[0].hadOverlap, true);
});

test("buildStructuredTranscript: handles null dates gracefully", () => {
  const doc = buildStructuredTranscript([], "m1", "speaker_glow", null, null);
  assert.equal(doc.started_at, null);
  assert.equal(doc.ended_at, null);
});

test("buildStructuredTranscript: sets capture_mode on the document", () => {
  const doc = buildStructuredTranscript([], "m1", "fallback_chunked");
  assert.equal(doc.capture_mode, "fallback_chunked");
});
