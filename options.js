// options.js for Gemini (cross-browser)
const api = typeof browser !== "undefined" ? browser : chrome;

const keyInput = document.getElementById("key");
const modelInput = document.getElementById("model");
const statusEl = document.getElementById("status");
const saveBtn = document.getElementById("save");
const testBtn = document.getElementById("test");
const testNotifBtn = document.getElementById("test-notif");
const createCacheBtn = document.getElementById("create-cache");
const showNotificationsCheckbox = document.getElementById("show-notifications");

function setStatus(kind, message) {
  statusEl.classList.remove("status-success", "status-error");
  if (kind) statusEl.classList.add(kind);
  statusEl.textContent = message || "";
}

async function load() {
  const { GEMINI_API_KEY, MODEL_NAME, SHOW_NOTIFICATIONS } =
    await api.storage.sync.get([
      "GEMINI_API_KEY",
      "MODEL_NAME",
      "SHOW_NOTIFICATIONS",
    ]);
  if (GEMINI_API_KEY) keyInput.value = GEMINI_API_KEY;
  modelInput.value = MODEL_NAME || "gemini-2.5-flash";
  showNotificationsCheckbox.checked = SHOW_NOTIFICATIONS !== false; // Default to true
  testNotifBtn.classList.toggle("hidden", !SHOW_NOTIFICATIONS);
}
load();

document.getElementById("save").addEventListener("click", async () => {
  const GEMINI_API_KEY = keyInput.value.trim();
  const MODEL_NAME = modelInput.value.trim() || "gemini-2.5-flash";
  const SHOW_NOTIFICATIONS = showNotificationsCheckbox.checked;
  await api.storage.sync.set({
    GEMINI_API_KEY,
    MODEL_NAME,
    SHOW_NOTIFICATIONS,
  });
  setStatus("status-success", "Saved.");

  testNotifBtn.classList.toggle("hidden", !SHOW_NOTIFICATIONS);

  // Recreate cache with new settings
  if (GEMINI_API_KEY) {
    try {
      const res = await api.runtime.sendMessage({ type: "create-cache" });
      if (res && res.ok) {
        setStatus("status-success", "Saved and cache updated.");
      } else {
        setStatus("status-success", "Saved (cache update failed).");
      }
    } catch (e) {
      setStatus("status-success", "Saved (cache update failed).");
    }
  }

  setTimeout(() => setStatus(null, ""), 2000);
});

document.getElementById("test").addEventListener("click", async () => {
  testBtn.disabled = true;
  testBtn.textContent = "Testing…";
  setStatus(null, "Testing…");
  const { GEMINI_API_KEY, MODEL_NAME } = await api.storage.sync.get([
    "GEMINI_API_KEY",
    "MODEL_NAME",
  ]);
  if (!GEMINI_API_KEY) {
    setStatus("status-error", "No API key saved.");
    testBtn.disabled = false;
    testBtn.textContent = "Test Call";
    return;
  }
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      MODEL_NAME || "gemini-2.5-flash"
    )}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: "Reply with the single word: OK" }] },
        ],
        generationConfig: { temperature: 0.2 },
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (text.includes("OK")) {
      setStatus("status-success", "Test succeeded.");
    } else {
      setStatus("status-error", "Unexpected response (check model name).");
    }
  } catch (e) {
    setStatus("status-error", "Test failed: " + e.message);
  }
  testBtn.disabled = false;
  testBtn.textContent = "Test Call";
});

testNotifBtn.addEventListener("click", async () => {
  testNotifBtn.disabled = true;
  testNotifBtn.textContent = "Sending…";
  setStatus(null, "Sending test notification…");
  try {
    const res = await api.runtime.sendMessage({ type: "test-notification" });
    if (res && res.ok) {
      setStatus("status-success", "Notification sent.");
    } else {
      setStatus("status-error", res?.error || "Failed to send notification.");
    }
  } catch (e) {
    setStatus("status-error", e?.message || "Failed to send notification.");
  }
  testNotifBtn.disabled = false;
  testNotifBtn.textContent = "Test Notification";
});
