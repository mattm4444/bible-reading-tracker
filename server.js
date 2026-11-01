// Bible Reading Tracker: static page + one JSON state file, with optional
// off-box backup of that file to a private GitHub repo. No dependencies.
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 8080;
const DATA_DIR = process.env.DATA_DIR || "/data";
const STATE = path.join(DATA_DIR, "state.json");
const PUBLIC = path.join(__dirname, "public");
const TYPES = { ".html": "text/html; charset=utf-8", ".png": "image/png", ".json": "application/manifest+json" };

// ---- backup settings (all optional) ----
const GH_TOKEN = process.env.GITHUB_TOKEN || "";
const GH_REPO = process.env.GITHUB_REPO || "";            // e.g. mattm4444/bible-reading-tracker
const GH_PATH = process.env.GITHUB_BACKUP_PATH || "backup/progress.json";
const GH_API = process.env.GITHUB_API || "https://api.github.com";
const BACKUP_DELAY = (Number(process.env.BACKUP_DELAY_MINUTES) || 10) * 60000;
const backupOn = Boolean(GH_TOKEN && GH_REPO);
const backup = { enabled: backupOn, lastAt: null, error: null };

fs.mkdirSync(DATA_DIR, { recursive: true });
const emptyState = () => ({ done: {}, last: null, updated: 0 });
const readState = () => { try { return JSON.parse(fs.readFileSync(STATE, "utf8")); } catch { return emptyState(); } };
const writeState = s => { const tmp = STATE + ".tmp"; fs.writeFileSync(tmp, JSON.stringify(s)); fs.renameSync(tmp, STATE); };
const chaptersRead = s => Object.values(s.done || {}).reduce((n, a) => n + a.length, 0);
const send = (res, code, body, type = "application/json") => {
  res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};

// ---- GitHub backup ----
const gh = (method, body) => fetch(`${GH_API}/repos/${GH_REPO}/contents/${GH_PATH}`, {
  method,
  headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "bible-tracker", "Content-Type": "application/json" },
  body: body ? JSON.stringify(body) : undefined,
});
let backupTimer = null, backedUpVersion = null;

async function runBackup() {
  if (!backupOn) return;
  const s = readState();
  if (s.updated === backedUpVersion) return;
  try {
    let sha;
    const cur = await gh("GET");
    if (cur.ok) sha = (await cur.json()).sha;
    else if (cur.status !== 404) throw new Error(`GitHub said ${cur.status} when reading the backup`);
    const put = await gh("PUT", {
      message: `Progress backup: ${chaptersRead(s)} chapters read`,
      content: Buffer.from(JSON.stringify(s, null, 1)).toString("base64"),
      sha,
    });
    if (!put.ok) throw new Error(`GitHub said ${put.status} when saving the backup: ${(await put.text()).slice(0, 200)}`);
    backedUpVersion = s.updated; backup.lastAt = Date.now(); backup.error = null;
    console.log(`Backed up progress to ${GH_REPO}/${GH_PATH} (${chaptersRead(s)} chapters)`);
  } catch (e) {
    backup.error = e.message;
    console.error("Backup failed, retrying in 30 minutes:", e.message);
    clearTimeout(backupTimer); backupTimer = setTimeout(runBackup, 30 * 60000);
  }
}
function scheduleBackup() { if (!backupOn) return; clearTimeout(backupTimer); backupTimer = setTimeout(runBackup, BACKUP_DELAY); }

async function restoreIfEmpty() {
  if (!backupOn || fs.existsSync(STATE)) return;
  try {
    const r = await gh("GET");
    if (r.status === 404) { console.log("No backup on GitHub yet; starting fresh."); return; }
    if (!r.ok) throw new Error(`GitHub said ${r.status}`);
    const s = JSON.parse(Buffer.from((await r.json()).content, "base64").toString("utf8"));
    writeState(s); backedUpVersion = s.updated; backup.lastAt = Date.now();
    console.log(`Restored ${chaptersRead(s)} chapters from the GitHub backup.`);
  } catch (e) {
    backup.error = "Couldn't restore from GitHub: " + e.message;
    console.error(backup.error);
  }
}

// ---- HTTP ----
const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0];
  if (url === "/api/state" && req.method === "GET") return send(res, 200, { ...readState(), backup });
  if (url === "/api/state" && req.method === "PUT") {
    let raw = "";
    req.on("data", c => { raw += c; if (raw.length > 1e6) req.destroy(); });
    req.on("end", () => {
      let s; try { s = JSON.parse(raw); } catch { return send(res, 400, { error: "bad json" }); }
      if (typeof s !== "object" || !s || typeof s.done !== "object") return send(res, 400, { error: "bad state" });
      const cur = readState();
      if ((s.updated || 0) < (cur.updated || 0)) return send(res, 409, { ...cur, backup }); // a newer save already exists
      writeState({ done: s.done, last: s.last || null, updated: s.updated || Date.now() });
      scheduleBackup();
      send(res, 200, { ok: true, backup });
    });
    return;
  }
  const file = url === "/" ? "index.html" : url.slice(1);
  const full = path.join(PUBLIC, path.normalize(file));
  if (!full.startsWith(PUBLIC)) return send(res, 404, "Not found", "text/plain");
  fs.readFile(full, (err, buf) => err ? send(res, 404, "Not found", "text/plain")
    : send(res, 200, buf, TYPES[path.extname(full)] || "application/octet-stream"));
});

restoreIfEmpty().then(() => {
  server.listen(PORT, () => console.log(`Bible tracker on :${PORT}, data in ${STATE}, GitHub backup ${backupOn ? "on" : "off"}`));
  if (backupOn) { setTimeout(runBackup, 60000); setInterval(runBackup, 24 * 3600000); }  // catch-up + daily safety net
});
