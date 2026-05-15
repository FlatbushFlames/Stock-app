import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(__dirname, "public");
const port = Number(process.env.PORT || 3187);
const cache = new Map();
const DAY = 24 * 60 * 60 * 1000;
const providerUniverseCache = { ts: 0, rows: null };
const secTickerCache = { ts: 0, map: null };
const secProfileCache = new Map();

async function loadLocalEnv() {
  try {
    const text = await readFile(join(__dirname, ".env"), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...rest] = trimmed.split("=");
      if (!process.env[key]) process.env[key] = rest.join("=").trim();
    }
  } catch {
    return;
  }
}

const universe = [
  ["AAPL", "Information Technology", "Technology Hardware", "Consumer Electronics"],
  ["MSFT", "Information Technology", "Software", "Infrastructure Software"],
  ["NVDA", "Information Technology", "Semiconductors", "GPUs and AI Chips"],
  ["AMD", "Information Technology", "Semiconductors", "CPUs and GPUs"],
  ["AVGO", "Information Technology", "Semiconductors", "Connectivity Chips"],
  ["ADBE", "Information Technology", "Software", "Creative Software"],
  ["CRM", "Information Technology", "Software", "Enterprise SaaS"],
  ["ORCL", "Information Technology", "Software", "Database Software"],
  ["NOW", "Information Technology", "Software", "Workflow SaaS"],
  ["PANW", "Information Technology", "Cybersecurity", "Network Security"],
  ["CRWD", "Information Technology", "Cybersecurity", "Endpoint Security"],
  ["GOOGL", "Communication Services", "Interactive Media", "Search and Ads"],
  ["META", "Communication Services", "Interactive Media", "Social Platforms"],
  ["NFLX", "Communication Services", "Entertainment", "Streaming"],
  ["DIS", "Communication Services", "Entertainment", "Media and Parks"],
  ["TMUS", "Communication Services", "Telecom", "Wireless"],
  ["VZ", "Communication Services", "Telecom", "Wireless"],
  ["AMZN", "Consumer Discretionary", "Broadline Retail", "E-Commerce"],
  ["TSLA", "Consumer Discretionary", "Automobiles", "Electric Vehicles"],
  ["HD", "Consumer Discretionary", "Specialty Retail", "Home Improvement"],
  ["LOW", "Consumer Discretionary", "Specialty Retail", "Home Improvement"],
  ["NKE", "Consumer Discretionary", "Apparel", "Footwear"],
  ["SBUX", "Consumer Discretionary", "Restaurants", "Coffee"],
  ["MCD", "Consumer Discretionary", "Restaurants", "Quick Service"],
  ["BKNG", "Consumer Discretionary", "Travel", "Online Travel"],
  ["TJX", "Consumer Discretionary", "Retail", "Off-Price"],
  ["WMT", "Consumer Staples", "Consumer Staples Retail", "Mass Merchant"],
  ["COST", "Consumer Staples", "Consumer Staples Retail", "Warehouse Club"],
  ["PG", "Consumer Staples", "Household Products", "Personal Care"],
  ["KO", "Consumer Staples", "Beverages", "Soft Drinks"],
  ["PEP", "Consumer Staples", "Beverages", "Snacks and Drinks"],
  ["PM", "Consumer Staples", "Tobacco", "International Tobacco"],
  ["MO", "Consumer Staples", "Tobacco", "US Tobacco"],
  ["CL", "Consumer Staples", "Household Products", "Oral Care"],
  ["XOM", "Energy", "Oil Gas and Consumable Fuels", "Integrated Oil"],
  ["CVX", "Energy", "Oil Gas and Consumable Fuels", "Integrated Oil"],
  ["COP", "Energy", "Oil Gas Exploration", "Exploration and Production"],
  ["SLB", "Energy", "Energy Equipment", "Oilfield Services"],
  ["EOG", "Energy", "Oil Gas Exploration", "Shale Producer"],
  ["JPM", "Financials", "Banks", "Diversified Bank"],
  ["BAC", "Financials", "Banks", "Money Center Bank"],
  ["WFC", "Financials", "Banks", "Money Center Bank"],
  ["GS", "Financials", "Capital Markets", "Investment Banking"],
  ["MS", "Financials", "Capital Markets", "Investment Banking"],
  ["V", "Financials", "Financial Services", "Payment Network"],
  ["MA", "Financials", "Financial Services", "Payment Network"],
  ["AXP", "Financials", "Consumer Finance", "Card Issuer"],
  ["BRK-B", "Financials", "Insurance", "Conglomerate"],
  ["UNH", "Health Care", "Managed Health Care", "Health Insurance"],
  ["LLY", "Health Care", "Pharmaceuticals", "Diabetes and Obesity"],
  ["JNJ", "Health Care", "Pharmaceuticals", "Diversified Health"],
  ["ABBV", "Health Care", "Biotechnology", "Immunology"],
  ["MRK", "Health Care", "Pharmaceuticals", "Oncology"],
  ["PFE", "Health Care", "Pharmaceuticals", "Vaccines and Drugs"],
  ["TMO", "Health Care", "Life Sciences", "Lab Instruments"],
  ["ABT", "Health Care", "Health Care Equipment", "Diagnostics"],
  ["CAT", "Industrials", "Machinery", "Construction Equipment"],
  ["DE", "Industrials", "Machinery", "Agricultural Equipment"],
  ["GE", "Industrials", "Aerospace", "Aerospace Systems"],
  ["BA", "Industrials", "Aerospace", "Commercial Aircraft"],
  ["HON", "Industrials", "Industrial Conglomerates", "Automation"],
  ["UPS", "Industrials", "Air Freight", "Logistics"],
  ["RTX", "Industrials", "Aerospace and Defense", "Defense Systems"],
  ["LMT", "Industrials", "Aerospace and Defense", "Defense Prime"],
  ["LIN", "Materials", "Chemicals", "Industrial Gases"],
  ["SHW", "Materials", "Chemicals", "Paints"],
  ["FCX", "Materials", "Metals and Mining", "Copper"],
  ["NEM", "Materials", "Metals and Mining", "Gold"],
  ["APD", "Materials", "Chemicals", "Industrial Gases"],
  ["PLD", "Real Estate", "Industrial REITs", "Logistics Real Estate"],
  ["AMT", "Real Estate", "Telecom Tower REITs", "Cell Towers"],
  ["EQIX", "Real Estate", "Data Center REITs", "Data Centers"],
  ["SPG", "Real Estate", "Retail REITs", "Malls"],
  ["NEE", "Utilities", "Electric Utilities", "Renewables Utility"],
  ["DUK", "Utilities", "Electric Utilities", "Regulated Electric"],
  ["SO", "Utilities", "Electric Utilities", "Regulated Electric"],
  ["EXC", "Utilities", "Multi-Utilities", "Transmission"],
  ["TXN", "Information Technology", "Semiconductors", "Analog Chips"],
  ["QCOM", "Information Technology", "Semiconductors", "Mobile Chips"],
  ["INTC", "Information Technology", "Semiconductors", "CPUs"],
  ["MU", "Information Technology", "Semiconductors", "Memory"],
  ["AMAT", "Information Technology", "Semiconductor Equipment", "Wafer Equipment"],
  ["LRCX", "Information Technology", "Semiconductor Equipment", "Etch Equipment"],
  ["KLAC", "Information Technology", "Semiconductor Equipment", "Process Control"],
  ["INTU", "Information Technology", "Software", "Financial Software"],
  ["SNOW", "Information Technology", "Software", "Cloud Data"],
  ["DDOG", "Information Technology", "Software", "Observability"],
  ["SHOP", "Information Technology", "Software", "Commerce Software"],
  ["UBER", "Industrials", "Ground Transportation", "Mobility Platform"],
  ["FDX", "Industrials", "Air Freight", "Logistics"],
  ["UNP", "Industrials", "Rail Transportation", "Railroad"],
  ["CSX", "Industrials", "Rail Transportation", "Railroad"],
  ["ETN", "Industrials", "Electrical Equipment", "Power Management"],
  ["EMR", "Industrials", "Electrical Equipment", "Automation"],
  ["PH", "Industrials", "Machinery", "Motion Control"],
  ["MMM", "Industrials", "Industrial Conglomerates", "Diversified Industrials"],
  ["TGT", "Consumer Discretionary", "Retail", "Big Box Retail"],
  ["ROST", "Consumer Discretionary", "Retail", "Off-Price"],
  ["ORLY", "Consumer Discretionary", "Specialty Retail", "Auto Parts"],
  ["AZO", "Consumer Discretionary", "Specialty Retail", "Auto Parts"],
  ["CMG", "Consumer Discretionary", "Restaurants", "Fast Casual"],
  ["YUM", "Consumer Discretionary", "Restaurants", "Quick Service"],
  ["F", "Consumer Discretionary", "Automobiles", "Legacy Auto"],
  ["GM", "Consumer Discretionary", "Automobiles", "Legacy Auto"],
  ["EL", "Consumer Staples", "Personal Products", "Beauty"],
  ["MDLZ", "Consumer Staples", "Food Products", "Snacks"],
  ["KHC", "Consumer Staples", "Food Products", "Packaged Food"],
  ["GIS", "Consumer Staples", "Food Products", "Packaged Food"],
  ["KR", "Consumer Staples", "Consumer Staples Retail", "Grocer"],
  ["TAP", "Consumer Staples", "Beverages", "Alcoholic Beverages"],
  ["OXY", "Energy", "Oil Gas Exploration", "Exploration and Production"],
  ["MPC", "Energy", "Oil Gas Refining", "Refining"],
  ["VLO", "Energy", "Oil Gas Refining", "Refining"],
  ["PSX", "Energy", "Oil Gas Refining", "Refining"],
  ["HAL", "Energy", "Energy Equipment", "Oilfield Services"],
  ["KMI", "Energy", "Oil Gas Storage", "Pipelines"],
  ["SCHW", "Financials", "Capital Markets", "Brokerage"],
  ["BLK", "Financials", "Capital Markets", "Asset Management"],
  ["C", "Financials", "Banks", "Money Center Bank"],
  ["USB", "Financials", "Banks", "Regional Bank"],
  ["PNC", "Financials", "Banks", "Regional Bank"],
  ["COF", "Financials", "Consumer Finance", "Card Issuer"],
  ["CB", "Financials", "Insurance", "Property Casualty"],
  ["AIG", "Financials", "Insurance", "Multi-line Insurance"],
  ["HUM", "Health Care", "Managed Health Care", "Health Insurance"],
  ["CI", "Health Care", "Managed Health Care", "Health Services"],
  ["ISRG", "Health Care", "Health Care Equipment", "Robotic Surgery"],
  ["SYK", "Health Care", "Health Care Equipment", "Orthopedics"],
  ["MDT", "Health Care", "Health Care Equipment", "Medical Devices"],
  ["DHR", "Health Care", "Life Sciences", "Diagnostics"],
  ["REGN", "Health Care", "Biotechnology", "Specialty Biotech"],
  ["VRTX", "Health Care", "Biotechnology", "Rare Disease"],
  ["BMY", "Health Care", "Pharmaceuticals", "Oncology"],
  ["GILD", "Health Care", "Biotechnology", "Antivirals"],
  ["ECL", "Materials", "Chemicals", "Water Treatment"],
  ["DD", "Materials", "Chemicals", "Specialty Chemicals"],
  ["DOW", "Materials", "Chemicals", "Commodity Chemicals"],
  ["NUE", "Materials", "Metals and Mining", "Steel"],
  ["STLD", "Materials", "Metals and Mining", "Steel"],
  ["SCCO", "Materials", "Metals and Mining", "Copper"],
  ["O", "Real Estate", "Retail REITs", "Net Lease"],
  ["PSA", "Real Estate", "Specialized REITs", "Self Storage"],
  ["DLR", "Real Estate", "Data Center REITs", "Data Centers"],
  ["CCI", "Real Estate", "Telecom Tower REITs", "Cell Towers"],
  ["WELL", "Real Estate", "Health Care REITs", "Senior Housing"],
  ["AEP", "Utilities", "Electric Utilities", "Regulated Electric"],
  ["SRE", "Utilities", "Multi-Utilities", "Gas and Electric"],
  ["D", "Utilities", "Multi-Utilities", "Gas and Electric"],
  ["XEL", "Utilities", "Electric Utilities", "Regulated Electric"],
  ["CEG", "Utilities", "Electric Utilities", "Nuclear Power"],
  ["SPY", "ETF", "Broad Market", "S&P 500 ETF"],
  ["QQQ", "ETF", "Growth Index", "Nasdaq 100 ETF"],
  ["DIA", "ETF", "Blue Chip Index", "Dow ETF"],
  ["IWM", "ETF", "Small Cap Index", "Russell 2000 ETF"]
].map(([symbol, sector, industry, subIndustry]) => ({ symbol, sector, industry, subIndustry }));

function send(res, status, body, type = "application/json") {
  const data = type === "application/json" ? JSON.stringify(body) : body;
  res.writeHead(status, {
    "content-type": type,
    "cache-control": "no-store",
    "access-control-allow-origin": "*"
  });
  res.end(data);
}

function parseUrl(req) {
  return new URL(req.url, `http://${req.headers.host}`);
}

function normalizeSymbol(symbol) {
  return String(symbol || "").trim().toUpperCase().replace(".", "-");
}

function providerKey() {
  return String(process.env.FMP_API_KEY || "").trim();
}

async function fmpUniverse() {
  const key = providerKey();
  if (!key) return null;
  if (providerUniverseCache.rows && Date.now() - providerUniverseCache.ts < 6 * 60 * 60 * 1000) {
    return providerUniverseCache.rows;
  }
  const url = `https://financialmodelingprep.com/stable/company-screener?marketCapMoreThan=1000000000&isEtf=false&isFund=false&limit=5000&apikey=${encodeURIComponent(key)}`;
  const response = await fetch(url, { headers: { "user-agent": "stock-return-lab/1.0" } });
  if (!response.ok) throw new Error(`FMP ${response.status}`);
  const json = await response.json();
  const rows = Array.isArray(json)
    ? json.map((item) => ({
        symbol: normalizeSymbol(item.symbol),
        companyName: item.companyName || item.name || "",
        sector: item.sector || "Unknown",
        industry: item.industry || "Unknown",
        subIndustry: item.industry || "Unknown",
        marketCap: Number(item.marketCap || 0),
        source: "FMP"
      })).filter((item) => item.symbol && item.sector !== "Unknown")
    : [];
  providerUniverseCache.ts = Date.now();
  providerUniverseCache.rows = rows;
  return rows;
}

async function activeUniverse() {
  try {
    const fmp = await fmpUniverse();
    if (fmp?.length) return fmp;
  } catch {
    // Try the free broad-universe source next.
  }
  try {
    const nasdaq = await nasdaqUniverse();
    if (nasdaq?.length) return nasdaq;
  } catch {
    // Fall back to the bundled curated universe.
  }
  return universe;
}

function parsePipeTable(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines.shift().split("|");
  return lines
    .filter((line) => line && !line.startsWith("File Creation Time"))
    .map((line) => Object.fromEntries(line.split("|").map((value, i) => [headers[i], value])));
}

async function nasdaqUniverse() {
  const key = "nasdaq-universe";
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < 6 * 60 * 60 * 1000) return hit.data;
  const [nasdaqResp, otherResp] = await Promise.all([
    fetch("https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt"),
    fetch("https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt")
  ]);
  if (!nasdaqResp.ok || !otherResp.ok) return null;
  const [nasdaqText, otherText] = await Promise.all([nasdaqResp.text(), otherResp.text()]);
  const nasdaqRows = parsePipeTable(nasdaqText)
    .filter((r) => r["Test Issue"] === "N" && r.ETF === "N")
    .map((r) => ({
      symbol: normalizeSymbol(r.Symbol),
      companyName: r["Security Name"] || "",
      exchange: "NASDAQ",
      sector: "Unknown",
      industry: "Unknown",
      subIndustry: "Unknown",
      source: "NASDAQ_TRADER"
    }));
  const otherRows = parsePipeTable(otherText)
    .filter((r) => r["Test Issue"] === "N" && r.ETF === "N")
    .map((r) => ({
      symbol: normalizeSymbol(r["ACT Symbol"]),
      companyName: r["Security Name"] || "",
      exchange: r.Exchange || "OTHER",
      sector: "Unknown",
      industry: "Unknown",
      subIndustry: "Unknown",
      source: "NASDAQ_TRADER"
    }));
  const rows = [...nasdaqRows, ...otherRows].filter((r) => /^[A-Z][A-Z0-9-]{0,7}$/.test(r.symbol));
  cache.set(key, { ts: Date.now(), data: rows });
  return rows;
}

function sicToSector(sic) {
  const value = Number(sic || 0);
  if (value >= 100 && value <= 999) return "Agriculture";
  if (value >= 1000 && value <= 1499) return "Materials";
  if (value >= 1500 && value <= 1799) return "Industrials";
  if (value >= 2000 && value <= 3999) return "Manufacturing";
  if (value >= 4000 && value <= 4999) return "Transportation and Utilities";
  if (value >= 5000 && value <= 5999) return "Consumer";
  if (value >= 6000 && value <= 6799) return "Financials";
  if (value >= 7000 && value <= 8999) return "Services";
  if (value >= 9000 && value <= 9999) return "Public Administration";
  return "Unknown";
}

async function secTickerMap() {
  if (secTickerCache.map && Date.now() - secTickerCache.ts < 24 * 60 * 60 * 1000) return secTickerCache.map;
  const response = await fetch("https://www.sec.gov/files/company_tickers_exchange.json", {
    headers: { "user-agent": "Stock Return Lab contact@example.com" }
  });
  if (!response.ok) return new Map();
  const json = await response.json();
  const fields = json.fields || [];
  const tickerIndex = fields.indexOf("ticker");
  const cikIndex = fields.indexOf("cik");
  const titleIndex = fields.indexOf("name");
  const map = new Map(
    (json.data || []).map((row) => [
      normalizeSymbol(row[tickerIndex]),
      { cik: String(row[cikIndex]).padStart(10, "0"), companyName: row[titleIndex] || "" }
    ])
  );
  secTickerCache.ts = Date.now();
  secTickerCache.map = map;
  return map;
}

async function secProfile(symbol) {
  const clean = normalizeSymbol(symbol);
  const hit = secProfileCache.get(clean);
  if (hit && Date.now() - hit.ts < 24 * 60 * 60 * 1000) return hit.data;
  const tickers = await secTickerMap();
  const ref = tickers.get(clean);
  if (!ref) return null;
  const response = await fetch(`https://data.sec.gov/submissions/CIK${ref.cik}.json`, {
    headers: { "user-agent": "Stock Return Lab contact@example.com" }
  });
  if (!response.ok) return null;
  const json = await response.json();
  const sic = json.sic || null;
  const sicDescription = json.sicDescription || "Unknown";
  const data = {
    companyName: json.name || ref.companyName,
    sector: sicToSector(sic),
    industry: sicDescription,
    subIndustry: sicDescription,
    sic,
    source: "SEC"
  };
  secProfileCache.set(clean, { ts: Date.now(), data });
  return data;
}

async function enrichMeta(symbol, baseMeta) {
  if (baseMeta && baseMeta.sector && baseMeta.sector !== "Unknown") return baseMeta;
  const profile = await secProfile(symbol);
  return { ...(baseMeta || { symbol }), ...(profile || {}) };
}

async function yahooHistory(symbol, years = 21) {
  const clean = normalizeSymbol(symbol);
  if (!clean) throw new Error("Missing symbol");
  const key = `${clean}:${years}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < 15 * 60 * 1000) return hit.data;

  const period2 = Math.floor(Date.now() / 1000);
  const period1 = Math.floor((Date.now() - years * 365.25 * DAY) / 1000);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(clean)}?period1=${period1}&period2=${period2}&interval=1d&events=history&includeAdjustedClose=true`;
  const response = await fetch(url, { headers: { "user-agent": "stock-return-lab/1.0" } });
  if (!response.ok) throw new Error(`Yahoo ${response.status}`);
  const json = await response.json();
  const result = json?.chart?.result?.[0];
  if (!result?.timestamp?.length) throw new Error(`No price history for ${clean}`);

  const quote = result.indicators?.quote?.[0] || {};
  const adj = result.indicators?.adjclose?.[0]?.adjclose || quote.close || [];
  const rows = result.timestamp.map((ts, i) => ({
    date: new Date(ts * 1000).toISOString().slice(0, 10),
    ts: ts * 1000,
    close: Number(adj[i] ?? quote.close?.[i])
  })).filter((row) => Number.isFinite(row.close) && row.close > 0);

  const meta = {
    symbol: clean,
    currency: result.meta?.currency || "USD",
    exchange: result.meta?.exchangeName || "",
    regularMarketPrice: result.meta?.regularMarketPrice || rows.at(-1)?.close || null
  };
  const data = { meta, rows };
  cache.set(key, { ts: Date.now(), data });
  return data;
}

function pct(start, end) {
  if (!start || !end) return null;
  return ((end / start) - 1) * 100;
}

function nearestAtOrAfter(rows, targetTs) {
  return rows.find((row) => row.ts >= targetTs) || rows[0] || null;
}

function nearestAtOrBefore(rows, targetTs) {
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].ts <= targetTs) return rows[i];
  }
  return rows[0] || null;
}

function returnsForPeriod(rows, startTs, endTs) {
  const window = rows.filter((row) => row.ts >= startTs && row.ts <= endTs);
  if (window.length < 2) return null;
  const start = window[0].close;
  const end = window.at(-1).close;
  const daily = [];
  for (let i = 1; i < window.length; i++) daily.push((window[i].close / window[i - 1].close - 1) * 100);
  const weekly = [];
  for (let i = 5; i < window.length; i += 5) weekly.push((window[i].close / window[i - 5].close - 1) * 100);
  const monthly = [];
  for (let i = 21; i < window.length; i += 21) monthly.push((window[i].close / window[i - 21].close - 1) * 100);
  const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  return {
    startDate: window[0].date,
    endDate: window.at(-1).date,
    startPrice: start,
    endPrice: end,
    totalReturnPct: pct(start, end),
    annualizedReturnPct: (Math.pow(end / start, 252 / Math.max(1, window.length)) - 1) * 100,
    averageDailyReturnPct: avg(daily),
    averageWeeklyReturnPct: avg(weekly),
    averageMonthlyReturnPct: avg(monthly)
  };
}

function analyzeRows(rows) {
  const now = Date.now();
  const windows = [0, 5, 10, 15].map((startYears) => {
    const endYears = startYears + 5;
    const endTs = now - startYears * 365.25 * DAY;
    const startTs = now - endYears * 365.25 * DAY;
    return {
      label: startYears === 0 ? "Last 5 Years" : `${endYears}-${startYears} Years Ago`,
      ...returnsForPeriod(rows, startTs, endTs)
    };
  }).filter((item) => item.totalReturnPct != null);
  const full = returnsForPeriod(rows, now - 20 * 365.25 * DAY, now);
  return { windows, full };
}

async function screener(url) {
  const limit = Math.max(1, Math.min(120, Number(url.searchParams.get("limit") || 80)));
  const symbolsParam = url.searchParams.get("symbols");
  const availableUniverse = await activeUniverse();
  const selected = symbolsParam
    ? symbolsParam.split(",").map(normalizeSymbol).filter(Boolean)
    : availableUniverse.slice(0, limit).map((item) => item.symbol);
  const metaBySymbol = new Map([...universe, ...availableUniverse].map((item) => [item.symbol, item]));
  const output = [];
  const queue = [...selected];
  const workers = Array.from({ length: 8 }, async () => {
    while (queue.length) {
      const symbol = queue.shift();
      try {
        const history = await yahooHistory(symbol, 21);
        const analysis = analyzeRows(history.rows);
        const meta = await enrichMeta(symbol, metaBySymbol.get(symbol));
        output.push({
          ...(meta || { symbol, sector: "Custom", industry: "Custom", subIndustry: "Custom" }),
          price: history.meta.regularMarketPrice,
          currency: history.meta.currency,
          ...analysis
        });
      } catch (error) {
        output.push({
          ...(metaBySymbol.get(symbol) || { symbol, sector: "Custom", industry: "Custom", subIndustry: "Custom" }),
          error: String(error.message || error)
        });
      }
    }
  });
  await Promise.all(workers);
  return output;
}

async function scenario(url) {
  const query = url.searchParams.get("q") || "";
  const amount = Number((query.match(/\$?\s*([0-9]+(?:\.[0-9]+)?)/) || [])[1] || url.searchParams.get("amount") || 0);
  const year = Number((query.match(/\b(19|20)\d{2}\b/) || [])[0] || url.searchParams.get("year") || new Date().getFullYear());
  const upperQuery = query.toUpperCase();
  const stockPhrase = upperQuery.match(/\bIN\s+([A-Z]{1,5}(?:-[A-Z])?)\s+(?:STOCK|SHARES?)\b/);
  const ignored = new Set(["A", "I", "IF", "IN", "HOW", "MUCH", "MADE", "MAKE", "RETURN", "TODAY", "STOCK", "SHARE", "SHARES"]);
  const candidates = (upperQuery.match(/\b[A-Z]{1,5}(?:-[A-Z])?\b/g) || []).filter((x) => !ignored.has(x));
  const symbol = normalizeSymbol(url.searchParams.get("symbol") || stockPhrase?.[1] || candidates[0]);
  if (!amount || !symbol || !year) throw new Error("Try: If I invested $20 in AAPL stock in 2021, how much today?");
  const history = await yahooHistory(symbol, Math.max(2, new Date().getFullYear() - year + 2));
  const start = nearestAtOrAfter(history.rows, Date.UTC(year, 0, 1));
  const end = history.rows.at(-1);
  if (!start || !end) throw new Error(`Not enough history for ${symbol}`);
  const shares = amount / start.close;
  const valueToday = shares * end.close;
  return {
    query,
    symbol,
    invested: amount,
    startDate: start.date,
    startPrice: start.close,
    endDate: end.date,
    endPrice: end.close,
    shares,
    valueToday,
    profit: valueToday - amount,
    returnPct: pct(start.close, end.close)
  };
}

async function route(req, res) {
  try {
    const url = parseUrl(req);
    if (url.pathname === "/api/universe") {
      const active = await activeUniverse();
      return send(res, 200, {
        universe: active,
        featuredUniverse: universe,
        source: active === universe ? "CURATED" : (providerKey() && active === providerUniverseCache.rows ? "FMP" : "NASDAQ_TRADER"),
        providerConfigured: Boolean(providerKey()),
        count: active.length
      });
    }
    if (url.pathname === "/api/provider-status") {
      const active = await activeUniverse();
      return send(res, 200, {
        provider: providerKey() ? "FMP" : "NASDAQ_TRADER+SEC",
        configured: Boolean(providerKey()),
        activeSource: active === universe ? "CURATED" : (providerKey() && active === providerUniverseCache.rows ? "FMP" : "NASDAQ_TRADER"),
        count: active.length
      });
    }
    if (url.pathname === "/api/history") {
      const symbol = normalizeSymbol(url.searchParams.get("symbol"));
      const history = await yahooHistory(symbol, 21);
      return send(res, 200, { ...history, analysis: analyzeRows(history.rows) });
    }
    if (url.pathname === "/api/screener") return send(res, 200, { rows: await screener(url), updatedAt: new Date().toISOString() });
    if (url.pathname === "/api/scenario") return send(res, 200, await scenario(url));

    const file = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    const path = join(publicDir, file);
    const types = {
      ".html": "text/html",
      ".css": "text/css",
      ".js": "text/javascript",
      ".webmanifest": "application/manifest+json",
      ".svg": "image/svg+xml"
    };
    const body = await readFile(path, "utf8");
    return send(res, 200, body, types[extname(path)] || "text/plain");
  } catch (error) {
    return send(res, 500, { error: String(error.message || error) });
  }
}

await loadLocalEnv();

http.createServer(route).listen(port, "0.0.0.0", () => {
  console.log(`Stock Return Lab running at http://0.0.0.0:${port}`);
});
