/**
 * Briefr Speaker Tracker — Google Meet Glow Detection
 * -----------------------------------------------------
 * Returns a self-contained JS script string (safe for Playwright's
 * addInitScript / evaluateHandle) that watches Google Meet's DOM for the
 * active-speaker highlight ("glow") on participant tiles.
 *
 * Strategy
 * --------
 * Google Meet renders a coloured border/box-shadow on the video tile of the
 * person currently speaking.  The exact CSS class and attribute names are
 * obfuscated and change between Meet versions, so we use a multi-signal
 * approach ranked by reliability:
 *
 *   1. [data-ssrc] or [data-requested-participant-id] attribute changes
 *      combined with a computed box-shadow that contains the Meet
 *      highlight hue (blue ≈ hsl(217) or green ≈ hsl(142)).
 *   2. An overlay/badge element with aria-label containing "is speaking".
 *   3. The `jsmodel` / `jsname` attribute pattern Meet uses for the active
 *      speaker ring (observed in 2024–2025 builds: jsname="BHbSLc" or the
 *      container with [data-participant-id] whose child has box-shadow).
 *
 * All three signals are polled every POLL_MS milliseconds in addition to a
 * MutationObserver so we catch both CSS-driven and JS-driven changes.
 *
 * @param {object} opts
 * @param {number} opts.minSilenceMs   — ms of glow-off before turn is "ended"    (default 1500)
 * @param {number} opts.minUtteranceMs — ms below which entry is flagged short:true (default 800)
 * @param {number} opts.pollMs         — DOM poll interval in ms                   (default 300)
 * @returns {string} Script source to pass to page.addInitScript()
 */
export function getSpeakerTrackerScript({
  minSilenceMs = 1500,
  minUtteranceMs = 800,
  pollMs = 300,
} = {}) {
  // We serialise the options into the script string so no closure over
  // outer variables is needed — important for Playwright's sandboxed context.
  return `
(function briefrSpeakerTracker() {
  'use strict';

  var MIN_SILENCE_MS   = ${minSilenceMs};
  var MIN_UTTERANCE_MS = ${minUtteranceMs};
  var POLL_MS          = ${pollMs};

  // ── Participant registry ─────────────────────────────────────────────────
  // id (string) → { name: string, lastSeen: number }
  window.__briefrParticipants__ = window.__briefrParticipants__ || new Map();

  /**
   * Refresh the participant registry by scraping all visible tile name labels.
   * Called on every poll cycle.
   *
   * Meet tile selectors observed across 2024-2025 builds:
   *   [data-participant-id]         — outermost per-person container
   *   [data-requested-participant-id]
   *   [jsmodel]                     — inner model element on some builds
   *
   * Name label selectors (in priority order):
   *   [data-self-name]              — your own tile
   *   .zWGUib                       — participant name chip (2024 build)
   *   [data-tooltip]                — fallback: tooltip often contains name
   *   [aria-label]                  — last resort
   */
  function refreshParticipants() {
    var selectors = [
      '[data-participant-id]',
      '[data-requested-participant-id]',
    ];

    selectors.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (tile) {
        var id = tile.dataset.participantId || tile.dataset.requestedParticipantId;
        if (!id) return;

        // Try several name label strategies
        var nameEl =
          tile.querySelector('[data-self-name]') ||
          tile.querySelector('.zWGUib') ||
          tile.querySelector('[data-tooltip]') ||
          tile.querySelector('[aria-label]');

        var name =
          (nameEl && (nameEl.dataset.selfName || nameEl.dataset.tooltip || nameEl.getAttribute('aria-label') || nameEl.textContent)) ||
          null;

        if (name) name = name.trim().replace(/\\s+/g, ' ');

        window.__briefrParticipants__.set(id, {
          name: name || 'Participant-' + id.slice(-4),
          lastSeen: Date.now(),
        });
      });
    });
  }

  // ── Glow / active-speaker detection ─────────────────────────────────────
  /**
   * Returns the participant id of the currently speaking person, or null.
   *
   * Detection order:
   *   A. box-shadow hue scan on [data-participant-id] containers
   *   B. aria-label "… is speaking" badge
   *   C. Meet's internal active-speaker attribute pattern
   */
  function getActiveSpeakerId() {
    // Strategy A — box-shadow colour present on the tile
    var SPEAKING_BOX_SHADOW_PATTERNS = [
      // Meet uses a blue or green ring depending on version/theme
      'rgb(26, 115, 232)',   // Google blue
      'rgb(0, 200, 83)',     // Google green
      'rgba(26, 115, 232',   // with alpha
      'rgba(0, 200, 83',
      '26, 115, 232',
      '0, 200, 83',
    ];

    var tiles = document.querySelectorAll('[data-participant-id], [data-requested-participant-id]');
    for (var i = 0; i < tiles.length; i++) {
      var tile = tiles[i];
      var style = window.getComputedStyle(tile);
      var shadow = style.boxShadow || '';
      var border = style.borderColor || '';
      var outline = style.outlineColor || '';

      var combined = shadow + border + outline;
      var hasGlow = SPEAKING_BOX_SHADOW_PATTERNS.some(function (p) {
        return combined.indexOf(p) !== -1;
      });

      if (!hasGlow) {
        // Also check immediate children — Meet sometimes puts the ring on a child div
        var child = tile.querySelector('div');
        if (child) {
          var cs = window.getComputedStyle(child);
          combined = (cs.boxShadow || '') + (cs.borderColor || '') + (cs.outlineColor || '');
          hasGlow = SPEAKING_BOX_SHADOW_PATTERNS.some(function (p) {
            return combined.indexOf(p) !== -1;
          });
        }
      }

      if (hasGlow) {
        return tile.dataset.participantId || tile.dataset.requestedParticipantId || null;
      }
    }

    // Strategy B — aria-label "is speaking" badge
    var badge = document.querySelector('[aria-label*="is speaking"]');
    if (badge) {
      // Walk up to find the tile
      var el = badge;
      while (el) {
        if (el.dataset && (el.dataset.participantId || el.dataset.requestedParticipantId)) {
          return el.dataset.participantId || el.dataset.requestedParticipantId;
        }
        el = el.parentElement;
      }
    }

    // Strategy C — Meet's jsname-based speaking ring (observed: jsname="BHbSLc")
    var ring = document.querySelector('[jsname="BHbSLc"]');
    if (ring) {
      var el = ring;
      while (el) {
        if (el.dataset && (el.dataset.participantId || el.dataset.requestedParticipantId)) {
          return el.dataset.participantId || el.dataset.requestedParticipantId;
        }
        el = el.parentElement;
      }
    }

    return null;
  }

  // ── Speaker-turn state machine ────────────────────────────────────────────
  var currentSpeakerId   = null;  // id of person currently glowing
  var turnStartedAt      = null;  // performance.now() when glow started
  var silenceStartedAt   = null;  // performance.now() when glow stopped
  var overlapLogged      = false; // did we log an overlap in this turn?

  /**
   * Called when a speaker's turn is complete (glow off for > MIN_SILENCE_MS).
   * Assembles and emits the audio slice for Whisper, then calls
   * window.__briefrSpeakerTurnEnd__() with turn metadata so bot.js can
   * attach the Whisper result and emit a dialogue entry.
   */
  function finaliseTurn(speakerId, speakerName, startMs, endMs) {
    var durationMs = endMs - startMs;
    var isShort    = durationMs < MIN_UTTERANCE_MS;

    var meetingStartMs = window.__briefrMeetingStartMs__ || startMs;
    var tsSeconds      = Math.max(0, Math.floor((startMs - meetingStartMs) / 1000));
    var hh = String(Math.floor(tsSeconds / 3600)).padStart(2, '0');
    var mm = String(Math.floor((tsSeconds % 3600) / 60)).padStart(2, '0');
    var ss = String(tsSeconds % 60).padStart(2, '0');
    var timestamp = hh + ':' + mm + ':' + ss;

    if (window.__briefrSpeakerTurnEnd__) {
      window.__briefrSpeakerTurnEnd__({
        speakerId:    speakerId,
        speakerName:  speakerName,
        timestamp:    timestamp,
        turnStartMs:  startMs,
        turnEndMs:    endMs,
        durationMs:   durationMs,
        short:        isShort,
        hadOverlap:   overlapLogged,
      });
    }
  }

  // ── Poll loop ─────────────────────────────────────────────────────────────
  function tick() {
    refreshParticipants();

    var activeSpeakerId = getActiveSpeakerId();
    var now = performance.now();

    if (activeSpeakerId) {
      if (currentSpeakerId === null) {
        // New speaker turn starts
        currentSpeakerId = activeSpeakerId;
        turnStartedAt    = now;
        silenceStartedAt = null;
        overlapLogged    = false;

        var info = window.__briefrParticipants__.get(activeSpeakerId) || {};
        if (window.__briefrSpeakerTurnStart__) {
          window.__briefrSpeakerTurnStart__({
            speakerId:   activeSpeakerId,
            speakerName: info.name || 'Unknown',
            turnStartMs: now,
          });
        }

      } else if (activeSpeakerId !== currentSpeakerId) {
        // Different participant is now glowing — overlap / speaker change
        if (!overlapLogged) {
          overlapLogged = true;
          // Log overlap annotation but keep the original speaker as dominant
          if (window.__briefrSpeakerTurnStart__) {
            var overlapInfo = window.__briefrParticipants__.get(activeSpeakerId) || {};
            window.__briefrSpeakerTurnStart__({
              speakerId:   activeSpeakerId,
              speakerName: '[OVERLAP] ' + (overlapInfo.name || 'Unknown'),
              turnStartMs: now,
              isOverlap:   true,
            });
          }
        }
      }

      // Glow is on — reset the silence timer
      silenceStartedAt = null;

    } else {
      // No active glow
      if (currentSpeakerId !== null) {
        if (silenceStartedAt === null) {
          // Silence just started
          silenceStartedAt = now;
        } else if (now - silenceStartedAt >= MIN_SILENCE_MS) {
          // Silence has been long enough — finalise the turn
          var sid   = currentSpeakerId;
          var sInfo = window.__briefrParticipants__.get(sid) || {};
          var sName = sInfo.name || 'Unknown';
          var sStart = turnStartedAt;

          currentSpeakerId = null;
          turnStartedAt    = null;
          silenceStartedAt = null;

          finaliseTurn(sid, sName, sStart, now - MIN_SILENCE_MS);
        }
      }
    }
  }

  // Start polling
  var _pollId = setInterval(tick, POLL_MS);
  window.__briefrTrackerPollId__ = _pollId;

  // Also observe DOM mutations for faster response on CSS-class changes
  var _observer = new MutationObserver(function (mutations) {
    // Only re-check if a style/class/attribute change happened on a tile
    var relevant = mutations.some(function (m) {
      return m.type === 'attributes' &&
        (m.attributeName === 'style' || m.attributeName === 'class' || m.attributeName === 'data-participant-id');
    });
    if (relevant) tick();
  });
  _observer.observe(document.body, {
    attributes: true,
    subtree: true,
    attributeFilter: ['style', 'class', 'data-participant-id', 'data-requested-participant-id'],
  });
  window.__briefrTrackerObserver__ = _observer;

  console.log('[Briefr] Speaker tracker initialised (minSilenceMs=${minSilenceMs}, minUtteranceMs=${minUtteranceMs}, pollMs=${pollMs})');
})();
`;
}
