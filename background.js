// background.js - MV3 service worker (Gemini 2.5 Flash)
// Uses data: URL for downloads (URL.createObjectURL isn't available in MV3 SW)
// Cross-browser shim for Chrome/Firefox
const api = typeof browser !== "undefined" ? browser : chrome;

const DEFAULT_MODEL = "gemini-2.5-flash";

// Unified notification helper (Chrome callbacks + Firefox promises)
function notify(title, message, requireInteraction = true) {
  const manifest = api.runtime.getManifest?.() || {};
  const actionIcons =
    manifest.action && manifest.action.default_icon
      ? manifest.action.default_icon
      : {};
  const appIcons = manifest.icons || {};
  const iconPath =
    (actionIcons && (actionIcons[128] || actionIcons["128"])) ||
    (appIcons && (appIcons[128] || appIcons["128"])) ||
    "icons/icon128.png";
  const iconUrl = api.runtime.getURL(iconPath);
  const isFirefox =
    (typeof browser !== "undefined" && typeof chrome === "undefined") ||
    /firefox/i.test(
      (typeof navigator !== "undefined" && navigator.userAgent) || ""
    );
  const opts = { type: "basic", iconUrl, title, message };
  if (!isFirefox) {
    opts.priority = 2;
    if (requireInteraction) opts.requireInteraction = true;
  }
  // Firefox supports promise-based API; Chrome uses callback
  try {
    const maybePromise = api.notifications.create("", opts);
    if (maybePromise && typeof maybePromise.then === "function") {
      return maybePromise;
    }
    return new Promise((resolve, reject) => {
      api.notifications.create("", opts, (id) => {
        if (api.runtime.lastError) {
          return reject(new Error(api.runtime.lastError.message));
        }
        resolve(id);
      });
    });
  } catch (err) {
    // Fallback to callback-style
    return new Promise((resolve, reject) => {
      try {
        api.notifications.create("", opts, (id) => {
          if (api.runtime.lastError) {
            return reject(new Error(api.runtime.lastError.message));
          }
          resolve(id);
        });
      } catch (e) {
        reject(e);
      }
    });
  }
}

api.runtime.onInstalled.addListener(() => {
  api.contextMenus.create({
    id: "make-ics",
    title: "Create calendar event",
    contexts: ["selection"],
  });
  api.runtime.openOptionsPage();
});

function buildPrompt(selectedText) {
  return `You are a converter that turns arbitrary event text into a valid RFC 5545 iCalendar file.

REQUIREMENTS

Output MUST be ONLY the .ics text, starting with BEGIN:VCALENDAR and ending with END:VCALENDAR. No commentary, no code fences.

Create one VCALENDAR that may contain one or more VEVENTs.

VCALENDAR fields (exactly once):

VERSION:2.0

PRODID:-//Event2ICS//EN

CALSCALE:GREGORIAN

METHOD:PUBLISH

VEVENT CONTENT (for each parsed event)

Required: UID, DTSTAMP (current UTC), SUMMARY, and one of:

Timed event: DTSTART + DTEND (prefer local TZ with TZID=), or DTSTART + DURATION.

All-day event: DTSTART;VALUE=DATE (and optionally DTEND;VALUE=DATE, non-inclusive end).

Nice to have when available:

LOCATION (escape commas/semicolons with \, \;)

DESCRIPTION (multiline: details, booking refs, seats/rooms, notes)

ATTENDEE lines (ATTENDEE;CN=Name:mailto:user@example.com)

ORGANIZER if obvious (ORGANIZER;CN=Name:mailto:...)

URL (a single canonical link)

CATEGORIES (comma-separated keywords; escape commas)

STATUS:CONFIRMED and TRANSP:OPAQUE (default unless event implies tentative)

VALARM (see Alarms section)

TIME & TIMEZONE RULES

If city/venue/airport is given, infer the correct IANA TZID (e.g., Paris→Europe/Paris, New York/JFK→America/New_York, San Francisco→America/Los_Angeles, Austin→America/Chicago, London→Europe/London, Tokyo→Asia/Tokyo).

Prefer local wall time with TZID= for DTSTART/DTEND. Example: DTSTART;TZID=Europe/Paris:20250901T093000.

If timezone cannot be inferred, fall back to UTC with a trailing Z and ensure duration is correct.

For multi-day all-day events, use DTSTART;VALUE=DATE:YYYYMMDD and DTEND;VALUE=DATE:YYYYMMDD with non-inclusive end.

It’s acceptable to omit VTIMEZONE components (most modern clients resolve TZID automatically). Do not invent custom timezones.

RECURRENCE

If the text implies repetition (e.g., every Monday 9–10 for 6 weeks; monthly on the 3rd; weekdays; until a given date), include an RRULE that matches:

Examples:

RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=20251117T235959Z

RRULE:FREQ=DAILY;COUNT=10

RRULE:FREQ=MONTHLY;BYMONTHDAY=3

When a specific end date/time is provided for the series, translate to UNTIL (UTC). If a count is given, use COUNT.

ATTENDEES & ORGANIZER (when present)

Email → mailto:. Include CN param if a name is present.

Example: ATTENDEE;CN=Alex Martin:mailto:alex@example.com

ALARMS (optional but useful)

If the text mentions reminders (e.g., “remind me 30m before”), add one VALARM per event:
'''
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:Reminder
TRIGGER:-PT30M
END:VALARM
'''

PARSING & SANITIZATION

Escape commas and semicolons in text fields using backslashes (\, \;).

Normalize line breaks in DESCRIPTION as \\n.

Keep SUMMARY short and informative (e.g., “Team Sync”, “JetBlue 1908 — Paris (CDG) → New York (JFK)”, “Hotel Check-in — Park Hyatt Tokyo”).

Generate deterministic but arbitrary UID like:
uid-{yyyyMMddHHmm}-{slugified-summary}-{random-ish}@event2ics.local

Use chronological order for multiple VEVENTs.

If input has multiple items (e.g., a flight + hotel + meeting), create one VEVENT for each.

MAPPINGS / HINTS

Flights/Trains/Buses: include route in SUMMARY (AAA→BBB) and terminals/platforms in LOCATION; times are local to departure/arrival locations; one VEVENT per leg.

Hotels: All-day DTSTART;VALUE=DATE check-in date and DTEND;VALUE=DATE check-out date; LOCATION = hotel name + address; DESCRIPTION may include confirmation # and room.

Meetings/Calls/Classes: timed VEVENT with local TZ; include meeting link in URL; put dial-in or agenda in DESCRIPTION.

Concerts/Shows/Events: venue in LOCATION; ticket URL in URL; doors vs showtime in DESCRIPTION.

If duration is stated but end time is not, compute DTEND from DTSTART + duration.

If only a date is given (no time), make an all-day event.

OUTPUT FORMAT

Return ONLY the iCalendar text.

Use CRLF line endings (\r\n).

Example property ordering per VEVENT: UID, DTSTAMP, DTSTART, DTEND/DURATION, SUMMARY, LOCATION, DESCRIPTION, optional fields, STATUS, TRANSP, alarms.

Now convert this event text:
<<<EVENTS
${selectedText}
EVENTS
>>>`;
}

async function callGemini(selectedText, apiKey, modelName) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    modelName || DEFAULT_MODEL
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const body = {
    contents: [{ role: "user", parts: [{ text: buildPrompt(selectedText) }] }],
    generationConfig: { temperature: 0.2 },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Gemini error: ${res.status}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return text;
}

// --- Robust ICS normalization & download ---
function normalizeIcsText(text) {
  if (!text) return "";
  text = text.replace(/```(?:ics)?/g, ""); // strip fences
  text = text.replace(/\\u003e/g, ">"); // unescape >
  text = text.trim();
  // CRLF per RFC 5545
  text = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n/g, "\r\n");
  return text;
}

async function safeDownloadIcs(raw) {
  const ics = normalizeIcsText(raw);
  if (!/BEGIN:VCALENDAR/.test(ics) || !/END:VCALENDAR/.test(ics)) {
    throw new Error("The response did not look like a valid .ics file.");
  }
  const filename = `itinerary-${Date.now()}.ics`;
  const isFirefox =
    (typeof browser !== "undefined" && typeof chrome === "undefined") ||
    /firefox/i.test(
      (typeof navigator !== "undefined" && navigator.userAgent) || ""
    );
  if (
    isFirefox &&
    typeof URL !== "undefined" &&
    typeof URL.createObjectURL === "function"
  ) {
    // Firefox blocks data: URLs for downloads; use Blob + object URL
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    try {
      await api.downloads.download({ url: objectUrl, filename });
    } finally {
      // Revoke shortly after to allow download to start
      setTimeout(() => {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch (_) {}
      }, 5000);
    }
  } else {
    // Chromium MV3 service worker lacks createObjectURL; use data URL
    const dataUrl =
      "data:text/calendar;charset=utf-8," + encodeURIComponent(ics);
    await api.downloads.download({ url: dataUrl, filename });
  }
}

api.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== "make-ics") return;
  const selected = info.selectionText?.trim();
  if (!selected) return;

  const { GEMINI_API_KEY, MODEL_NAME } = await api.storage.sync.get([
    "GEMINI_API_KEY",
    "MODEL_NAME",
  ]);
  if (!GEMINI_API_KEY) {
    notify(
      "Missing Gemini API key",
      "Open the extension options to add your Gemini API key."
    );
    api.runtime.openOptionsPage();
    return;
  }

  try {
    const raw = await callGemini(
      selected,
      GEMINI_API_KEY,
      MODEL_NAME || DEFAULT_MODEL
    );
    await safeDownloadIcs(raw);
  } catch (e) {
    console.error(e);
    notify("Failed to create .ics", e?.message || "Unknown error");
  }
});

// Handle popup requests to generate ICS from freeform text
api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return;
  if (message.type === "test-notification") {
    (async () => {
      try {
        await notify(
          "Test Notification",
          "This is a test from options page.",
          true
        );
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: e?.message || "Failed" });
      }
    })();
    return true;
  }
  if (message.type === "generate-ics-from-text") {
    (async () => {
      const text = String(message.text || "").trim();
      if (!text) {
        sendResponse({ ok: false, error: "No text provided" });
        return;
      }
      const { GEMINI_API_KEY, MODEL_NAME } = await api.storage.sync.get([
        "GEMINI_API_KEY",
        "MODEL_NAME",
      ]);
      if (!GEMINI_API_KEY) {
        try {
          await notify(
            "Missing Gemini API key",
            "Open the extension options to add your Gemini API key."
          );
        } catch (e) {}
        sendResponse({ ok: false, error: "Missing API key" });
        return;
      }
      try {
        const raw = await callGemini(
          text,
          GEMINI_API_KEY,
          MODEL_NAME || DEFAULT_MODEL
        );
        await safeDownloadIcs(raw);
        sendResponse({ ok: true });
      } catch (e) {
        console.error(e);
        try {
          await notify("Failed to create .ics", e?.message || "Unknown error");
        } catch (e2) {}
        sendResponse({ ok: false, error: e?.message || "Unknown error" });
      }
    })();
    return true; // keep message channel open for async sendResponse
  }
});
