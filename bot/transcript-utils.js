export function formatTimestamp(seconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = String(Math.floor(safeSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((safeSeconds % 3600) / 60)).padStart(2, "0");
  const remainingSeconds = String(safeSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${remainingSeconds}`;
}

/**
 * Convert Whisper's chunk-relative segment times to meeting-relative times.
 * Speaker fields remain nullable because Whisper itself does not diarize.
 */
export function makeAbsoluteSegments(segments, chunkOffsetMs, chunkIndex) {
  const offsetSeconds = Math.max(0, Number(chunkOffsetMs) || 0) / 1000;

  return segments
    .filter((segment) => segment && typeof segment === "object")
    .map((segment) => {
      const start = Math.max(0, (Number(segment.start) || 0) + offsetSeconds);
      const end = Math.max(start, (Number(segment.end) || start) + offsetSeconds);

      return {
        ...segment,
        start: Number(start.toFixed(2)),
        end: Number(end.toFixed(2)),
        timestamp: formatTimestamp(start),
        chunkIndex,
        speakerId: segment.speakerId || null,
        speakerName: segment.speakerName || segment.speaker || null,
        speaker: segment.speaker || null,
      };
    });
}

/**
 * Format a list of speaker-attributed dialogue entries as the plain-text
 * transcript format expected by the Briefr backend pipeline:
 *
 *   [HH:MM:SS] SpeakerName: dialogue text
 *
 * @param {Array<{speakerId:string, speakerName:string, timestamp:string, dialogue:string, short?:boolean, hadOverlap?:boolean}>} entries
 * @returns {string} Multi-line transcript string
 */
export function formatTranscriptAsTxt(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return "";

  return entries
    .filter((e) => e && e.dialogue && e.dialogue.trim())
    .map((e) => {
      const ts   = e.timestamp  || "00:00:00";
      const name = e.speakerName || "Unknown";
      const text = e.dialogue.trim();
      const overlapPrefix = e.hadOverlap ? "[~] " : "";
      return `[${ts}] ${overlapPrefix}${name}: ${text}`;
    })
    .join("\n");
}

/**
 * Build the canonical structured-transcript JSON document from a list of
 * dialogue entries. This is the meeting-level timeline stored in the backend
 * as the `segments` field and used by the LLM/academic pipelines.
 *
 * @param {Array<object>} entries     — dialogue entries from __briefrDialogueEntry__
 * @param {string}        meetingId   — Briefr meeting ID
 * @param {string}        captureMode — "speaker_glow" | "fallback_chunked"
 * @param {Date|null}     startedAt   — JS Date when recording began (optional)
 * @param {Date|null}     endedAt     — JS Date when recording ended (optional)
 * @returns {object} Canonical transcript document
 */
export function buildStructuredTranscript(entries, meetingId, captureMode = "speaker_glow", startedAt = null, endedAt = null) {
  const timeline = (entries || [])
    .filter((e) => e && e.dialogue && e.dialogue.trim())
    .map((e, idx) => ({
      event_id:    `${meetingId}-${idx.toString().padStart(4, "0")}`,
      timestamp:   e.timestamp   || "00:00:00",
      speakerId:   e.speakerId   || null,
      speakerName: e.speakerName || "Unknown",
      dialogue:    e.dialogue.trim(),
      short:       e.short       || false,
      hadOverlap:  e.hadOverlap  || false,
    }));

  return {
    meeting_id:   meetingId,
    capture_mode: captureMode,
    started_at:   startedAt  ? startedAt.toISOString()  : null,
    ended_at:     endedAt    ? endedAt.toISOString()    : null,
    timeline,
  };
}
