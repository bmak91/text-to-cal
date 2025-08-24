// Cross-browser api handle
const api =
  typeof browser !== "undefined" && browser.runtime
    ? browser
    : typeof chrome !== "undefined"
    ? chrome
    : null;
if (!api) {
  throw new Error("Extension APIs not available");
}

const ta = document.getElementById("text");
const btn = document.getElementById("generate");
const opts = document.getElementById("options");
const statusEl = document.getElementById("status");

function setLoading(isLoading) {
  btn.disabled = isLoading;
  btn.textContent = isLoading ? "Generating…" : "Generate .ics";
}

function setStatus(kind, message) {
  statusEl.classList.remove("status-success", "status-error");
  if (kind) statusEl.classList.add(kind);
  statusEl.textContent = message || "";
}

function autoresize() {
  ta.style.height = "auto";
  ta.style.height = Math.min(ta.scrollHeight, 280) + "px";
}
ta.addEventListener("input", autoresize);
setTimeout(autoresize, 0);

async function submit() {
  const text = ta.value.trim();
  if (!text) {
    setStatus("status-error", "Nothing to send.");
    return;
  }
  setLoading(true);
  setStatus(null, "Generating…");
  try {
    const res = await api.runtime.sendMessage({
      type: "generate-ics-from-text",
      text,
    });
    if (res && res.ok) {
      setStatus("status-success", "Downloaded.");
      setTimeout(() => window.close(), 800);
    } else {
      setStatus("status-error", res?.error || "Failed.");
    }
  } catch (e) {
    setStatus("status-error", e?.message || "Failed.");
  }
  setLoading(false);
}

btn.addEventListener("click", submit);

document.addEventListener("keydown", (e) => {
  const metaOrCtrl = e.metaKey || e.ctrlKey;
  if (metaOrCtrl && e.key === "Enter") {
    e.preventDefault();
    submit();
  }
});

opts.addEventListener("click", () => {
  try {
    api.runtime.openOptionsPage();
  } catch (_) {}
});
