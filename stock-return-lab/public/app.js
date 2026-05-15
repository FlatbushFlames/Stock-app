const state = {
  universe: [],
  featuredUniverse: [],
  rows: [],
  sort: "full.totalReturnPct",
  selected: null,
  selectedHistory: null
};

const $ = (id) => document.getElementById(id);
const fmtPct = (v) => Number.isFinite(v) ? `${v >= 0 ? "+" : ""}${v.toFixed(2)}%` : "-";
const fmtMoney = (v) => Number.isFinite(v) ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v) : "-";
const cls = (v) => Number(v) >= 0 ? "pos" : "neg";
const scenarioKey = "stock-return-lab-scenarios";
const apiCachePrefix = "stock-return-lab-api:";
let deferredInstallPrompt = null;

function get(obj, path) {
  return path.split(".").reduce((acc, key) => acc == null ? null : acc[key], obj);
}

function setStatus(text, tone = "var(--green)") {
  $("status").textContent = text;
  $("status").style.color = tone;
}

async function api(path) {
  const cacheKey = `${apiCachePrefix}${path}`;
  try {
    const res = await fetch(path, { cache: "no-store" });
    const body = await res.json();
    if (!res.ok || body.error) throw new Error(body.error || `Request failed ${res.status}`);
    localStorage.setItem(cacheKey, JSON.stringify({
      savedAt: new Date().toISOString(),
      body
    }));
    return body;
  } catch (error) {
    const cached = readCachedApi(cacheKey);
    if (cached) {
      setStatus(`Offline mode: using saved data from ${new Date(cached.savedAt).toLocaleString()}`, "var(--amber)");
      return cached.body;
    }
    throw error;
  }
}

function readCachedApi(cacheKey) {
  try {
    return JSON.parse(localStorage.getItem(cacheKey) || "null");
  } catch {
    return null;
  }
}

function populateSectors() {
  const sectors = ["All", ...new Set(state.universe.map((x) => x.sector))].sort();
  $("sector").innerHTML = sectors.map((x) => `<option value="${x}">${x}</option>`).join("");
}

function selectedSymbols() {
  const custom = $("symbols").value.trim();
  if (custom) return custom.split(/[\s,]+/).filter(Boolean).join(",");
  const sector = $("sector").value;
  const source = state.featuredUniverse.length ? state.featuredUniverse : state.universe;
  const filtered = sector === "All" ? source : source.filter((x) => x.sector === sector);
  return filtered.map((x) => x.symbol).join(",");
}

function filteredRows() {
  const q = $("search").value.trim().toLowerCase();
  const min = Number($("minReturn").value);
  return state.rows.filter((r) => {
    if (r.error || !r.full) return true;
    const haystack = [r.symbol, r.sector, r.industry, r.subIndustry].join(" ").toLowerCase();
    if (q && !haystack.includes(q)) return false;
    if (Number.isFinite(min) && $("minReturn").value.trim() && Number(r.full.totalReturnPct) < min) return false;
    return true;
  });
}

function sortRows(rows) {
  const path = state.sort;
  return [...rows].sort((a, b) => {
    const av = get(a, path);
    const bv = get(b, path);
    if (typeof av === "string" || typeof bv === "string") return String(av || "").localeCompare(String(bv || ""));
    return (Number(bv) || -Infinity) - (Number(av) || -Infinity);
  });
}

function renderSummary(rows) {
  const good = rows.filter((r) => !r.error && r.full);
  const best = sortRows(good)[0];
  const sectors = new Set(good.map((r) => r.sector)).size;
  $("summary").innerHTML = [
    ["Stocks analyzed", good.length],
    ["Sectors", sectors],
    ["Best on sort", best ? `${best.symbol} ${fmtPct(get(best, state.sort))}` : "-"],
    ["Updated", new Date().toLocaleTimeString()]
  ].map(([k, v]) => `<div class="tile"><div class="k">${k}</div><div class="v">${v}</div></div>`).join("");
}

function renderLeaders(rows) {
  const good = rows.filter((r) => !r.error && r.full);
  const groupBy = $("groupBy").value;
  const path = state.sort;
  const best = new Map();
  for (const row of good) {
    const group = row[groupBy] || "Other";
    const current = best.get(group);
    if (!current || Number(get(row, path) || -Infinity) > Number(get(current, path) || -Infinity)) {
      best.set(group, row);
    }
  }
  const leaders = [...best.entries()]
    .sort((a, b) => Number(get(b[1], path) || -Infinity) - Number(get(a[1], path) || -Infinity));
  $("rankLabel").textContent = `${leaders.length} groups ranked by ${$("sort").selectedOptions[0]?.textContent || state.sort}`;
  $("leaders").innerHTML = leaders.map(([group, row]) => `
    <div class="leader" data-symbol="${row.symbol}">
      <div class="group">${group}</div>
      <div class="symbol ${cls(get(row, path))}">${row.symbol} ${fmtPct(get(row, path))}</div>
      <div class="meta">${row.industry} | ${row.subIndustry}</div>
    </div>
  `).join("");
  document.querySelectorAll(".leader[data-symbol]").forEach((card) => {
    card.addEventListener("click", () => showDetail(card.dataset.symbol));
  });
}

function renderRows() {
  const rows = sortRows(filteredRows());
  renderSummary(rows);
  renderLeaders(rows);
  $("rows").innerHTML = rows.map((r) => {
    if (r.error) {
      return `<tr><td>${r.symbol}</td><td colspan="10" class="err">${r.error}</td></tr>`;
    }
    const w = r.windows?.[0] || {};
    return `<tr data-symbol="${r.symbol}">
      <td><strong>${r.symbol}</strong></td>
      <td>${r.sector}</td>
      <td>${r.industry}</td>
      <td>${r.subIndustry}</td>
      <td class="num">${fmtMoney(r.price)}</td>
      <td class="num ${cls(r.full?.totalReturnPct)}">${fmtPct(r.full?.totalReturnPct)}</td>
      <td class="num ${cls(r.full?.annualizedReturnPct)}">${fmtPct(r.full?.annualizedReturnPct)}</td>
      <td class="num ${cls(w.totalReturnPct)}">${fmtPct(w.totalReturnPct)}</td>
      <td class="num ${cls(w.averageDailyReturnPct)}">${fmtPct(w.averageDailyReturnPct)}</td>
      <td class="num ${cls(w.averageWeeklyReturnPct)}">${fmtPct(w.averageWeeklyReturnPct)}</td>
      <td class="num ${cls(w.averageMonthlyReturnPct)}">${fmtPct(w.averageMonthlyReturnPct)}</td>
    </tr>`;
  }).join("");
  document.querySelectorAll("tbody tr[data-symbol]").forEach((row) => {
    row.addEventListener("click", () => showDetail(row.dataset.symbol));
  });
  const selectedStillVisible = rows.some((row) => row.symbol === state.selected);
  if ((!state.selected || !selectedStillVisible) && rows[0] && !rows[0].error) {
    showDetail(rows[0].symbol);
  }
}

async function showDetail(symbol) {
  state.selected = symbol;
  const row = state.rows.find((x) => x.symbol === symbol);
  if (!row || row.error) return;
  $("selectedLabel").textContent = `${row.symbol} | ${row.industry || row.sector}`;
  try {
    const history = await api(`/api/history?symbol=${encodeURIComponent(symbol)}`);
    state.selectedHistory = history;
    drawChart(history.rows || [], symbol);
  } catch {
    state.selectedHistory = null;
    drawChart([], symbol);
  }
  $("detail").innerHTML = (row.windows || []).map((w) => `
    <div class="tile">
      <div class="k">${w.label}</div>
      <div class="v ${cls(w.totalReturnPct)}">${fmtPct(w.totalReturnPct)}</div>
      <p>${w.startDate} to ${w.endDate}</p>
      <p>Daily ${fmtPct(w.averageDailyReturnPct)} | Weekly ${fmtPct(w.averageWeeklyReturnPct)} | Monthly ${fmtPct(w.averageMonthlyReturnPct)}</p>
    </div>
  `).join("");
  if (!(row.windows || []).length) {
    $("detail").innerHTML = `<div class="tile"><div class="k">No 5-year history yet</div><div class="v">${row.symbol}</div></div>`;
  }
}

function drawChart(rows, symbol) {
  const canvas = $("chart");
  const ctx = canvas.getContext("2d");
  const width = canvas.clientWidth || 900;
  const height = Number(canvas.getAttribute("height")) || 220;
  canvas.width = width * devicePixelRatio;
  canvas.height = height * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#0e141b";
  ctx.fillRect(0, 0, width, height);
  const sample = rows.filter((_, i) => i % Math.max(1, Math.floor(rows.length / 420)) === 0);
  if (sample.length < 2) return;
  const first = sample[0].close;
  const values = sample.map((r) => ((r.close / first) - 1) * 100);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = 28;
  const y = (v) => height - pad - ((v - min) / Math.max(1, max - min)) * (height - pad * 2);
  const x = (i) => pad + (i / Math.max(1, values.length - 1)) * (width - pad * 2);
  ctx.strokeStyle = "#223142";
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const yy = pad + i * ((height - pad * 2) / 3);
    ctx.beginPath();
    ctx.moveTo(pad, yy);
    ctx.lineTo(width - pad, yy);
    ctx.stroke();
  }
  ctx.strokeStyle = "#25e783";
  ctx.lineWidth = 2;
  ctx.beginPath();
  values.forEach((v, i) => {
    if (i === 0) ctx.moveTo(x(i), y(v));
    else ctx.lineTo(x(i), y(v));
  });
  ctx.stroke();
  ctx.fillStyle = "#e7edf5";
  ctx.font = "12px Consolas, monospace";
  ctx.fillText(`${symbol} 20Y adjusted return path`, pad, 18);
  ctx.fillStyle = "#91a3ba";
  ctx.fillText(`${fmtPct(values.at(-1))} total`, width - 130, 18);
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportCsv() {
  const headers = ["Symbol", "Sector", "Industry", "Sub Industry", "Price", "20Y Total", "20Y Annualized", "Last 5Y", "Avg Daily", "Avg Weekly", "Avg Monthly"];
  const lines = [headers.join(",")];
  for (const r of sortRows(filteredRows())) {
    if (r.error) continue;
    const w = r.windows?.[0] || {};
    lines.push([
      r.symbol, r.sector, r.industry, r.subIndustry, r.price,
      r.full?.totalReturnPct, r.full?.annualizedReturnPct, w.totalReturnPct,
      w.averageDailyReturnPct, w.averageWeeklyReturnPct, w.averageMonthlyReturnPct
    ].map(csvEscape).join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `stock-return-lab-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function readSaved() {
  try {
    return JSON.parse(localStorage.getItem(scenarioKey) || "[]");
  } catch {
    return [];
  }
}

function saveScenario(item) {
  const saved = readSaved();
  saved.unshift({ ...item, savedAt: new Date().toISOString() });
  localStorage.setItem(scenarioKey, JSON.stringify(saved.slice(0, 12)));
  renderSaved();
}

function renderSaved() {
  const saved = readSaved();
  $("saved").innerHTML = saved.length ? saved.map((s, index) => `
    <div class="leader saved-card" data-query="${String(s.query || "").replace(/"/g, "&quot;")}">
      <button class="delete-saved" data-index="${index}" title="Delete saved scenario">x</button>
      <div class="group">${new Date(s.savedAt).toLocaleString()}</div>
      <div class="symbol ${cls(s.profit)}">${s.symbol} ${fmtMoney(s.valueToday)}</div>
      <div class="meta">Profit ${fmtMoney(s.profit)} | ${fmtPct(s.returnPct)}</div>
    </div>
  `).join("") : `<div class="tile"><div class="k">No saved scenarios yet</div><div class="v">Run a query</div></div>`;
  document.querySelectorAll("#saved .leader[data-query]").forEach((card) => {
    card.addEventListener("click", () => { $("question").value = card.dataset.query; ask(); });
  });
  document.querySelectorAll(".delete-saved").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const rows = readSaved();
      rows.splice(Number(button.dataset.index), 1);
      localStorage.setItem(scenarioKey, JSON.stringify(rows));
      renderSaved();
    });
  });
}

async function run() {
  try {
    setStatus("Loading prices...", "var(--amber)");
    const symbols = selectedSymbols();
    const body = await api(`/api/screener?symbols=${encodeURIComponent(symbols)}`);
    state.rows = body.rows;
    state.selected = null;
    renderRows();
    setStatus(navigator.onLine ? "Live analysis ready" : "Offline mode: using saved analysis", navigator.onLine ? "var(--green)" : "var(--amber)");
  } catch (error) {
    setStatus("Error", "var(--red)");
    $("answer").innerHTML = `<span class="err">${error.message}</span>`;
  }
}

async function ask() {
  try {
    setStatus("Running scenario...", "var(--amber)");
    const q = $("question").value;
    const a = await api(`/api/scenario?q=${encodeURIComponent(q)}`);
    $("answer").innerHTML = `
      <strong>${a.symbol}</strong>: ${fmtMoney(a.invested)} invested on ${a.startDate} at ${fmtMoney(a.startPrice)}
      would be worth <strong class="${cls(a.profit)}">${fmtMoney(a.valueToday)}</strong> on ${a.endDate}.
      Profit: <strong class="${cls(a.profit)}">${fmtMoney(a.profit)}</strong>
      Return: <strong class="${cls(a.returnPct)}">${fmtPct(a.returnPct)}</strong>.
    `;
    saveScenario(a);
    setStatus(navigator.onLine ? "Scenario ready" : "Offline mode: using saved scenario", navigator.onLine ? "var(--green)" : "var(--amber)");
  } catch (error) {
    setStatus("Scenario error", "var(--red)");
    $("answer").innerHTML = `<span class="err">${error.message}</span>`;
  }
}

async function init() {
  registerServiceWorker();
  setupInstallPrompt();
  window.addEventListener("online", () => setStatus("Back online"));
  window.addEventListener("offline", () => setStatus("Offline mode: saved data available", "var(--amber)"));
  const body = await api("/api/universe");
  state.universe = body.universe;
  state.featuredUniverse = body.featuredUniverse || [];
  $("provider").textContent = `Universe: ${body.source} | ${body.count} symbols`;
  populateSectors();
  $("run").addEventListener("click", run);
  $("ask").addEventListener("click", ask);
  $("clear").addEventListener("click", () => { $("symbols").value = ""; });
  $("export").addEventListener("click", exportCsv);
  $("search").addEventListener("input", renderRows);
  $("minReturn").addEventListener("input", renderRows);
  $("groupBy").addEventListener("change", renderRows);
  $("sort").addEventListener("change", (e) => { state.sort = e.target.value; renderRows(); });
  document.querySelectorAll("th[data-sort]").forEach((th) => {
    th.addEventListener("click", () => { state.sort = th.dataset.sort; $("sort").value = state.sort; renderRows(); });
  });
  await run();
  await ask();
  renderSaved();
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

function setupInstallPrompt() {
  const banner = $("installBanner");
  const button = $("install");
  if (!banner || !button) return;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    banner.hidden = false;
  });

  button.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    banner.hidden = true;
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    banner.hidden = true;
  });
}

init().catch((error) => {
  setStatus("Startup error", "var(--red)");
  $("answer").innerHTML = `<span class="err">${error.message}</span>`;
});
