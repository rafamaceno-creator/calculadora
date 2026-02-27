/* =========================
   Precificação Marketplaces
   main.js (FULL - COM PDF EXPORT)
   ========================= */

/* ===== Constants ===== */

const SHOPEE_FAIXAS = [
  { min: 0, max: 79.99, pct: 0.20, fixed: 4.00, label: "Até R$79,99" },
  { min: 80, max: 99.99, pct: 0.14, fixed: 16.00, label: "R$80 a R$99,99" },
  { min: 100, max: 199.99, pct: 0.14, fixed: 20.00, label: "R$100 a R$199,99" },
  { min: 200, max: 499.99, pct: 0.14, fixed: 40.00, label: "R$200 a R$499,99" },
  { min: 500, max: Infinity, pct: 0.14, fixed: 80.00, label: "R$500+" }
];

const TIKTOK = { pct: 0.12, fixed: 4.00 };

const DEFAULT_CFG = {};
const cfg = {
  ...DEFAULT_CFG,
  ...(window.cfg || window.CFG || window.CONFIG || window.__APP_CONFIG || {})
};

if (window.location.hostname !== "localhost" && typeof window.WebSocket === "function") {
  const NativeWebSocket = window.WebSocket;
  window.WebSocket = function SafeWebSocket(url, protocols) {
    const target = String(url || "");
    if (target.includes("ws://localhost:8081")) {
      console.info("[dev-ws] Conexão ws://localhost:8081 bloqueada fora de localhost.");
      return {
        readyState: 3,
        close() {},
        send() {},
        addEventListener() {},
        removeEventListener() {}
      };
    }
    return protocols === undefined ? new NativeWebSocket(url) : new NativeWebSocket(url, protocols);
  };
  window.WebSocket.prototype = NativeWebSocket.prototype;
}


const INPUT_EVENT_FIELDS = {
  cost: "cost",
  tax: "tax",
  profitValue: "profit_value",
  samePriceInput: "price",
  currentPriceInput: "price",
  scaleSalesQty: "sales_qty"
};

const THEME_KEY = "pricing_theme";
const SAVED_SIMULATIONS_KEY = "saved_simulations_v2";
const COMPOSITION_VIEW_KEY = "composition_view_tracked";
const CURRENT_SAME_PRICE_KEY = "CURRENT_SAME_PRICE";
const CURRENT_PRICE_GLOBAL_KEY = "CURRENT_PRICE_GLOBAL";
const CURRENT_PRICE_BY_MKT_KEY = "CURRENT_PRICE_BY_MKT";
const LEAD_CAPTURE_SESSION_KEY = "lead_capture_dismissed";
const LEAD_CAPTURE_BLOCK_ID = "leadCaptureBlock";


const CURRENT_PRICE_MARKETPLACE_INPUTS = {
  shopee: "currentPriceShopee",
  mlClassic: "currentPriceMlClassic",
  mlPremium: "currentPriceMlPremium",
  tiktok: "currentPriceTiktok",
  shein: "currentPriceShein",
  amazon: "currentPriceAmazon"
};


function track(eventName, params = {}) {
  try {
    if (typeof window.gtag === "function") window.gtag("event", eventName, params);
  } catch (error) {
    console.warn("GA4 bloqueado", error);
  }
}

function trackGA4Event(eventName, params = {}) {
  track(eventName, params);
}

function setUserProperty(name, value) {
  if (typeof window.gtag === "function") {
    window.gtag("set", "user_properties", {
      [name]: value
    });
  }
}

let __engaged = false;

function trackEngaged() {
  if (__engaged) return;
  __engaged = true;
  track("user_engaged");
}

function ticketFaixa(v) {
  const n = Number(v) || 0;
  if (n <= 79.99) return "0-79";
  if (n <= 99.99) return "80-99";
  if (n <= 199.99) return "100-199";
  if (n <= 499.99) return "200-499";
  return "500+";
}

let __lastFaixa = null;

function trackPerfilTicket(precoSugerido) {
  const faixa = ticketFaixa(precoSugerido);
  if (faixa === __lastFaixa) return;
  __lastFaixa = faixa;

  track("profile_ticket", {
    faixa: faixa,
    preco_sugerido: Number(precoSugerido) || 0
  });

  setUserProperty("perfil_ticket", faixa);
}

function getDeviceType() {
  return window.matchMedia("(max-width: 768px)").matches ? "mobile" : "desktop";
}

function logActionError(message, error) {
  console.error(`[actions] ${message}`, error || "");
}

function scrollToWithTopbarOffset(target) {
  if (!target) return;
  const topbar = document.querySelector(".topbar");
  const offset = (topbar ? topbar.offsetHeight : 0) + 12;
  const y = target.getBoundingClientRect().top + window.pageYOffset - offset;
  window.scrollTo({ top: y, behavior: "smooth" });
}

/* ===== SHEIN =====
   Comissão:
   - Vestuário feminino: 20%
   - Demais categorias: 18%
   Taxa fixa (Intermediação de frete) por peso (kg)
   (Preço descontado)
*/
const SHEIN = {
  pctFemale: 0.20,
  pctOther: 0.18,
  weightFixedTable: [
    { max: 0.3, fixed: 4 },
    { max: 0.6, fixed: 5 },
    { max: 0.9, fixed: 6 },
    { max: 1.2, fixed: 8 },
    { max: 1.5, fixed: 10 },
    { max: 2.0, fixed: 12 },
    { max: 5.0, fixed: 15 },
    { max: 9.0, fixed: 32 },
    { max: 13.0, fixed: 63 },
    { max: 17.0, fixed: 73 },
    { max: 23.0, fixed: 89 },
    { max: 30.0, fixed: 106 }
  ]
};


const AMAZON_DBA = {
  below_79: [
    { min: 0, max: 30, fee: 4.5, key: "0_30" },
    { min: 30.01, max: 49.99, fee: 6.5, key: "30_49" },
    { min: 50, max: 78.99, fee: 6.75, key: "50_78" }
  ],
  weightBands: [
    { key: "0_250", maxKg: 0.25, label: "0–250g" },
    { key: "250_500", maxKg: 0.5, label: "250–500g" },
    { key: "500_1", maxKg: 1, label: "500g–1kg" },
    { key: "1_2", maxKg: 2, label: "1–2kg" },
    { key: "2_3", maxKg: 3, label: "2–3kg" },
    { key: "3_4", maxKg: 4, label: "3–4kg" },
    { key: "4_5", maxKg: 5, label: "4–5kg" },
    { key: "5_9", maxKg: 9, label: "5–9kg" },
    { key: "9_13", maxKg: 13, label: "9–13kg" },
    { key: "13_17", maxKg: 17, label: "13–17kg" },
    { key: "17_22", maxKg: 22, label: "17–22kg" }
  ],
  subPriceBands79_199: [
    { key: "79_99", min: 79, max: 99.99 },
    { key: "100_119", min: 100, max: 119.99 },
    { key: "120_149", min: 120, max: 149.99 },
    { key: "150_199", min: 150, max: 199.99 }
  ],
  from_79_to_199: {
    // TODO completar conforme tabela oficial DBA completa.
    "79_99": { "0_250": 9.5, "250_500": 10.5, "500_1": 12, "1_2": 14, "2_3": 16, "3_4": 18, "4_5": 20, "5_9": 26, "9_13": 36, "13_17": 46, "17_22": 56 },
    "100_119": { "0_250": 10, "250_500": 11, "500_1": 12.5, "1_2": 14.5, "2_3": 16.5, "3_4": 18.5, "4_5": 20.5, "5_9": 26.5, "9_13": 36.5, "13_17": 46.5, "17_22": 56.5 },
    "120_149": { "0_250": 11, "250_500": 12, "500_1": 13.5, "1_2": 15.5, "2_3": 17.5, "3_4": 19.5, "4_5": 21.5, "5_9": 27.5, "9_13": 37.5, "13_17": 47.5, "17_22": 57.5 },
    "150_199": { "0_250": 12, "250_500": 13, "500_1": 14.5, "1_2": 16.5, "2_3": 18.5, "3_4": 20.5, "4_5": 22.5, "5_9": 28.5, "9_13": 38.5, "13_17": 48.5, "17_22": 58.5 }
  },
  above_200: {
    // TODO completar conforme tabela oficial DBA completa por origem.
    sp_capital: { "0_250": 15, "250_500": 16, "500_1": 18, "1_2": 21, "2_3": 24, "3_4": 27, "4_5": 30, "5_9": 38, "9_13": 48, "13_17": 58, "17_22": 68 },
    sul_sudeste_capitais: { "0_250": 16, "250_500": 17, "500_1": 19, "1_2": 22, "2_3": 25, "3_4": 28, "4_5": 31, "5_9": 39, "9_13": 49, "13_17": 59, "17_22": 69 },
    sul_sudeste_interior: { "0_250": 17, "250_500": 18, "500_1": 20, "1_2": 23, "2_3": 26, "3_4": 29, "4_5": 32, "5_9": 40, "9_13": 50, "13_17": 60, "17_22": 70 },
    co_ne_no: { "0_250": 18, "250_500": 19, "500_1": 21, "1_2": 24, "2_3": 27, "3_4": 30, "4_5": 33, "5_9": 41, "9_13": 51, "13_17": 61, "17_22": 71 }
  }
};

/* ===== Helpers ===== */

function toNumber(v) {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function sanitizeBRLInput(rawValue) {
  const raw = String(rawValue ?? "").replace(/R\$/gi, "").replace(/\s+/g, "").trim();
  const onlyNumbers = raw.replace(/[^\d,.-]/g, "");
  if (!onlyNumbers) return "";
  if (onlyNumbers.includes(",")) {
    return onlyNumbers.replace(/\./g, "").replace(",", ".");
  }
  return onlyNumbers;
}

function parsePriceInput(rawValue) {
  const normalized = sanitizeBRLInput(rawValue);
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function brl(n) {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function clamp(n, min, max) {
  const v = Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, v));
}

function normalizeWeightKg(value, unit) {
  const v = Math.max(0, toNumber(value));
  if (unit === "g") return v / 1000;
  return v;
}

function resolveMarketplaceWeight({ enabled, rawValue, unit }) {
  if (!enabled) {
    return { kg: 0.5, assumed: true };
  }

  const valueText = String(rawValue ?? "").trim();
  const normalizedKg = normalizeWeightKg(valueText, unit);
  if (!valueText || !Number.isFinite(normalizedKg) || normalizedKg <= 0) {
    return { kg: 0.5, assumed: true };
  }

  return { kg: normalizedKg, assumed: false };
}

function sheinFixedByWeight(weightKg) {
  const w = Math.max(0, Number(weightKg));
  for (const row of SHEIN.weightFixedTable) {
    if (w <= row.max) return row.fixed;
  }
  return SHEIN.weightFixedTable[SHEIN.weightFixedTable.length - 1].fixed;
}


function getAmazonPriceBand(price) {
  const p = Math.max(0, toNumber(price));
  if (p <= 78.99) return "below_79";
  if (p <= 199.99) return "79_199";
  return "above_200";
}

function getAmazonWeightBand(weightKg) {
  const w = clamp(toNumber(weightKg), 0, 22);
  const band = AMAZON_DBA.weightBands.find((item) => w <= item.maxKg);
  return band?.key || "17_22";
}

function getAmazonSubPriceBand(price) {
  const p = Math.max(0, toNumber(price));
  const band = AMAZON_DBA.subPriceBands79_199.find((item) => p >= item.min && p <= item.max);
  return band?.key || "79_99";
}

function amazonDbaFee({ price, weightKg, originGroup }) {
  const priceBand = getAmazonPriceBand(price);

  if (priceBand === "below_79") {
    const row = AMAZON_DBA.below_79.find((item) => price >= item.min && price <= item.max) || AMAZON_DBA.below_79[0];
    return toNumber(row?.fee);
  }

  const weightBand = getAmazonWeightBand(weightKg);

  if (priceBand === "79_199") {
    const subPriceBand = getAmazonSubPriceBand(price);
    const row = AMAZON_DBA.from_79_to_199[subPriceBand] || AMAZON_DBA.from_79_to_199["79_99"];
    return toNumber(row?.[weightBand]);
  }

  const originKey = originGroup || "sp_capital";
  const originRow = AMAZON_DBA.above_200[originKey] || AMAZON_DBA.above_200.sp_capital;
  return toNumber(originRow?.[weightBand]);
}

/* ===== Mercado Livre: tabela de custo fixo ===== */

function mlWeightBand(kg) {
  const w = Math.max(0, toNumber(kg));
  if (w <= 0.3) return "0-0.3";
  if (w <= 0.5) return "0.3-0.5";
  if (w <= 1) return "0.5-1";
  if (w <= 2) return "1-2";
  if (w <= 5) return "2-5";
  return "5+";
}

function mlPriceBand(price) {
  const p = Math.max(0, toNumber(price));
  if (p < 12.5) return "<12.5";
  if (p < 79) return "12.5-79";
  if (p < 100) return "79-100";
  if (p < 120) return "100-120";
  if (p < 150) return "120-150";
  if (p < 200) return "150-199.99";
  return "200+";
}

const ML_FIXED_TABLE = {
  "0-0.3": {
    "<12.5": 6.25, "12.5-79": 6.25, "79-100": 14.35, "100-120": 16.45,
    "120-150": 16.45, "150-199.99": 18.45, "200+": 18.45
  },
  "0.3-0.5": {
    "<12.5": 6.25, "12.5-79": 6.25, "79-100": 14.35, "100-120": 16.45,
    "120-150": 16.45, "150-199.99": 18.45, "200+": 18.45
  },
  "0.5-1": {
    "<12.5": 6.75, "12.5-79": 6.75, "79-100": 16.35, "100-120": 18.45,
    "120-150": 18.45, "150-199.99": 20.45, "200+": 20.45
  },
  "1-2": {
    "<12.5": 6.75, "12.5-79": 6.75, "79-100": 18.35, "100-120": 20.45,
    "120-150": 20.45, "150-199.99": 22.45, "200+": 22.45
  },
  "2-5": {
    "<12.5": 6.75, "12.5-79": 6.75, "79-100": 20.35, "100-120": 22.45,
    "120-150": 22.45, "150-199.99": 24.45, "200+": 24.45
  },
  "5+": {
    "<12.5": 6.75, "12.5-79": 6.75, "79-100": 24.35, "100-120": 26.45,
    "120-150": 26.45, "150-199.99": 28.45, "200+": 28.45
  }
};

function mlFixedByTable(price, weightKg) {
  const wb = mlWeightBand(weightKg);
  const pb = mlPriceBand(price);
  const row = ML_FIXED_TABLE[wb] || ML_FIXED_TABLE["0.3-0.5"];
  return toNumber(row[pb] ?? row["12.5-79"] ?? 0);
}

/* ===== Pricing solver ===== */

function solvePrice({
  cost,
  taxPct,
  profitType,
  profitValue,
  marketplacePct,
  marketplaceFixed,
  fixedCosts,
  percentCosts
}) {
  const tax = Math.max(0, taxPct) / 100;
  const profitPct = profitType === "pct" ? Math.max(0, profitValue) / 100 : 0;
  const profitFixed = profitType === "brl" ? Math.max(0, profitValue) : 0;

  const totalFixedCosts =
    (Number.isFinite(fixedCosts) ? fixedCosts : 0) +
    (Number.isFinite(marketplaceFixed) ? marketplaceFixed : 0);

  const totalPercentCosts =
    clamp((marketplacePct || 0) + tax + (percentCosts || 0) + profitPct, 0, 0.95);

  const denom = 1 - (marketplacePct || 0) - tax - (percentCosts || 0) - profitPct;
  if (denom <= 0) {
    return {
      price: 0,
      commissionValue: 0,
      received: 0,
      profitBRL: 0,
      profitPctReal: 0,
      totalPercentCosts: 0,
      totalFixedCosts
    };
  }

  const price = (Math.max(0, cost) + (Number.isFinite(fixedCosts) ? fixedCosts : 0) + (Number.isFinite(marketplaceFixed) ? marketplaceFixed : 0) + profitFixed) / denom;

  const commissionValue = price * (marketplacePct || 0) + (Number.isFinite(marketplaceFixed) ? marketplaceFixed : 0);
  const received = price - commissionValue;

  const profitBRL = profitType === "brl" ? profitFixed : price * profitPct;
  const profitPctReal = price > 0 ? profitBRL / price : 0;

  return {
    price,
    commissionValue,
    received,
    profitBRL,
    profitPctReal,
    totalPercentCosts,
    totalFixedCosts
  };
}

/* ===== Advanced vars ===== */

function getAdvancedVars() {
  const advOn = document.querySelector("#advToggle")?.checked;

  const pctFrom = (toggleSel, valueSel) => {
    const on = document.querySelector(toggleSel)?.checked;
    if (!advOn || !on) return 0;
    return Math.max(0, toNumber(document.querySelector(valueSel)?.value)) / 100;
  };

  const mixed = (toggleSel, typeSel, valueSel) => {
    const on = document.querySelector(toggleSel)?.checked;
    if (!advOn || !on) return { pct: 0, brl: 0 };

    const type = document.querySelector(typeSel)?.value || "pct";
    const v = Math.max(0, toNumber(document.querySelector(valueSel)?.value));

    if (type === "brl") return { pct: 0, brl: v };
    return { pct: v / 100, brl: 0 };
  };

  const ads = mixed("#adsToggle", "#adsType", "#adsValue");
  const ret = mixed("#returnToggle", "#returnType", "#returnValue");
  const other = mixed("#otherToggle", "#otherType", "#otherValue");
  const costFixed = mixed("#costFixedToggle", "#costFixedType", "#costFixedValue");

  const difal = pctFrom("#difalToggle", "#difalValue");
  const pis = pctFrom("#pisToggle", "#pisValue");
  const cofins = pctFrom("#cofinsToggle", "#cofinsValue");

  const affOn = document.querySelector("#affToggle")?.checked;
  const aff = {
    shopee: affOn ? Math.max(0, toNumber(document.querySelector("#affShopee")?.value)) / 100 : 0,
    ml: affOn ? Math.max(0, toNumber(document.querySelector("#affML")?.value)) / 100 : 0,
    tiktok: affOn ? Math.max(0, toNumber(document.querySelector("#affTikTok")?.value)) / 100 : 0,
    amazon: 0
  };

  const pctExtra = clamp(
    ads.pct + ret.pct + other.pct + costFixed.pct + difal + pis + cofins,
    0,
    0.95
  );

  const fixedBRL = ads.brl + ret.brl + other.brl + costFixed.brl;

  const details = {
    ads,
    ret,
    other,
    costFixed,
    difal,
    pis,
    cofins,
    aff
  };

  return { pctExtra, fixedBRL, affiliate: aff, details };
}

/* ===== Build Incidencies List ===== */

function buildIncidenciesList(taxPct, profitType, profitValue, marketplacePct, marketplaceFixed, affiliatePct, advDetails, price) {
  const groups = [];
  const add = (group, label, pct = 0, brl = 0, kind = "percent") => {
    if ((pct || 0) <= 0 && (brl || 0) <= 0) return;
    let target = groups.find((item) => item.group === group);
    if (!target) {
      target = { group, items: [] };
      groups.push(target);
    }
    target.items.push({ label, pct: pct || 0, brl: brl || 0, kind });
  };

  const tax = Math.max(0, taxPct) / 100;
  const profitPct = profitType === "pct" ? Math.max(0, profitValue) / 100 : 0;

  const commValue = Number.isFinite(price) ? price * (marketplacePct || 0) : 0;
  add("Marketplace", "Comissão", marketplacePct || 0, commValue, "percent");
  add("Marketplace", "Taxa fixa", 0, Number.isFinite(marketplaceFixed) ? marketplaceFixed : 0, "fixed");

  add("Impostos", "Imposto sobre venda", tax, Number.isFinite(price) ? price * tax : 0, "percent");
  add("Impostos", "DIFAL", advDetails.difal, Number.isFinite(price) ? price * advDetails.difal : 0, "percent");
  add("Impostos", "PIS", advDetails.pis, Number.isFinite(price) ? price * advDetails.pis : 0, "percent");
  add("Impostos", "COFINS", advDetails.cofins, Number.isFinite(price) ? price * advDetails.cofins : 0, "percent");

  add("Ads", "Tráfego pago", advDetails.ads.pct, (Number.isFinite(price) ? price * advDetails.ads.pct : 0) + advDetails.ads.brl, advDetails.ads.pct > 0 ? "percent" : "fixed");
  add("Afiliados", "Comissão de afiliado", affiliatePct, Number.isFinite(price) ? price * affiliatePct : 0, "percent");
  add("Custos fixos", "Custo fixo", advDetails.costFixed.pct, (Number.isFinite(price) ? price * advDetails.costFixed.pct : 0) + advDetails.costFixed.brl, advDetails.costFixed.pct > 0 ? "percent" : "fixed");
  add("Outros", "Devolução", advDetails.ret.pct, (Number.isFinite(price) ? price * advDetails.ret.pct : 0) + advDetails.ret.brl, advDetails.ret.pct > 0 ? "percent" : "fixed");
  add("Outros", "Outros", advDetails.other.pct, (Number.isFinite(price) ? price * advDetails.other.pct : 0) + advDetails.other.brl, advDetails.other.pct > 0 ? "percent" : "fixed");

  if (profitType === "brl") {
    const lucroValue = Math.max(0, profitValue);
    const lucroPctReal = Number.isFinite(price) && price > 0 ? (lucroValue / price) : 0;
    add("Outros", "Lucro alvo", lucroPctReal, lucroValue, "fixed");
  } else if (profitPct > 0) {
    add("Outros", "Lucro alvo", profitPct, Number.isFinite(price) ? price * profitPct : 0, "percent");
  }

  return groups;
}

function buildComposition({
  priceIdeal,
  baseCost,
  marketplacePct,
  marketplaceFixed,
  taxPct,
  advDetails,
  affiliatePct,
  profitBRL
}) {
  const safePrice = Math.max(0, toNumber(priceIdeal));
  const safeBaseCost = Math.max(0, toNumber(baseCost));
  const percentMarketplace = Math.max(0, marketplacePct || 0);
  const percentTax = Math.max(0, toNumber(taxPct)) / 100;
  const percentTaxExtra = Math.max(0, advDetails?.difal || 0) + Math.max(0, advDetails?.pis || 0) + Math.max(0, advDetails?.cofins || 0);
  const percentOps = Math.max(0, advDetails?.ads?.pct || 0) + Math.max(0, advDetails?.ret?.pct || 0) + Math.max(0, advDetails?.other?.pct || 0) + Math.max(0, advDetails?.costFixed?.pct || 0) + Math.max(0, affiliatePct || 0);

  const fixedCostExtra = Math.max(0, advDetails?.ads?.brl || 0) + Math.max(0, advDetails?.ret?.brl || 0) + Math.max(0, advDetails?.other?.brl || 0) + Math.max(0, advDetails?.costFixed?.brl || 0);

  const parts = {
    cost: safeBaseCost + fixedCostExtra,
    fees: safePrice * (percentMarketplace + percentOps) + Math.max(0, toNumber(marketplaceFixed)),
    tax: safePrice * (percentTax + percentTaxExtra),
    profit: Math.max(0, toNumber(profitBRL))
  };

  const toCents = (value) => Math.round(Math.max(0, value) * 100);
  const cents = {
    cost: toCents(parts.cost),
    fees: toCents(parts.fees),
    tax: toCents(parts.tax),
    profit: toCents(parts.profit)
  };
  const totalCents = toCents(safePrice);
  const delta = totalCents - (cents.cost + cents.fees + cents.tax + cents.profit);
  cents.profit = Math.max(0, cents.profit + delta);

  const amount = {
    cost: cents.cost / 100,
    fees: cents.fees / 100,
    tax: cents.tax / 100,
    profit: cents.profit / 100
  };

  const basePct = safePrice > 0 ? {
    cost: (amount.cost / safePrice) * 100,
    fees: (amount.fees / safePrice) * 100,
    tax: (amount.tax / safePrice) * 100
  } : { cost: 0, fees: 0, tax: 0 };
  const pctCost = clamp(basePct.cost, 0, 100);
  const pctFees = clamp(basePct.fees, 0, 100);
  const pctTax = clamp(basePct.tax, 0, 100);
  const pctProfit = clamp(100 - pctCost - pctFees - pctTax, 0, 100);

  return {
    cost: amount.cost,
    fees: amount.fees,
    tax: amount.tax,
    profit: amount.profit,
    pctCost,
    pctFees,
    pctTax,
    pctProfit
  };
}


function marginStatus(marginPct) {
  if (marginPct >= 8) return { label: "🟢 Saudável", className: "statusHealthy" };
  if (marginPct >= 0) return { label: "🟡 Apertado", className: "statusTight" };
  return { label: "🔴 Prejuízo", className: "statusLoss" };
}

function calculateMarketplaceAtPrice({
  price,
  cost,
  taxPct,
  marketplacePct,
  marketplaceFixed,
  percentCosts,
  fixedCosts,
  applyAntecipa = false
}) {
  const safePrice = Math.max(0, toNumber(price));
  const tax = Math.max(0, toNumber(taxPct)) / 100;

  const commission = safePrice * (marketplacePct || 0);
  const taxValue = safePrice * tax;
  const percentExtraValue = safePrice * (percentCosts || 0);

  const liquidoBase = safePrice - commission - (marketplaceFixed || 0) - taxValue - percentExtraValue - (fixedCosts || 0);
  const antecipa = applyAntecipa ? Math.max(0, liquidoBase) * 0.025 : 0;
  const liquidoFinal = liquidoBase - antecipa;

  const lucro = liquidoFinal - Math.max(0, cost);
  const margem = safePrice > 0 ? (lucro / safePrice) * 100 : 0;

  return {
    liquidoBase,
    antecipa,
    liquidoFinal,
    lucro,
    margem
  };
}

function breakdownAtPrice({
  price,
  cost,
  taxPct,
  marketplacePct,
  marketplaceFixed,
  percentCosts,
  fixedCosts,
  applyAntecipa = false
}) {
  const safePrice = Math.max(0, toNumber(price));
  const safeCost = Math.max(0, toNumber(cost));
  const tax = Math.max(0, toNumber(taxPct)) / 100;

  const commissionPct = Math.max(0, marketplacePct || 0);
  const commissionFixed = Math.max(0, marketplaceFixed || 0);
  const commissionValue = safePrice * commissionPct + commissionFixed;
  const taxesValue = safePrice * tax;
  const otherFeesValue = safePrice * (percentCosts || 0) + (fixedCosts || 0);

  // Mantém a base atual da taxa de antecipa: líquido do marketplace sem comissões.
  const netWithoutCommissionsBase = safePrice - commissionValue;
  const antecipaFee = applyAntecipa ? Math.max(0, netWithoutCommissionsBase) * 0.025 : 0;

  const profitValue =
    safePrice - commissionValue - taxesValue - otherFeesValue - safeCost - antecipaFee;

  return {
    price: safePrice,
    commissionValue,
    commissionPct,
    commissionFixed,
    taxesValue,
    otherFeesValue,
    netWithoutCommissionsBase,
    antecipaFee,
    profitValue
  };
}

function compareCardHTML(title, data) {
  const status = marginStatus(data.margem);
  return `
    <article class="compareCard">
      <div class="compareCard__title">${title}</div>
      <div class="compareCard__status ${status.className}">${status.label}</div>
      <div class="compareCard__rows">
        <div class="k">Líquido</div><div class="v">${brl(data.liquidoFinal)}</div>
        <div class="k">Lucro</div><div class="v">${brl(data.lucro)}</div>
        <div class="k">Margem</div><div class="v">${data.margem.toFixed(2)}%</div>
      </div>
    </article>
  `;
}

function updateReportRoot() {
  const reportRoot = document.querySelector("#reportRoot");
  const results = document.querySelector("#results");
  if (!reportRoot || !results) return;
  reportRoot.innerHTML = `
    <div class="cardSectionTitle">Relatório (Modo A: somente resultados)</div>
    ${results.innerHTML}
  `;
}

/* ===== Render ===== */

function resultCardHTML(
  title,
  pill,
  r,
  baseCost,
  taxPct,
  profitType,
  profitValue,
  marketplacePct,
  marketplaceFixed,
  advDetails,
  affiliatePct = 0,
  extraRows = [],
  options = {}
) {
  const price = Number.isFinite(r.price) ? brl(r.price) : "—";
  const received = brl(r.received);
  const profitLine = `${brl(r.profitBRL)} (${(r.profitPctReal * 100).toFixed(2)}%)`;
  const incidencesPct = `${(r.totalPercentCosts * 100).toFixed(2)}%`;

  // Detalhamento (sem duplicar “resumo”)
  // -> NÃO colocamos "Lucro" aqui (fica só no resumo)
  const items = buildIncidenciesList(
    taxPct,
    "pct", // força não inserir lucro aqui
    0,     // força não inserir lucro aqui
    marketplacePct,
    marketplaceFixed,
    affiliatePct,
    advDetails,
    Number.isFinite(r.price) ? r.price : 0
  );

  const composition = buildComposition({
    priceIdeal: r.price,
    baseCost,
    marketplacePct,
    marketplaceFixed,
    taxPct,
    advDetails,
    affiliatePct,
    profitBRL: r.profitBRL
  });
  const compositionLabel = `Composição do preço: custo ${brl(composition.cost)}, taxas ${brl(composition.fees)}, impostos ${brl(composition.tax)}, lucro ${brl(composition.profit)}`;
  const compositionTip = [
    `Custo: ${brl(composition.cost)} (${composition.pctCost.toFixed(1)}%)`,
    `Taxas: ${brl(composition.fees)} (${composition.pctFees.toFixed(1)}%)`,
    `Impostos: ${brl(composition.tax)} (${composition.pctTax.toFixed(1)}%)`,
    `Lucro: ${brl(composition.profit)} (${composition.pctProfit.toFixed(1)}%)`
  ].join(" | ");

  const itemsHTML = items.length
    ? items
        .map((group) => {
          const rows = group.items
            .map((item) => {
              const pctText = item.pct > 0 ? `${(item.pct * 100).toFixed(2)}%` : "—";
              const kindText = item.kind === "fixed" ? "custo fixo" : "entra no total %";
              return `<div class="k">${item.label}<small>${kindText}</small></div><div class="v">${pctText} • ${brl(item.brl)}</div>`;
            })
            .join("");
          return `<div class="incidenceGroupTitle">${group.group}</div>${rows}`;
        })
        .join("")
    : `<div class="k">—</div><div class="v">—</div>`;

  const extraHTML = extraRows
    .map((row) => `<div class="k">${row.k}</div><div class="v">${row.v}</div>`)
    .join("");

  const shopeeToggleHTML = options.showAntecipaToggle
    ? `
      <label class="check check--inline">
        <input id="shopeeAntecipa" type="checkbox" ${options.antecipaChecked ? "checked" : ""} />
        <span>Incluir Antecipa (2,5%)</span>
      </label>
    `
    : "";

  const shopeeInfoHTML = options.showAntecipaInfo && options.antecipaChecked
    ? `
      <div class="k">Antecipa</div><div class="v">- ${brl(options.antecipaValue || 0)}</div>
      <div class="k">Líquido após Antecipa</div><div class="v">${brl(options.liquidoAposAntecipa || 0)}</div>
    `
    : "";

  const assumedWeightNoteHTML = options.showAssumedWeightNote && options.assumedWeight
    ? `<div class="footnote">Peso não informado: assumimos 0,5 kg.</div>`
    : "";

  const accordionId = `incidence-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const cardId = `market-card-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return `
  <details class="card marketplaceCard resultCard resultAccordion ${options.marketplaceClass || ""}" id="${cardId}">
    <summary class="resultAccordion__summary" aria-label="${title}: vender por ${price}">
      <div class="resultAccordion__summaryMain">
        <div class="resultAccordion__left">
          <div class="cardTitleWrap">
            <span class="cardIcon" aria-hidden="true">${options.marketplaceIcon || "🛒"}</span>
            <div>
              <div class="cardTitle">${title}</div>
              <div class="pill pill--subtle">${pill}</div>
            </div>
          </div>
        </div>

        <div class="resultAccordion__right">
          <div class="resultAccordion__priceLabel">VENDER POR:</div>
          <div class="resultAccordion__priceValue">${price}</div>
        </div>

        <span class="resultAccordion__chevron" aria-hidden="true">▾</span>
      </div>
    </summary>

    <div class="resultAccordion__body">
      ${shopeeToggleHTML}

      <div class="resultGrid resultGrid--support">
        <div class="k">VOCÊ RECEBE</div><div class="v">${received}</div>
        <div class="k">LUCRO</div><div class="v">${profitLine}</div>
        <div class="k">TOTAL DE INCIDÊNCIAS</div><div class="v">
          <button class="incidenceToggle" type="button" aria-expanded="false" aria-controls="${accordionId}">
            <span>Total de incidências (${incidencesPct})</span>
            <span class="incidenceToggle__icon">▾</span>
          </button>
        </div>
        ${extraHTML}
        ${shopeeInfoHTML}
      </div>

      <div class="comp">
        <button class="comp-bar" type="button" role="img" aria-label="${compositionLabel}" data-composition-tip="${compositionTip}">
          <span class="seg seg-cost" style="width:${composition.pctCost.toFixed(2)}%"></span>
          <span class="seg seg-fees" style="width:${composition.pctFees.toFixed(2)}%"></span>
          <span class="seg seg-tax" style="width:${composition.pctTax.toFixed(2)}%"></span>
          <span class="seg seg-profit" style="width:${composition.pctProfit.toFixed(2)}%"></span>
        </button>
        <div class="comp-legend">Custo • Taxas • Impostos • Lucro</div>
        <div class="comp-tip" aria-live="polite" hidden></div>
      </div>

      <div id="${accordionId}" class="incidencePanel" aria-hidden="true">
        <div class="resultGrid resultGrid--details">
          ${itemsHTML}
        </div>
      </div>

      ${assumedWeightNoteHTML}
    </div>
  </details>
  `;
}


/* ===== Main calc ===== */


async function shareFallback() {
  const summaryText = "Confira seus preços por marketplace em https://precificacao.rafamaceno.com.br";
  try {
    await navigator.clipboard.writeText(summaryText);
    trackGA4Event("copy_link", { section: "summary_text" });
    alert("Copiado");
  } catch {
    alert("Copiado");
  }
}

function runShareAction() {
  const whatsappBtn = document.querySelector('[data-action="share-whatsapp"]:not(#stickyShare)');
  if (whatsappBtn) {
    whatsappBtn.click();
    return;
  }
  shareFallback();
}

function bindTooltipSystem() {
  const triggers = Array.from(document.querySelectorAll(".info[data-tooltip]"));
  if (!triggers.length) return;

  const tooltip = document.createElement("div");
  tooltip.id = "uiTooltip";
  tooltip.className = "tooltip";
  tooltip.setAttribute("role", "tooltip");
  tooltip.hidden = true;
  document.body.appendChild(tooltip);

  let activeTrigger = null;

  const placeTooltip = (trigger) => {
    const rect = trigger.getBoundingClientRect();
    const margin = 10;

    tooltip.style.left = "0px";
    tooltip.style.top = "0px";
    tooltip.hidden = false;

    const tipRect = tooltip.getBoundingClientRect();
    let left = rect.left + (rect.width / 2) - (tipRect.width / 2);
    left = Math.max(margin, Math.min(left, window.innerWidth - tipRect.width - margin));

    let top = rect.top - tipRect.height - 8;
    if (top < margin) {
      top = rect.bottom + 8;
    }

    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.style.top = `${Math.round(top)}px`;
  };

  const openTooltip = (trigger) => {
    const text = trigger.getAttribute("data-tooltip") || "";
    if (!text) return;

    if (activeTrigger && activeTrigger !== trigger) {
      activeTrigger.removeAttribute("aria-describedby");
      activeTrigger.setAttribute("aria-expanded", "false");
    }

    activeTrigger = trigger;
    tooltip.textContent = text;
    trigger.setAttribute("aria-describedby", tooltip.id);
    trigger.setAttribute("aria-expanded", "true");
    placeTooltip(trigger);
  };

  const closeTooltip = () => {
    if (!activeTrigger) return;
    activeTrigger.removeAttribute("aria-describedby");
    activeTrigger.setAttribute("aria-expanded", "false");
    activeTrigger = null;
    tooltip.hidden = true;
  };

  triggers.forEach((trigger) => {
    trigger.setAttribute("aria-haspopup", "true");
    trigger.setAttribute("aria-expanded", "false");

    trigger.addEventListener("mouseenter", () => openTooltip(trigger));
    trigger.addEventListener("focus", () => openTooltip(trigger));
    trigger.addEventListener("mouseleave", () => {
      if (activeTrigger === trigger) closeTooltip();
    });
    trigger.addEventListener("blur", () => {
      if (activeTrigger === trigger) closeTooltip();
    });
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (activeTrigger === trigger) {
        closeTooltip();
      } else {
        openTooltip(trigger);
      }
    });
  });

  window.addEventListener("resize", () => {
    if (activeTrigger) placeTooltip(activeTrigger);
  });

  window.addEventListener("scroll", () => {
    if (activeTrigger) placeTooltip(activeTrigger);
  }, { passive: true });

  document.addEventListener("keyup", (event) => {
    if (event.key === "Escape") closeTooltip();
  });

  document.addEventListener("click", (event) => {
    if (!activeTrigger) return;
    if (event.target === activeTrigger || activeTrigger.contains(event.target)) return;
    closeTooltip();
  });
}

function renderRankingInsights(items) {
  const el = document.querySelector("#rankingInsights");
  if (!el || !Array.isArray(items) || !items.length) return;

  const byMargin = [...items].sort((a, b) => (b.marginPct || 0) - (a.marginPct || 0));
  const byProfit = [...items].sort((a, b) => (b.profitBRL || 0) - (a.profitBRL || 0));
  const byCost = [...items].sort((a, b) => (b.totalCost || 0) - (a.totalCost || 0));

  el.innerHTML = `
    <div>🏆 <strong>Melhor margem:</strong> ${byMargin[0].title} (${byMargin[0].marginPct.toFixed(2)}%)</div>
    <div>💰 <strong>Maior lucro:</strong> ${byProfit[0].title} (${brl(byProfit[0].profitBRL)})</div>
    <div>⚠ <strong>Maior custo:</strong> ${byCost[0].title} (${brl(byCost[0].totalCost)})</div>
  `;

  trackGA4Event("marketplace_rank_generated", { best_margin: byMargin[0].key, best_profit: byProfit[0].key });
}

function getSavedSimulations() {
  try { return JSON.parse(localStorage.getItem(SAVED_SIMULATIONS_KEY) || "[]"); } catch { return []; }
}

function renderSavedSimulations() {
  const select = document.querySelector("#savedSimulations");
  if (!select) return;
  const items = getSavedSimulations();
  select.innerHTML = '<option value="">Simulações salvas</option>' + items.map((item, i) => `<option value="${i}">${item.name}</option>`).join("");
}

function applySimpleShareParams() {
  const params = new URLSearchParams(window.location.search);
  const custo = params.get("custo");
  const imposto = params.get("imposto");
  const lucro = params.get("lucro");
  if (custo !== null) document.querySelector("#cost").value = custo;
  if (imposto !== null) document.querySelector("#tax").value = imposto;
  if (lucro !== null) document.querySelector("#profitValue").value = lucro;
}

function initTheme() {
  const btn = document.querySelector("#themeToggle");
  const saved = localStorage.getItem(THEME_KEY) || "light";
  document.body.classList.toggle("theme-dark", saved === "dark");
  btn?.addEventListener("click", () => {
    const dark = !document.body.classList.contains("theme-dark");
    document.body.classList.toggle("theme-dark", dark);
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  });
}

function renderResultInsight() {}

function getCalculationConfig() {
  const taxPct = clamp(toNumber(document.querySelector("#tax")?.value), 0, 99);
  const profitType = document.querySelector("#profitType")?.value || "brl";
  const profitValue = Math.max(0, toNumber(document.querySelector("#profitValue")?.value));

  const mlCommissionEnabled = document.querySelector("#mlCommissionToggle")?.checked;
  const mlClassicPct = (mlCommissionEnabled ? toNumber(document.querySelector("#mlClassicPct")?.value) : 14) / 100;
  const mlPremiumPct = (mlCommissionEnabled ? toNumber(document.querySelector("#mlPremiumPct")?.value) : 19) / 100;

  const adv = getAdvancedVars();

  const weightToggle = document.querySelector("#mlWeightToggle")?.checked;
  const weightValueRaw = document.querySelector("#mlWeightValue")?.value;
  const weightUnit = document.querySelector("#mlWeightUnit")?.value || "kg";
  const weightData = resolveMarketplaceWeight({ enabled: weightToggle, rawValue: weightValueRaw, unit: weightUnit });

  const sheinCommissionEnabled = document.querySelector("#sheinCommissionToggle")?.checked;
  const sheinCategory = sheinCommissionEnabled ? (document.querySelector("#sheinCategory")?.value || "other") : "other";

  const amazonDbaEnabled = document.querySelector("#amazonDbaToggle")?.checked || false;
  const amazonPct = Math.max(0, toNumber(document.querySelector("#amazonPct")?.value)) / 100;
  const amazonOriginGroup = document.querySelector("#amazonOriginGroup")?.value || "sp_capital";

  return { taxPct, profitType, profitValue, mlClassicPct, mlPremiumPct, adv, weightData, sheinCategory, amazonDbaEnabled, amazonPct, amazonOriginGroup };
}

function computeForAllMarketplaces(inputState) {
  const cost = Math.max(0, toNumber(inputState?.cost));
  const calcConfig = inputState?.config || getCalculationConfig();
  const { taxPct, profitType, profitValue, mlClassicPct, mlPremiumPct, adv, weightData, sheinCategory, amazonDbaEnabled, amazonPct, amazonOriginGroup } = calcConfig;
  const weightKg = weightData.kg;

  const tiktok = solvePrice({ cost, taxPct, profitType, profitValue, marketplacePct: TIKTOK.pct, marketplaceFixed: TIKTOK.fixed, fixedCosts: adv.fixedBRL, percentCosts: adv.pctExtra + adv.affiliate.tiktok });

  const sheinPct = sheinCategory === "female" ? SHEIN.pctFemale : SHEIN.pctOther;
  const sheinFixed = sheinFixedByWeight(weightKg);
  const shein = solvePrice({ cost, taxPct, profitType, profitValue, marketplacePct: sheinPct, marketplaceFixed: sheinFixed, fixedCosts: adv.fixedBRL, percentCosts: adv.pctExtra });

  let currentFaixa = SHOPEE_FAIXAS[0];
  let iterations = 0;
  let shopeeRaw = solvePrice({ cost, taxPct, profitType, profitValue, marketplacePct: currentFaixa.pct, marketplaceFixed: currentFaixa.fixed, fixedCosts: adv.fixedBRL, percentCosts: adv.pctExtra + adv.affiliate.shopee });
  while (iterations < 6) {
    const faixa = SHOPEE_FAIXAS.find((f) => shopeeRaw.price >= f.min && shopeeRaw.price <= f.max) || currentFaixa;
    if (faixa === currentFaixa) break;
    currentFaixa = faixa;
    shopeeRaw = solvePrice({ cost, taxPct, profitType, profitValue, marketplacePct: currentFaixa.pct, marketplaceFixed: currentFaixa.fixed, fixedCosts: adv.fixedBRL, percentCosts: adv.pctExtra + adv.affiliate.shopee });
    iterations += 1;
  }

  const solveML = (mlPct) => {
    let r = solvePrice({ cost, taxPct, profitType, profitValue, marketplacePct: mlPct, marketplaceFixed: 0, fixedCosts: adv.fixedBRL, percentCosts: adv.pctExtra + adv.affiliate.ml });
    const fixed = Number.isFinite(r.price) ? mlFixedByTable(r.price, weightKg) : 0;
    r = solvePrice({ cost, taxPct, profitType, profitValue, marketplacePct: mlPct, marketplaceFixed: fixed, fixedCosts: adv.fixedBRL, percentCosts: adv.pctExtra + adv.affiliate.ml });
    return { r, fixed };
  };

  const mlClassic = solveML(mlClassicPct);
  const mlPremium = solveML(mlPremiumPct);

  let amazonData = null;
  if (amazonDbaEnabled) {
    let estimatedPrice = Math.max(0, cost + adv.fixedBRL + (profitType === "brl" ? profitValue : 0));
    let fee = amazonDbaFee({ price: estimatedPrice, weightKg, originGroup: amazonOriginGroup });
    let i = 0;
    while (i < 6) {
      const result = solvePrice({ cost, taxPct, profitType, profitValue, marketplacePct: amazonPct, marketplaceFixed: fee, fixedCosts: adv.fixedBRL, percentCosts: adv.pctExtra + adv.affiliate.amazon });
      const nextFee = amazonDbaFee({ price: result.price, weightKg, originGroup: amazonOriginGroup });
      if (Math.abs(nextFee - fee) < 0.0001) {
        amazonData = { result, fee: nextFee, priceBand: getAmazonPriceBand(result.price), weightBand: getAmazonWeightBand(weightKg) };
        break;
      }
      fee = nextFee;
      estimatedPrice = result.price;
      i += 1;
    }
    if (!amazonData) {
      const result = solvePrice({ cost, taxPct, profitType, profitValue, marketplacePct: amazonPct, marketplaceFixed: fee, fixedCosts: adv.fixedBRL, percentCosts: adv.pctExtra + adv.affiliate.amazon });
      amazonData = { result, fee, priceBand: getAmazonPriceBand(result.price), weightBand: getAmazonWeightBand(weightKg) };
    }
  }

  return { calcConfig, cost, tiktok, shein, sheinPct, sheinFixed, shopeeRaw, shopeeFaixa: currentFaixa, mlClassic, mlPremium, amazonData };
}

const Bulk = {
  rows: [],
  results: [],
  init() {
    this.rows = Array.from({ length: 10 }, () => ({ name: "", cost: "" }));
    this.renderBulkRows();
  },
  renderBulkRows() {
    const body = document.querySelector("#bulkRows");
    if (!body) return;
    body.innerHTML = this.rows.map((row, index) => `<tr><td><input data-bulk="name" data-index="${index}" type="text" placeholder="Produto ${index + 1}" value="${row.name || ""}"></td><td><input data-bulk="cost" data-index="${index}" type="text" inputmode="decimal" placeholder="0,00" value="${row.cost || ""}"></td></tr>`).join("");
  },
  addRow() {
    this.rows.push({ name: "", cost: "" });
    this.renderBulkRows();
    trackGA4Event("bulk_add_row");
  },
  parseMoney(value) {
    return toNumber(String(value || "").replace(/R\$/gi, "").replace(/\./g, "").replace(",", "."));
  },
  parseCSV(text) {
    const lines = String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!lines.length) return [];
    const sep = lines[0].includes(";") ? ";" : ",";
    const parsed = lines.map((line) => line.split(sep).map((cell) => cell.trim()));
    const hasHeader = /nome/i.test(parsed[0]?.[0] || "") && /custo/i.test(parsed[0]?.[1] || "");
    const rows = (hasHeader ? parsed.slice(1) : parsed).map((cols) => ({ name: cols[0] || "Produto", cost: this.parseMoney(cols[1]) })).filter((row) => row.name || row.cost > 0);
    return rows;
  },
  bulkCalculate(rows) {
    const config = getCalculationConfig();
    const marketplaces = ["shopee", "mlClassic", "mlPremium", "tiktok", "shein", "amazon"];
    const out = [];
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const cost = Math.max(0, this.parseMoney(row.cost));
      const data = computeForAllMarketplaces({ cost, config });
      const map = {
        shopee: data.shopeeRaw,
        mlClassic: data.mlClassic.r,
        mlPremium: data.mlPremium.r,
        tiktok: data.tiktok,
        shein: data.shein,
        amazon: data.amazonData?.result
      };
      let bestProfit = -Infinity;
      marketplaces.forEach((key) => {
        const p = map[key]?.profitBRL;
        if (Number.isFinite(p) && p > bestProfit) bestProfit = p;
      });
      out.push({ name: row.name || `Produto ${i + 1}`, cost, map, bestProfit });
    }
    return out;
  },
  renderResults(results) {
    const head = document.querySelector("#bulkResultsHead");
    const body = document.querySelector("#bulkResultsBody");
    const wrap = document.querySelector("#bulkResultsWrap");
    if (!head || !body || !wrap) return;
    const hasAmazon = results.some((item) => item.map.amazon);
    const cols = ["Nome", "Custo", "Shopee", "ML Clássico", "ML Premium", "TikTok", "SHEIN", ...(hasAmazon ? ["Amazon"] : []), "Melhor lucro"];
    head.innerHTML = `<tr>${cols.map((col) => `<th>${col}</th>`).join("")}</tr>`;
    body.innerHTML = results.map((item) => `
      <tr>
        <td>${item.name}</td>
        <td>${brl(item.cost)}</td>
        <td>${brl(item.map.shopee?.price || 0)}</td>
        <td>${brl(item.map.mlClassic?.price || 0)}</td>
        <td>${brl(item.map.mlPremium?.price || 0)}</td>
        <td>${brl(item.map.tiktok?.price || 0)}</td>
        <td>${brl(item.map.shein?.price || 0)}</td>
        ${hasAmazon ? `<td>${brl(item.map.amazon?.price || 0)}</td>` : ""}
        <td>${brl(item.bestProfit || 0)}</td>
      </tr>
    `).join("");
    wrap.classList.remove("is-hidden");
    const exportBtn = document.querySelector("#bulkExport");
    if (exportBtn) exportBtn.disabled = !results.length;
  },
  exportBulkCSV(results) {
    const hasAmazon = results.some((item) => item.map.amazon);
    const header = ["nome", "custo", "shopee", "ml_classico", "ml_premium", "tiktok", "shein", ...(hasAmazon ? ["amazon"] : []), "melhor_lucro"];
    const rows = results.map((item) => [item.name, item.cost.toFixed(2), (item.map.shopee?.price || 0).toFixed(2), (item.map.mlClassic?.price || 0).toFixed(2), (item.map.mlPremium?.price || 0).toFixed(2), (item.map.tiktok?.price || 0).toFixed(2), (item.map.shein?.price || 0).toFixed(2), ...(hasAmazon ? [(item.map.amazon?.price || 0).toFixed(2)] : []), (item.bestProfit || 0).toFixed(2)]);
    const csv = [header.join(";"), ...rows.map((row) => row.join(";"))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `calculo-massa-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }
};


function bindBulk() {
  const bulkRows = document.querySelector("#bulkRows");
  if (!bulkRows) return;

  Bulk.init();

  document.querySelector("#bulkAddRow")?.addEventListener("click", () => Bulk.addRow());
  document.querySelector("#bulkRows")?.addEventListener("input", (event) => {
    const index = Number(event.target.getAttribute("data-index"));
    const field = event.target.getAttribute("data-bulk");
    if (!Number.isFinite(index) || !field) return;
    Bulk.rows[index][field] = event.target.value;
  });

  document.querySelector("#bulkCsvInput")?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = Bulk.parseCSV(text);
    if (parsed.length) {
      Bulk.rows = parsed;
      Bulk.renderBulkRows();
      trackGA4Event("bulk_import_csv", { rows: parsed.length });
    }
  });

  document.querySelector("#bulkCalculate")?.addEventListener("click", () => {
    const rows = Bulk.rows.map((row) => ({ name: String(row.name || "").trim(), cost: row.cost })).filter((row) => row.name || Bulk.parseMoney(row.cost) > 0);
    const results = Bulk.bulkCalculate(rows);
    Bulk.results = results;
    Bulk.renderResults(results);
    trackGA4Event("bulk_calculate", { rows: rows.length });
  });

  document.querySelector("#bulkExport")?.addEventListener("click", () => {
    Bulk.exportBulkCSV(Bulk.results || []);
    trackGA4Event("bulk_export_csv", { rows: (Bulk.results || []).length });
  });
}


function recalc(options = {}) {
  const source = options.source || "auto";
  const cost = Math.max(0, toNumber(document.querySelector("#cost")?.value));
  const taxPct = clamp(toNumber(document.querySelector("#tax")?.value), 0, 99); // ✅ ID correto: #tax

  const profitType = document.querySelector("#profitType")?.value || "brl";
  const profitValue = Math.max(0, toNumber(document.querySelector("#profitValue")?.value));

  const mlCommissionEnabled = document.querySelector("#mlCommissionToggle")?.checked;
  const mlClassicPct = (mlCommissionEnabled ? toNumber(document.querySelector("#mlClassicPct")?.value) : 14) / 100;
  const mlPremiumPct = (mlCommissionEnabled ? toNumber(document.querySelector("#mlPremiumPct")?.value) : 19) / 100;

  const adv = getAdvancedVars();

  const weightToggle = document.querySelector("#mlWeightToggle")?.checked;
  const weightValueRaw = document.querySelector("#mlWeightValue")?.value;
  const weightUnit = document.querySelector("#mlWeightUnit")?.value || "kg";
  const weightData = resolveMarketplaceWeight({
    enabled: weightToggle,
    rawValue: weightValueRaw,
    unit: weightUnit
  });
  const weightKg = weightData.kg;

  const amazonDbaEnabled = document.querySelector("#amazonDbaToggle")?.checked || false;
  const amazonPct = Math.max(0, toNumber(document.querySelector("#amazonPct")?.value)) / 100;
  const amazonOriginGroup = document.querySelector("#amazonOriginGroup")?.value || "sp_capital";
  const amazonWeightKg = weightData.kg;

  /* ===== TIKTOK SHOP ===== */
  const tiktok = solvePrice({
    cost,
    taxPct,
    profitType,
    profitValue,
    marketplacePct: TIKTOK.pct,
    marketplaceFixed: TIKTOK.fixed,
    fixedCosts: adv.fixedBRL,
    percentCosts: adv.pctExtra + adv.affiliate.tiktok
  });

  /* ===== SHEIN ===== */
  const sheinCommissionEnabled = document.querySelector("#sheinCommissionToggle")?.checked;
  const sheinCategory = sheinCommissionEnabled
    ? (document.querySelector("#sheinCategory")?.value || "other")
    : "other";
  const sheinPct = sheinCategory === "female" ? SHEIN.pctFemale : SHEIN.pctOther;
  const sheinFixed = sheinFixedByWeight(weightKg);

  const shein = solvePrice({
    cost,
    taxPct,
    profitType,
    profitValue,
    marketplacePct: sheinPct,
    marketplaceFixed: sheinFixed,
    fixedCosts: adv.fixedBRL,
    percentCosts: adv.pctExtra
  });

  /* ===== SHOPEE (iterativo) ===== */
  function solveShopee() {
    let currentFaixa = SHOPEE_FAIXAS[0];
    let price = 0;
    let iterations = 0;

    while (iterations < 6) {
      const result = solvePrice({
        cost,
        taxPct,
        profitType,
        profitValue,
        marketplacePct: currentFaixa.pct,
        marketplaceFixed: currentFaixa.fixed,
        fixedCosts: adv.fixedBRL,
        percentCosts: adv.pctExtra + adv.affiliate.shopee
      });

      price = Number.isFinite(result.price) ? result.price : 0;

      const faixa = SHOPEE_FAIXAS.find((f) => price >= f.min && price <= f.max) || currentFaixa;

      if (faixa === currentFaixa) {
        return { result, faixa: currentFaixa };
      }

      currentFaixa = faixa;
      iterations++;
    }

    const finalResult = solvePrice({
      cost,
      taxPct,
      profitType,
      profitValue,
      marketplacePct: currentFaixa.pct,
      marketplaceFixed: currentFaixa.fixed,
      fixedCosts: adv.fixedBRL,
      percentCosts: adv.pctExtra + adv.affiliate.shopee
    });

    return { result: finalResult, faixa: currentFaixa };
  }

  const shopeeData = solveShopee();
  const shopeeRaw = shopeeData.result;
  const shFee = shopeeData.faixa;
  const shopeeAntecipa = document.querySelector("#shopeeAntecipa")?.checked || false;

  const targetProfitBRL = Math.max(0, shopeeRaw.profitBRL);
  let shopee = { ...shopeeRaw };
  let custoAntecipa = 0;
  let liquidoFinalShopee = shopeeRaw.received;

  if (shopeeAntecipa) {
    const shopeeBreakdownAtPrice = (price) => breakdownAtPrice({
      price,
      cost,
      taxPct,
      marketplacePct: shFee.pct,
      marketplaceFixed: shFee.fixed,
      percentCosts: adv.pctExtra + adv.affiliate.shopee,
      fixedCosts: adv.fixedBRL,
      applyAntecipa: true
    });

    let low = Math.max(0, cost + adv.fixedBRL + shFee.fixed);
    let high = Math.max(low + 1, shopeeRaw.price || 0);
    let highBreakdown = shopeeBreakdownAtPrice(high);
    let expandGuard = 0;

    while (highBreakdown.profitValue < targetProfitBRL && expandGuard < 25) {
      high *= 2;
      highBreakdown = shopeeBreakdownAtPrice(high);
      expandGuard += 1;
    }

    for (let i = 0; i < 40; i += 1) {
      const mid = (low + high) / 2;
      const breakdown = shopeeBreakdownAtPrice(mid);
      if (breakdown.profitValue < targetProfitBRL) {
        low = mid;
      } else {
        high = mid;
      }
    }

    const adjustedPrice = Math.max(0, Math.round(high * 100) / 100);
    const adjustedBreakdown = shopeeBreakdownAtPrice(adjustedPrice);

    custoAntecipa = adjustedBreakdown.antecipaFee;
    liquidoFinalShopee = adjustedPrice - adjustedBreakdown.commissionValue - adjustedBreakdown.antecipaFee;

    shopee = {
      ...shopeeRaw,
      price: adjustedPrice,
      commissionValue: adjustedBreakdown.commissionValue,
      received: liquidoFinalShopee,
      profitBRL: adjustedBreakdown.profitValue,
      profitPctReal: adjustedPrice > 0 ? adjustedBreakdown.profitValue / adjustedPrice : 0
    };

    trackGA4Event("antecipa_price_adjusted", {
      marketplace: "shopee",
      delta_price: Math.max(0, adjustedPrice - shopeeRaw.price)
    });
  }

  /* ===== MERCADO LIVRE ===== */
  function solveML(mlPct) {
    let r = solvePrice({
      cost,
      taxPct,
      profitType,
      profitValue,
      marketplacePct: mlPct,
      marketplaceFixed: 0,
      fixedCosts: adv.fixedBRL,
      percentCosts: adv.pctExtra + adv.affiliate.ml
    });

    const fixed = Number.isFinite(r.price) ? mlFixedByTable(r.price, weightKg) : 0;

    r = solvePrice({
      cost,
      taxPct,
      profitType,
      profitValue,
      marketplacePct: mlPct,
      marketplaceFixed: fixed,
      fixedCosts: adv.fixedBRL,
      percentCosts: adv.pctExtra + adv.affiliate.ml
    });

    return { r, fixed };
  }

  const mlClassic = solveML(mlClassicPct);
  const mlPremium = solveML(mlPremiumPct);

  function solveAmazon() {
    let estimatedPrice = Math.max(0, cost + adv.fixedBRL + (profitType === "brl" ? profitValue : 0));
    let fee = amazonDbaFee({ price: estimatedPrice, weightKg: amazonWeightKg, originGroup: amazonOriginGroup });
    let iterations = 0;

    while (iterations < 6) {
      const result = solvePrice({
        cost,
        taxPct,
        profitType,
        profitValue,
        marketplacePct: amazonPct,
        marketplaceFixed: fee,
        fixedCosts: adv.fixedBRL,
        percentCosts: adv.pctExtra + adv.affiliate.amazon
      });

      const nextPrice = Number.isFinite(result.price) ? result.price : 0;
      const nextFee = amazonDbaFee({ price: nextPrice, weightKg: amazonWeightKg, originGroup: amazonOriginGroup });
      if (Math.abs(nextFee - fee) < 0.0001) {
        return {
          result,
          fee: nextFee,
          priceBand: getAmazonPriceBand(nextPrice),
          weightBand: getAmazonWeightBand(amazonWeightKg)
        };
      }

      estimatedPrice = nextPrice;
      fee = nextFee;
      iterations += 1;
    }

    const finalResult = solvePrice({
      cost,
      taxPct,
      profitType,
      profitValue,
      marketplacePct: amazonPct,
      marketplaceFixed: fee,
      fixedCosts: adv.fixedBRL,
      percentCosts: adv.pctExtra + adv.affiliate.amazon
    });

    return {
      result: finalResult,
      fee,
      priceBand: getAmazonPriceBand(finalResult.price),
      weightBand: getAmazonWeightBand(amazonWeightKg)
    };
  }

  const amazonData = amazonDbaEnabled ? solveAmazon() : null;

  const amazonOriginWrap = document.querySelector("#amazonOriginWrap");
  if (amazonOriginWrap) {
    const shouldShowOrigin = amazonDbaEnabled && amazonData?.priceBand === "above_200";
    amazonOriginWrap.classList.toggle("is-hidden", !shouldShowOrigin);
  }

  const resultsEl = document.querySelector("#results");
  if (!resultsEl) return;

  resultsEl.innerHTML = [
    resultCardHTML(
      "Shopee",
      `${(shFee.pct * 100).toFixed(0)}% + ${brl(shFee.fixed)}`,
      shopee,
      cost,
      taxPct,
      profitType,
      profitValue,
      shFee.pct,
      shFee.fixed,
      adv.details,
      adv.affiliate.shopee,
      [{ k: "Faixa aplicada", v: shFee.label }],
      {
        showAntecipaToggle: true,
        antecipaChecked: shopeeAntecipa,
        showAntecipaInfo: true,
        antecipaValue: custoAntecipa,
        liquidoAposAntecipa: liquidoFinalShopee,
        marketplaceClass: "mp-shopee"
      }
    ),
    resultCardHTML(
      "TikTok Shop",
      `12% + ${brl(4)}`,
      tiktok,
      cost,
      taxPct,
      profitType,
      profitValue,
      TIKTOK.pct,
      TIKTOK.fixed,
      adv.details,
      adv.affiliate.tiktok,
      [],
      { marketplaceClass: "mp-tiktok", marketplaceIcon: "🎵" }
    ),
    resultCardHTML(
      "SHEIN",
      `${(sheinPct * 100).toFixed(0)}% + ${brl(sheinFixed)} (frete)`,
      shein,
      cost,
      taxPct,
      profitType,
      profitValue,
      sheinPct,
      sheinFixed,
      adv.details,
      0,
      [
        { k: "Categoria", v: (sheinCategory === "female" ? "Vestuário feminino" : "Demais categorias") },
        { k: "Intermediação de frete", v: brl(sheinFixed) },
        { k: "Peso usado", v: `${weightKg.toFixed(3)} kg` }
      ],
      { marketplaceClass: "mp-shein", marketplaceIcon: "💙", showAssumedWeightNote: true, assumedWeight: weightData.assumed }
    ),
    ...(amazonDbaEnabled && amazonData ? [
      resultCardHTML(
        "Amazon (DBA)",
        `${(amazonPct * 100).toFixed(2)}% + ${brl(amazonData.fee)} (DBA)`,
        amazonData.result,
        cost,
        taxPct,
        profitType,
        profitValue,
        amazonPct,
        amazonData.fee,
        adv.details,
        adv.affiliate.amazon,
        [
          { k: "Bloco de preço DBA", v: amazonData.priceBand === "below_79" ? "Até R$ 78,99" : (amazonData.priceBand === "79_199" ? "R$ 79 a R$ 199,99" : "Acima de R$ 200") },
          { k: "Faixa de peso DBA", v: amazonData.weightBand },
          { k: "Peso usado", v: `${amazonWeightKg.toFixed(3)} kg` },
          ...(amazonData.priceBand === "above_200" ? [{ k: "Origem", v: document.querySelector("#amazonOriginGroup")?.selectedOptions?.[0]?.textContent || "SP Capital" }] : [])
        ],
        { marketplaceClass: "mp-amazon", marketplaceIcon: "📦", showAssumedWeightNote: true, assumedWeight: weightData.assumed }
      )
    ] : []),
    resultCardHTML(
      "Mercado Livre — Clássico",
      `${(mlClassicPct * 100).toFixed(2)}%`,
      mlClassic.r,
      cost,
      taxPct,
      profitType,
      profitValue,
      mlClassicPct,
      mlClassic.fixed,
      adv.details,
      adv.affiliate.ml,
      [
        { k: "Custo fixo (tabela)", v: brl(mlClassic.fixed) },
        { k: "Peso usado", v: `${weightKg.toFixed(3)} kg` }
      ],
      { marketplaceClass: "mp-ml", marketplaceIcon: "🟨", showAssumedWeightNote: true, assumedWeight: weightData.assumed }
    ),
    resultCardHTML(
      "Mercado Livre — Premium",
      `${(mlPremiumPct * 100).toFixed(2)}%`,
      mlPremium.r,
      cost,
      taxPct,
      profitType,
      profitValue,
      mlPremiumPct,
      mlPremium.fixed,
      adv.details,
      adv.affiliate.ml,
      [
        { k: "Custo fixo (tabela)", v: brl(mlPremium.fixed) },
        { k: "Peso usado", v: `${weightKg.toFixed(3)} kg` }
      ],
      { marketplaceClass: "mp-ml", marketplaceIcon: "🟨", showAssumedWeightNote: true, assumedWeight: weightData.assumed }
    )
  ].join("");

  if (resultsEl.children.length && !sessionStorage.getItem(COMPOSITION_VIEW_KEY)) {
    trackGA4Event("view_composition");
    sessionStorage.setItem(COMPOSITION_VIEW_KEY, "1");
  }

  const marketplaceState = [
    { key: "shopee", title: "Shopee", marketplacePct: shFee.pct, marketplaceFixed: shFee.fixed, percentCosts: adv.pctExtra + adv.affiliate.shopee, fixedCosts: adv.fixedBRL },
    { key: "tiktok", title: "TikTok Shop", marketplacePct: TIKTOK.pct, marketplaceFixed: TIKTOK.fixed, percentCosts: adv.pctExtra + adv.affiliate.tiktok, fixedCosts: adv.fixedBRL },
    { key: "shein", title: "SHEIN", marketplacePct: sheinPct, marketplaceFixed: sheinFixed, percentCosts: adv.pctExtra, fixedCosts: adv.fixedBRL },
    ...(amazonDbaEnabled && amazonData ? [{ key: "amazon", title: "Amazon (DBA)", marketplacePct: amazonPct, marketplaceFixed: amazonData.fee, percentCosts: adv.pctExtra + adv.affiliate.amazon, fixedCosts: adv.fixedBRL }] : []),
    { key: "mlClassic", title: "Mercado Livre — Clássico", marketplacePct: mlClassicPct, marketplaceFixed: mlClassic.fixed, percentCosts: adv.pctExtra + adv.affiliate.ml, fixedCosts: adv.fixedBRL },
    { key: "mlPremium", title: "Mercado Livre — Premium", marketplacePct: mlPremiumPct, marketplaceFixed: mlPremium.fixed, percentCosts: adv.pctExtra + adv.affiliate.ml, fixedCosts: adv.fixedBRL }
  ];

  const computedResults = [
    { key: "shopee", title: "Shopee", price: shopee.price, profitBRL: shopee.profitBRL, marginPct: shopee.profitPctReal * 100 },
    { key: "tiktok", title: "TikTok Shop", price: tiktok.price, profitBRL: tiktok.profitBRL, marginPct: tiktok.profitPctReal * 100 },
    { key: "shein", title: "SHEIN", price: shein.price, profitBRL: shein.profitBRL, marginPct: shein.profitPctReal * 100 },
    ...(amazonDbaEnabled && amazonData ? [{ key: "amazon", title: "Amazon (DBA)", price: amazonData.result.price, profitBRL: amazonData.result.profitBRL, marginPct: amazonData.result.profitPctReal * 100 }] : []),
    { key: "mlClassic", title: "Mercado Livre — Clássico", price: mlClassic.r.price, profitBRL: mlClassic.r.profitBRL, marginPct: mlClassic.r.profitPctReal * 100 },
    { key: "mlPremium", title: "Mercado Livre — Premium", price: mlPremium.r.price, profitBRL: mlPremium.r.profitBRL, marginPct: mlPremium.r.profitPctReal * 100 }
  ].map((item) => ({ ...item, totalCost: Math.max(0, item.price - item.profitBRL) }));

  const state = { marketplaces: marketplaceState, cost, taxPct, shopeeAntecipa, computedResults };
  const basicResults = computeForAllMarketplaces({
    cost,
    config: {
      ...getCalculationConfig(),
      adv: { pctExtra: 0, fixedBRL: 0, affiliate: { shopee: 0, ml: 0, tiktok: 0, amazon: 0 }, details: { ads: { pct: 0, brl: 0 }, ret: { pct: 0, brl: 0 }, other: { pct: 0, brl: 0 }, costFixed: { pct: 0, brl: 0 }, difal: 0, pis: 0, cofins: 0, aff: { shopee: 0, ml: 0, tiktok: 0, amazon: 0 } } },
      weightData: resolveMarketplaceWeight({ enabled: false, rawValue: "", unit: "kg" })
    }
  }).computedResults;
  renderResultInsight(basicResults, computedResults);

  renderSamePriceComparison(state);
  renderCurrentPriceAnalysis(state);
  renderScaleSimulation(state);
  renderShareActions();
  updateLeadCaptureAfterRecalc({
    shouldDisplay: cost > 0,
    computedResults
  });
  updateReportRoot();
  trackPerfilTicket(shopee.price);
  trackGA4Event("recalc", { section: source || "auto", value: Number(shopee.price || 0) });


  const y = document.querySelector("#year");
  if (y) y.textContent = String(new Date().getFullYear());

}


function getCurrentPriceInputElement(marketplaceKey) {
  const inputId = CURRENT_PRICE_MARKETPLACE_INPUTS[marketplaceKey];
  return inputId ? document.querySelector(`#${inputId}`) : null;
}

function setCurrentPriceVisibility(samePrice) {
  const globalBlock = document.querySelector("#currentPriceGlobalBlock");
  const byMarketplaceBlock = document.querySelector("#currentPriceByMarketplace");
  globalBlock?.classList.toggle("is-hidden", !samePrice);
  byMarketplaceBlock?.classList.toggle("is-hidden", samePrice);
}

function saveCurrentPriceState() {
  const toggle = document.querySelector("#currentSamePriceToggle");
  const globalInput = document.querySelector("#currentPriceInput");

  localStorage.setItem(CURRENT_SAME_PRICE_KEY, toggle?.checked ? "1" : "0");
  localStorage.setItem(CURRENT_PRICE_GLOBAL_KEY, globalInput?.value?.trim() || "");

  const byMarketplace = Object.entries(CURRENT_PRICE_MARKETPLACE_INPUTS).reduce((acc, [key, inputId]) => {
    acc[key] = document.querySelector(`#${inputId}`)?.value?.trim() || "";
    return acc;
  }, {});

  localStorage.setItem(CURRENT_PRICE_BY_MKT_KEY, JSON.stringify(byMarketplace));
}

function loadCurrentPriceState() {
  const toggle = document.querySelector("#currentSamePriceToggle");
  const globalInput = document.querySelector("#currentPriceInput");
  if (!toggle || !globalInput) return;

  const samePriceStored = localStorage.getItem(CURRENT_SAME_PRICE_KEY);
  toggle.checked = samePriceStored !== "0";
  toggle.setAttribute("aria-checked", toggle.checked ? "true" : "false");

  globalInput.value = localStorage.getItem(CURRENT_PRICE_GLOBAL_KEY) || globalInput.value || "";

  let byMarketplace = {};
  try {
    byMarketplace = JSON.parse(localStorage.getItem(CURRENT_PRICE_BY_MKT_KEY) || "{}");
  } catch (error) {
    byMarketplace = {};
  }

  Object.entries(CURRENT_PRICE_MARKETPLACE_INPUTS).forEach(([key, inputId]) => {
    const input = document.querySelector(`#${inputId}`);
    if (!input) return;
    input.value = typeof byMarketplace[key] === "string" ? byMarketplace[key] : "";
  });

  setCurrentPriceVisibility(toggle.checked);
}

function hasCurrentPriceValues(state) {
  const globalRaw = document.querySelector("#currentPriceInput")?.value?.trim() || "";
  if (globalRaw) return true;

  if (document.querySelector("#currentSamePriceToggle")?.checked) return false;

  return (state.marketplaces || []).some((mp) => (getCurrentPriceInputElement(mp.key)?.value?.trim() || "") !== "");
}

function getCurrentPriceForMarketplace(marketplaceKey) {
  const samePriceToggle = document.querySelector("#currentSamePriceToggle");
  const globalRaw = document.querySelector("#currentPriceInput")?.value || "";
  const globalPrice = parsePriceInput(globalRaw);

  if (!samePriceToggle || samePriceToggle.checked) return globalPrice;

  const marketplaceRaw = getCurrentPriceInputElement(marketplaceKey)?.value || "";
  if (String(marketplaceRaw).trim()) return parsePriceInput(marketplaceRaw);
  if (String(globalRaw).trim()) return globalPrice;
  return 0;
}

function syncCurrentPriceMarketplaceInputs(state) {
  const activeKeys = new Set((state.marketplaces || []).map((mp) => mp.key));

  document.querySelectorAll("[data-current-price-marketplace]").forEach((input) => {
    const key = input.getAttribute("data-current-price-marketplace");
    const field = input.closest(".field");
    if (!key || !field) return;
    if (key === "amazon") {
      field.classList.toggle("is-hidden", !activeKeys.has("amazon"));
      return;
    }
    field.classList.remove("is-hidden");
  });
}

function renderSamePriceComparison(state) {
  const wrap = document.querySelector("#samePriceResults");
  if (!wrap) return;

  const samePrice = Math.max(0, toNumber(document.querySelector("#samePriceInput")?.value));
  if (!samePrice) {
    wrap.innerHTML = "";
    return;
  }

  const cards = state.marketplaces.map((mp) => {
    const analysis = calculateMarketplaceAtPrice({
      price: samePrice,
      cost: state.cost,
      taxPct: state.taxPct,
      marketplacePct: mp.marketplacePct,
      marketplaceFixed: mp.marketplaceFixed,
      percentCosts: mp.percentCosts,
      fixedCosts: mp.fixedCosts,
      applyAntecipa: mp.key === "shopee" ? state.shopeeAntecipa : false
    });

    return compareCardHTML(mp.title, analysis);
  });

  wrap.innerHTML = cards.join("");
}

function renderCurrentPriceAnalysis(state) {
  const wrap = document.querySelector("#currentPriceResults");
  const hint = document.querySelector("#currentPriceHint");
  if (!wrap) return;

  syncCurrentPriceMarketplaceInputs(state);

  const samePriceMode = document.querySelector("#currentSamePriceToggle")?.checked !== false;
  const hasAnyPrice = hasCurrentPriceValues(state);

  hint?.classList.toggle("is-hidden", hasAnyPrice);

  const cards = state.marketplaces.map((mp) => {
    const analysis = calculateMarketplaceAtPrice({
      price: getCurrentPriceForMarketplace(mp.key),
      cost: state.cost,
      taxPct: state.taxPct,
      marketplacePct: mp.marketplacePct,
      marketplaceFixed: mp.marketplaceFixed,
      percentCosts: mp.percentCosts,
      fixedCosts: mp.fixedCosts,
      applyAntecipa: mp.key === "shopee" ? state.shopeeAntecipa : false
    });

    return compareCardHTML(mp.title, analysis);
  });

  wrap.innerHTML = cards.join("");
  trackGA4Event("current_profit_calculate", { mode: samePriceMode ? "global" : "per_marketplace" });
}

function renderScaleSimulation(state) {
  const wrap = document.querySelector("#scaleResults");
  if (!wrap) return;

  const qty = Math.max(0, Math.floor(toNumber(document.querySelector("#scaleSalesQty")?.value)));
  if (!qty) {
    wrap.innerHTML = "";
    return;
  }

  trackGA4Event("scale_simulation_used", { qty });

  const cards = (state.computedResults || []).map((item) => `
    <article class="compareCard">
      <div class="compareCard__title">${item.title}</div>
      <div class="compareCard__rows">
        <div class="k">Com ${qty} vendas</div><div class="v">${brl((item.profitBRL || 0) * qty)}</div>
      </div>
    </article>
  `);

  wrap.innerHTML = cards.join("");
}

function getShareableState() {
  const data = {};
  document.querySelectorAll("input[id], select[id], textarea[id]").forEach((el) => {
    if (el.type === "button" || el.type === "submit") return;
    data[el.id] = el.type === "checkbox" ? !!el.checked : el.value;
  });
  return data;
}

function applySharedState(data) {
  if (!data || typeof data !== "object") return;

  Object.entries(data).forEach(([id, value]) => {
    const el = document.querySelector(`#${id}`);
    if (!el) return;
    if (typeof value === "boolean") {
      el.checked = value;
    } else {
      el.value = value;
    }
  });
}

function renderShareActions() {
  const shareBox = document.querySelector("#shareBox");
  if (!shareBox) return;

  shareBox.innerHTML = `
    <div class="shareBox__title">Compartilhar</div>
    <div class="shareBox__actions">
      <button class="btn btn--ghost" type="button" data-action="share-whatsapp" data-from="results-share-box">WhatsApp</button>
      <button class="btn btn--ghost" type="button" data-action="copy-link" data-from="results-share-box">Copiar link</button>
    </div>
  `;
}


const leadCaptureState = {
  dismissed: sessionStorage.getItem(LEAD_CAPTURE_SESSION_KEY) === "1",
  status: "idle",
  result: { precoMinimo: 0, precoIdeal: 0 },
  marketplace: "unknown",
  marketplacePrices: [],
  utm: { utm_source: "", utm_medium: "", utm_campaign: "", utm_content: "", utm_term: "" }
};

function getUTMData() {
  const params = new URLSearchParams(window.location.search || "");
  return {
    utm_source: params.get("utm_source") || "",
    utm_medium: params.get("utm_medium") || "",
    utm_campaign: params.get("utm_campaign") || "",
    utm_content: params.get("utm_content") || "",
    utm_term: params.get("utm_term") || ""
  };
}

function isValidLeadEmail(email) {
  const normalized = String(email || "").trim();
  if (!normalized || !normalized.includes("@") || !normalized.includes(".")) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(normalized);
}

function setLeadCaptureStatus(status, message = "") {
  leadCaptureState.status = status;
  const block = document.querySelector(`#${LEAD_CAPTURE_BLOCK_ID}`);
  if (!block) return;

  const submitBtn = block.querySelector('[data-action="submit-lead"]');
  const feedback = block.querySelector('.leadCapture__feedback');

  block.setAttribute("data-status", status);
  if (submitBtn) {
    submitBtn.disabled = status === "loading" || status === "success";
    submitBtn.classList.toggle("is-loading", status === "loading");
    submitBtn.textContent = status === "loading" ? "Enviando..." : "Receber PDF por e-mail";
  }

  if (feedback) {
    feedback.textContent = message;
    feedback.classList.toggle("is-hidden", !message);
  }
}

async function submitLeadCaptureForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const nameInput = form.querySelector('input[name="nome"]');
  const emailInput = form.querySelector('input[name="email"]');
  const companyInput = form.querySelector('input[name="company"]');

  const nome = String(nameInput?.value || "").trim().slice(0, 120);
  const email = String(emailInput?.value || "").trim();
  const company = String(companyInput?.value || "").trim();

  if (!isValidLeadEmail(email)) {
    setLeadCaptureStatus("error", "Informe um email válido para receber o PDF.");
    emailInput?.focus();
    return;
  }

  const payload = {
    nome,
    email,
    company,
    marketplace: leadCaptureState.marketplace || "unknown",
    resultado: {
      precoMinimo: leadCaptureState.result.precoMinimo || 0,
      precoIdeal: leadCaptureState.result.precoIdeal || 0,
      marketplaces: leadCaptureState.marketplacePrices
    },
    utm: { ...leadCaptureState.utm },
    page_url: window.location.href,
    user_agent: navigator.userAgent
  };

  try {
    setLeadCaptureStatus("loading");
    const response = await fetch("/api/lead.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json().catch(() => ({}));
    if (data && data.success === false) {
      throw new Error(data.message || "lead_not_saved");
    }

    setLeadCaptureStatus("success", "Pronto! PDF enviado para seu email com os preços ideais.");

    if (typeof window.gtag === "function") {
      window.gtag("event", "generate_lead", {
        method: "email_capture",
        marketplace: leadCaptureState.marketplace || "unknown"
      });
    }
  } catch (error) {
    console.error("[lead-capture] erro ao enviar lead", error);
    setLeadCaptureStatus("error", "Não foi possível registrar agora. Tente novamente em instantes.");
  }
}

function dismissLeadCapture() {
  const block = document.querySelector(`#${LEAD_CAPTURE_BLOCK_ID}`);
  if (block) block.classList.add("is-hidden");
  leadCaptureState.dismissed = true;
  sessionStorage.setItem(LEAD_CAPTURE_SESSION_KEY, "1");
}

function ensureLeadCaptureBlock() {
  const resultsEl = document.querySelector("#results");
  if (!resultsEl) return null;

  let block = document.querySelector(`#${LEAD_CAPTURE_BLOCK_ID}`);
  if (!block) {
    block = document.createElement("section");
    block.id = LEAD_CAPTURE_BLOCK_ID;
    block.className = "leadCapture is-hidden";
    block.innerHTML = `
      <div class="leadCapture__head">
        <div>
          <h3>Quer salvar esse cálculo?</h3>
          <p>Receba no seu email o PDF com os preços ideais por marketplace, custos e taxas. 100% gratuito.</p>
        </div>
        <button class="leadCapture__close" type="button" aria-label="Fechar captura" data-action="dismiss-lead">✕</button>
      </div>
      <form class="leadCapture__form" novalidate>
        <div class="leadCapture__grid">
          <input type="text" name="nome" maxlength="120" placeholder="Nome (opcional)" autocomplete="name" />
          <input type="email" name="email" required placeholder="Seu melhor email" autocomplete="email" />
        </div>
        <input class="leadCapture__honeypot" type="text" name="company" tabindex="-1" autocomplete="off" aria-hidden="true" />
        <button class="btn btn--primary" type="submit" data-action="submit-lead">Receber PDF por e-mail</button>
        <p class="leadCapture__feedback is-hidden" aria-live="polite"></p>
      </form>
    `;
    resultsEl.insertAdjacentElement("afterend", block);

    block.querySelector("form")?.addEventListener("submit", submitLeadCaptureForm);
    block.querySelector('[data-action="dismiss-lead"]')?.addEventListener("click", dismissLeadCapture);
  }

  return block;
}

function updateLeadCaptureAfterRecalc({ shouldDisplay = false, computedResults = [] } = {}) {
  leadCaptureState.utm = getUTMData();

  const sortedByPrice = [...computedResults]
    .filter((item) => Number.isFinite(item?.price))
    .sort((a, b) => (a.price || 0) - (b.price || 0));

  const sortedByProfit = [...computedResults]
    .filter((item) => Number.isFinite(item?.profitBRL))
    .sort((a, b) => (b.profitBRL || 0) - (a.profitBRL || 0));

  leadCaptureState.result.precoMinimo = sortedByPrice[0]?.price || 0;
  leadCaptureState.result.precoIdeal = sortedByProfit[0]?.price || 0;
  leadCaptureState.marketplace = sortedByProfit[0]?.key || "unknown";
  leadCaptureState.marketplacePrices = computedResults
    .filter((item) => Number.isFinite(item?.price))
    .map((item) => ({
      key: item.key || "unknown",
      title: item.title || item.key || "Marketplace",
      precoIdeal: Number(item.price) || 0,
      lucro: Number(item.profitBRL) || 0,
      margem: Number(item.marginPct) || 0
    }));

  const block = ensureLeadCaptureBlock();
  if (!block) return;

  if (leadCaptureState.dismissed || !shouldDisplay) {
    block.classList.add("is-hidden");
    return;
  }

  if (leadCaptureState.status !== "success") {
    setLeadCaptureStatus("idle");
  }

  block.classList.remove("is-hidden");
}

/* ===== Bindings ===== */


function buildShareLink() {
  const custo = encodeURIComponent(document.querySelector("#cost")?.value || "");
  const imposto = encodeURIComponent(document.querySelector("#tax")?.value || "");
  const lucro = encodeURIComponent(document.querySelector("#profitValue")?.value || "");
  return `${window.location.origin}${window.location.pathname}?custo=${custo}&imposto=${imposto}&lucro=${lucro}`;
}

function bindActionButtons() {
  document.addEventListener("click", async (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;

    const action = target.getAttribute("data-action");

    try {
      if (action === "focus-lead-capture") {
        event.preventDefault();
        const block = ensureLeadCaptureBlock();
        if (block) {
          block.classList.remove("is-hidden");
          block.scrollIntoView({ behavior: "smooth", block: "center" });
          const emailField = block.querySelector('input[name="email"]');
          if (emailField) {
            setTimeout(() => emailField.focus(), 280);
          }
        }
        return;
      }

      if (action === "share-whatsapp") {
        event.preventDefault();
        const link = buildShareLink();
        const text = encodeURIComponent(`Simulei minha precificação aqui: ${link}`);
        window.open(`https://wa.me/?text=${text}`, "_blank", "noopener");
        trackGA4Event("share_whatsapp", { section: target.id || target.dataset.from || "results", value: "whatsapp" });
        return;
      }

      if (action === "copy-link") {
        event.preventDefault();
        const link = buildShareLink();
        try {
          await navigator.clipboard.writeText(link);
          alert("Link copiado com sucesso.");
          trackGA4Event("copy_link", { section: target.dataset.from || "results" });
        } catch {
          prompt("Copie o link:", link);
        }
        return;
      }

      if (action === "cta-instagram") {
        trackGA4Event("click_instagram", { section: target.closest(".topbar") ? "topbar" : "footer" });
        return;
      }

      if (action === "cta-whatsapp-community") {
        trackGA4Event("click_whatsapp", { section: target.closest(".topbar") ? "topbar" : "footer" });
      }

      if (action === "cta-specialist") {
        trackGA4Event("click_specialist", { section: target.dataset.from || "unknown" });
      }
    } catch (error) {
      logActionError(`falha em ${action}`, error);
    }
  });
}

function bindMobileMenu() {
  const toggle = document.querySelector("#mobileMenuToggle");
  const nav = document.querySelector("#topbarNav");
  if (!toggle || !nav) return;

  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });

  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });
}

function bindInputTracking() {
  const timers = new Map();
  const relevantEngagementIds = new Set([
    "cost",
    "tax",
    "profitType",
    "profitValue",
    "mlClassicPct",
    "mlPremiumPct",
    "mlWeightToggle",
    "mlWeightValue",
    "mlWeightUnit",
    "sheinCategory",
    "amazonDbaToggle",
    "amazonPct",
    "amazonOriginGroup",
    "samePriceInput",
    "currentPriceInput",
    "currentSamePriceToggle",
    "currentPriceShopee",
    "currentPriceMlClassic",
    "currentPriceMlPremium",
    "currentPriceTiktok",
    "currentPriceShein",
    "currentPriceAmazon"
  ]);

  const handleEngagement = (event) => {
    const target = event.target;
    if (!target || !target.id) return;
    if (!relevantEngagementIds.has(target.id)) return;
    trackEngaged();
  };

  document.addEventListener("input", handleEngagement);
  document.addEventListener("change", handleEngagement);

  document.addEventListener("input", (event) => {
    const field = INPUT_EVENT_FIELDS[event.target?.id];
    if (!field) return;
    if (timers.has(field)) clearTimeout(timers.get(field));
    timers.set(field, setTimeout(() => {
      track("input_change", { section: "inputs", value: field });
    }, 2000));
  });
}


function setInlineBoxVisibility(box, show) {
  if (!box) return;
  box.classList.add("optionalInlineBox");

  if (show) {
    box.classList.remove("is-hidden");
    window.requestAnimationFrame(() => box.classList.add("is-open"));
    return;
  }

  box.classList.remove("is-open");
  window.setTimeout(() => {
    if (!box.classList.contains("is-open")) {
      box.classList.add("is-hidden");
    }
  }, 220);
}

function bind() {
  const $ = (s) => document.querySelector(s);

  const scrollToResults = () => {
    const results = $("#results");
    scrollToWithTopbarOffset(results);
  };


  $("#recalc")?.addEventListener("click", () => {
    recalc({ source: "manual" });
    const hasWeight = !!document.querySelector("#mlWeightToggle")?.checked;
    const hasAffiliate = !!(document.querySelector("#advToggle")?.checked && document.querySelector("#affToggle")?.checked);
    trackGA4Event("recalc", { section: "button", value: "manual", has_weight: hasWeight, has_affiliate: hasAffiliate });
    scrollToResults();
  });

  $("#saveSimulation")?.addEventListener("click", () => {
    const items = getSavedSimulations();
    const payload = {
      name: document.querySelector("#calcName")?.value?.trim() || `Simulação ${new Date().toLocaleString("pt-BR")}`,
      cost: document.querySelector("#cost")?.value || "",
      tax: document.querySelector("#tax")?.value || "",
      profitValue: document.querySelector("#profitValue")?.value || "",
      incidences: {
        mlClassicPct: document.querySelector("#mlClassicPct")?.value || "",
        mlPremiumPct: document.querySelector("#mlPremiumPct")?.value || ""
      }
    };
    items.unshift(payload);
    localStorage.setItem(SAVED_SIMULATIONS_KEY, JSON.stringify(items.slice(0, 20)));
    renderSavedSimulations();
    trackGA4Event("save_simulation", { total: items.length });
  });

  $("#savedSimulations")?.addEventListener("change", (event) => {
    const idx = Number(event.target.value);
    if (!Number.isFinite(idx) || idx < 0) return;
    const item = getSavedSimulations()[idx];
    if (!item) return;
    document.querySelector("#cost").value = item.cost;
    document.querySelector("#tax").value = item.tax;
    document.querySelector("#profitValue").value = item.profitValue;
    document.querySelector("#mlClassicPct").value = item.incidences?.mlClassicPct || "14";
    document.querySelector("#mlPremiumPct").value = item.incidences?.mlPremiumPct || "19";
    recalc({ source: "auto" });
  });

  // Auto recalcular em input/change
  document.querySelectorAll("#sec-precificacao input, #sec-precificacao select").forEach((el) => {
    el.addEventListener("input", () => recalc({ source: "auto" }));
    el.addEventListener("change", () => recalc({ source: "auto" }));
  });

  document.querySelector("#results")?.addEventListener("change", (event) => {
    const target = event.target;
    if (target && target.id === "shopeeAntecipa") {
      trackGA4Event("antecipa_toggle", { enabled: !!target.checked });
      recalc({ source: "auto" });
    }
  });


  document.querySelector("#results")?.addEventListener("toggle", (event) => {
    const details = event.target;
    if (!(details instanceof HTMLDetailsElement) || !details.classList.contains("resultAccordion")) return;
    const marketplace = details.querySelector(".cardTitle")?.textContent?.trim() || "unknown";
    trackGA4Event(details.open ? "open_marketplace_result" : "close_marketplace_result", { section: "results", marketplace });
  });

  document.querySelector("#results")?.addEventListener("click", (event) => {
    const compBar = event.target.closest(".comp-bar");
    if (compBar) {
      const card = compBar.closest(".marketplaceCard");
      const tip = card?.querySelector(".comp-tip");
      if (tip) {
        const shouldOpen = tip.hidden;
        tip.hidden = !shouldOpen;
        tip.textContent = shouldOpen ? (compBar.getAttribute("data-composition-tip") || "") : "";
      }
      trackGA4Event("composition_click");
      return;
    }

    const toggle = event.target.closest(".incidenceToggle");
    if (!toggle) return;
    const panelId = toggle.getAttribute("aria-controls");
    const panel = panelId ? document.getElementById(panelId) : null;
    if (!panel) return;
    const expanded = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", expanded ? "false" : "true");
    panel.classList.toggle("is-open", !expanded);
    panel.setAttribute("aria-hidden", expanded ? "true" : "false");
    const card = toggle.closest(".marketplaceCard");
    const marketplace = card?.querySelector(".cardTitle")?.textContent?.trim() || "unknown";
    trackGA4Event(expanded ? "close_incidences" : "open_incidences", { section: "results", marketplace });
  });

  document.querySelector("#results")?.addEventListener("mouseover", (event) => {
    const compBar = event.target.closest(".comp-bar");
    if (!compBar) return;
    const card = compBar.closest(".marketplaceCard");
    const tip = card?.querySelector(".comp-tip");
    if (!tip) return;
    tip.hidden = false;
    tip.textContent = compBar.getAttribute("data-composition-tip") || "";
  });

  document.querySelector("#results")?.addEventListener("mouseout", (event) => {
    const compBar = event.target.closest(".comp-bar");
    if (!compBar) return;
    const tip = compBar.closest(".marketplaceCard")?.querySelector(".comp-tip");
    if (!tip || window.matchMedia("(hover: none)").matches) return;
    tip.hidden = true;
    tip.textContent = "";
  });

  const profitType = $("#profitType");
  const profitValue = $("#profitValue");
  const profitValueBRL = $("#profitValueBRL");
  const profitValuePct = $("#profitValuePct");
  const profitFieldBRL = $("#profitFieldBRL");
  const profitFieldPCT = $("#profitFieldPCT");

  const syncProfitValue = () => {
    if (!profitType || !profitValue) return;
    const selected = document.querySelector('input[name="profitMode"]:checked')?.value || "brl";
    profitType.value = selected;
    if (selected === "pct") {
      if (profitValuePct && profitValue) profitValuePct.value = profitValue.value || profitValuePct.value;
      if (profitFieldBRL) profitFieldBRL.classList.add("is-hidden");
      if (profitFieldPCT) profitFieldPCT.classList.remove("is-hidden");
      if (profitValuePct) profitValue.value = profitValuePct.value;
      return;
    }
    if (profitValueBRL && profitValue) profitValueBRL.value = profitValue.value || profitValueBRL.value;
    if (profitFieldPCT) profitFieldPCT.classList.add("is-hidden");
    if (profitFieldBRL) profitFieldBRL.classList.remove("is-hidden");
    if (profitValueBRL) profitValue.value = profitValueBRL.value;
  };

  document.querySelectorAll('input[name="profitMode"]').forEach((input) => {
    input.addEventListener("change", syncProfitValue);
  });

  profitValueBRL?.addEventListener("input", () => {
    if (profitType?.value === "brl" && profitValue) profitValue.value = profitValueBRL.value;
  });

  profitValuePct?.addEventListener("input", () => {
    if (profitType?.value === "pct" && profitValue) profitValue.value = profitValuePct.value;
  });

  syncProfitValue();

  const mlCommissionToggle = $("#mlCommissionToggle");
  const mlCommissionBox = $("#mlCommissionBox");
  const applyMlCommissionBox = () => {
    if (!mlCommissionToggle || !mlCommissionBox) return;
    setInlineBoxVisibility(mlCommissionBox, mlCommissionToggle.checked);
  };
  mlCommissionToggle?.addEventListener("change", applyMlCommissionBox);
  applyMlCommissionBox();

  const sheinCommissionToggle = $("#sheinCommissionToggle");
  const sheinCommissionBox = $("#sheinCommissionBox");
  const applySheinCommissionBox = () => {
    if (!sheinCommissionToggle || !sheinCommissionBox) return;
    setInlineBoxVisibility(sheinCommissionBox, sheinCommissionToggle.checked);
  };
  sheinCommissionToggle?.addEventListener("change", applySheinCommissionBox);
  applySheinCommissionBox();

  // Mostrar/esconder box avançadas
  const advToggle = $("#advToggle");
  const advBox = $("#advBox");
  const applyAdvBox = () => {
    if (!advToggle || !advBox) return;
    setInlineBoxVisibility(advBox, advToggle.checked);
  };
  advToggle?.addEventListener("change", applyAdvBox);
  applyAdvBox();

  // Afiliados box
  const affToggle = $("#affToggle");
  const affBox = $("#affBox");
  const applyAffBox = () => {
    if (!affToggle || !affBox) return;
    setInlineBoxVisibility(affBox, affToggle.checked);
  };
  affToggle?.addEventListener("change", applyAffBox);
  applyAffBox();

  // Peso box
  const wToggle = $("#mlWeightToggle");
  const wBox = $("#mlWeightBox");
  const applyWBox = () => {
    if (!wToggle || !wBox) return;
    setInlineBoxVisibility(wBox, wToggle.checked);
  };
  wToggle?.addEventListener("change", applyWBox);
  applyWBox();

  const amazonToggle = $("#amazonDbaToggle");
  const amazonBox = $("#amazonDbaBox");
  const applyAmazonBox = () => {
    if (!amazonToggle || !amazonBox) return;
    setInlineBoxVisibility(amazonBox, amazonToggle.checked);
  };
  amazonToggle?.addEventListener("change", () => {
    applyAmazonBox();
    trackGA4Event(amazonToggle.checked ? "amazon_toggle_on" : "amazon_toggle_off", { section: "inputs" });
  });

  $("#amazonOriginGroup")?.addEventListener("change", (event) => {
    trackGA4Event("amazon_origin_selected", { value: event.target.value || "sp_capital" });
  });

  $("#amazonPct")?.addEventListener("change", (event) => {
    trackGA4Event("amazon_pct_changed", { value: toNumber(event.target.value) || 0 });
  });

  applyAmazonBox();

  const currentSamePriceToggle = $("#currentSamePriceToggle");
  currentSamePriceToggle?.addEventListener("change", (event) => {
    const samePrice = !!event.target.checked;
    event.target.setAttribute("aria-checked", samePrice ? "true" : "false");
    setCurrentPriceVisibility(samePrice);
    saveCurrentPriceState();
    trackGA4Event("current_profit_toggle", { same_price: samePrice });
    recalc({ source: "auto" });
  });

  Object.entries(CURRENT_PRICE_MARKETPLACE_INPUTS).forEach(([marketplace, inputId]) => {
    const input = document.querySelector(`#${inputId}`);
    if (!input) return;

    input.addEventListener("input", () => saveCurrentPriceState());
    input.addEventListener("change", () => {
      saveCurrentPriceState();
      trackGA4Event("current_profit_input", { marketplace });
    });
  });

  $("#currentPriceInput")?.addEventListener("input", () => saveCurrentPriceState());
  $("#currentPriceInput")?.addEventListener("change", () => saveCurrentPriceState());
}


function getTriggerSelector(trigger) {
  return trigger?.getAttribute("data-target")
    || trigger?.getAttribute("data-scroll")
    || trigger?.getAttribute("href");
}

function getSegmentMenuButtons() {
  return Array.from(document.querySelectorAll('.segmentMenu__btn[data-target], .segmentMenu__btn[data-scroll]'));
}

function setActiveSegmentButton(selector) {
  if (!selector) return;
  getSegmentMenuButtons().forEach((button) => {
    button.classList.toggle("is-active", getTriggerSelector(button) === selector);
  });
}

function bindSegmentMenuActiveState() {
  const buttons = getSegmentMenuButtons();
  if (!buttons.length || !("IntersectionObserver" in window)) return;

  const observer = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

    if (visible?.target?.id) {
      setActiveSegmentButton(`#${visible.target.id}`);
    }
  }, { rootMargin: "-35% 0px -55% 0px", threshold: [0.2, 0.5, 0.8] });

  buttons.forEach((button) => {
    const selector = getTriggerSelector(button);
    const target = selector ? document.querySelector(selector) : null;
    if (target) observer.observe(target);
  });
}


function bindSmoothScroll() {
  const DEFAULT_SECTION = "#sec-precificacao";
  const sectionMap = {
    [DEFAULT_SECTION]: "precificacao"
  };

  const resolveSelector = (selector) => {
    if (!selector || !selector.startsWith("#")) return DEFAULT_SECTION;

    try {
      return document.querySelector(selector) ? selector : DEFAULT_SECTION;
    } catch (error) {
      logActionError(`Seletor inválido para scroll: ${selector}`, error);
      return DEFAULT_SECTION;
    }
  };

  const resolveAndScroll = (selector, { updateHash = true, replaceHash = false } = {}) => {
    const safeSelector = resolveSelector(selector);
    const target = document.querySelector(safeSelector);
    if (!target) return false;

    scrollToWithTopbarOffset(target);

    if (updateHash && window.location.hash !== safeSelector) {
      if (replaceHash && typeof window.history?.replaceState === "function") {
        window.history.replaceState(null, "", safeSelector);
      } else if (typeof window.history?.pushState === "function") {
        window.history.pushState(null, "", safeSelector);
      }
    }

    if (safeSelector in sectionMap) {
      setActiveSegmentButton(safeSelector);
    }

    return true;
  };

  document.querySelectorAll('a[href^="#"], [data-target^="#"], [data-scroll^="#"]').forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      const selector = getTriggerSelector(trigger);
      if (!selector || !selector.startsWith("#")) return;

      event.preventDefault();
      const safeSelector = resolveSelector(selector);
      resolveAndScroll(safeSelector, { updateHash: true });

      const section = sectionMap[safeSelector];
      if (section && trigger.classList.contains("segmentMenu__btn")) {
        trackGA4Event("click_tab", { section, value: "menu_top" });
      }
    });
  });

  resolveAndScroll(window.location.hash, { updateHash: true, replaceHash: true });

  window.addEventListener("popstate", () => {
    resolveAndScroll(window.location.hash, { updateHash: true, replaceHash: true });
  });
}




const UX_MARKETPLACES = [
  { key: "shopee", title: "Shopee", monogram: "S", brandClass: "brand-shopee" },
  { key: "mlClassic", title: "Mercado Livre — Clássico", monogram: "ML", brandClass: "brand-ml" },
  { key: "mlPremium", title: "Mercado Livre — Premium", monogram: "ML", brandClass: "brand-ml" },
  { key: "tiktok", title: "TikTok Shop", monogram: "♪", brandClass: "brand-tiktok" },
  { key: "shein", title: "SHEIN", monogram: "S", brandClass: "brand-shein" },
  { key: "amazon", title: "Amazon (DBA)", monogram: "a", brandClass: "brand-amazon" }
];

const MARKETPLACE_TITLE_TO_KEY = {
  "Shopee": "shopee",
  "Mercado Livre — Clássico": "mlClassic",
  "Mercado Livre — Premium": "mlPremium",
  "TikTok Shop": "tiktok",
  "SHEIN": "shein",
  "Amazon (DBA)": "amazon"
};

let UX_SELECTED_MARKETPLACES = UX_MARKETPLACES.map((mp) => mp.key);
const UX_PRICE_VALUES = {};
let UX_RECALC_TIMER = null;
let wizardStep = 0;

function getCalcMode() {
  return document.querySelector('input[name="calcMode"]:checked')?.value || "";
}

function getSelectedMarketplaces() {
  return UX_SELECTED_MARKETPLACES.filter((key) => document.querySelector(`#ux_mp_${key}`)?.checked);
}

function buildMarketplaceSelector() {
  const wrap = document.querySelector("#marketplaceSelector");
  if (!wrap) return;
  wrap.innerHTML = UX_MARKETPLACES.map((mp) => `
    <label class="marketplaceChip ${mp.brandClass || ""}" data-mp="${mp.key}" tabindex="0">
      <input class="marketplaceChip__input" type="checkbox" id="ux_mp_${mp.key}" value="${mp.key}" ${UX_SELECTED_MARKETPLACES.includes(mp.key) ? "checked" : ""} />
      <span class="mpLogoWrap ${mp.brandClass || ""}">
        <span class="mpMonogram" aria-hidden="true">${mp.monogram || "MP"}</span>
      </span>
      <span class="mpName">${mp.title}</span>
      <span class="mpCheck" aria-hidden="true"></span>
    </label>
  `).join("");
}

function renderMode1PriceInputs() {
  const wrap = document.querySelector("#mode1PriceInputs");
  if (!wrap) return;
  wrap.innerHTML = getSelectedMarketplaces().map((key) => {
    const mp = UX_MARKETPLACES.find((item) => item.key === key);
    return `
      <div class="field cardMini">
        <div class="label">Preço de venda — ${mp?.title || key}</div>
        <div class="inputWrap">
          <span class="inputPrefix">R$</span>
          <input type="number" step="0.01" min="0" data-ux-price-marketplace="${key}" value="${UX_PRICE_VALUES[key] || ""}" placeholder="Ex: 99,90" />
        </div>
      </div>
    `;
  }).join("");
}

function toggleUxModeSections() {
  const mode = getCalcMode();
  const hasMode = Boolean(mode);
  const mode1PriceSection = document.querySelector("#mode1PriceSection");
  const profitGoalSection = document.querySelector("#profitGoalSection");
  const hint = document.querySelector("#calcModeMicrocopy");

  if (!hasMode) {
    mode1PriceSection?.classList.add("is-hidden");
    profitGoalSection?.classList.add("is-hidden");
    if (hint) hint.textContent = "";
    return;
  }

  const isStep2 = wizardStep === 2;
  const isStep3 = wizardStep === 3;
  mode1PriceSection?.classList.toggle("is-hidden", !(mode === "real" && isStep2));
  profitGoalSection?.classList.toggle("is-hidden", !(mode === "ideal" && isStep3));
  const heading = document.querySelector("#profitGoalHeading");
  if (heading) heading.textContent = "Margem desejada";

  if (hint) {
    hint.textContent = mode === "real"
      ? "Preço pode variar por marketplace. Preencha o valor correspondente a cada canal."
      : "Vamos calcular o preço ideal por marketplace com base na margem informada.";
  }
}

function validateStep(step) {
  if (step === 1) {
    return getSelectedMarketplaces().length > 0;
  }
  return true;
}

function applyWizardResultFilter() {
  const selected = new Set(getSelectedMarketplaces());
  document.querySelectorAll("#results .marketplaceCard").forEach((card) => {
    const title = card.querySelector(".cardTitle")?.textContent?.trim() || "";
    const key = MARKETPLACE_TITLE_TO_KEY[title];
    if (!key) {
      card.classList.remove("is-hidden");
      return;
    }
    card.classList.toggle("is-hidden", !selected.has(key));
  });
}

function setWizardStep(step) {
  wizardStep = clamp(step, 0, 4);
  renderWizardUI();
}

function renderWizardUI() {
  if (wizardStep === 0 && getCalcMode()) {
    wizardStep = 1;
  }

  if (!getCalcMode() && wizardStep > 0) {
    wizardStep = 0;
  }

  document.querySelectorAll(".wizardStep").forEach((el) => {
    const step = Number(el.dataset.step || 0);
    el.classList.toggle("is-hidden", step !== wizardStep);
  });

  const progress = document.querySelector("#wizardProgress");
  if (progress) progress.textContent = `Passo ${wizardStep} de 4`;

  const nextStep2 = document.querySelector("#wizardNextStep2");
  if (nextStep2) nextStep2.disabled = !validateStep(1);

  const resultsContainer = document.querySelector(".wizardResultsContainer");
  if (resultsContainer) {
    resultsContainer.classList.toggle("is-hidden", wizardStep !== 4);
  }

  const mode = getCalcMode();
  document.querySelectorAll(".modeCard").forEach((card) => {
    card.classList.toggle("is-selected", card.dataset.mode === mode);
  });

  toggleUxModeSections();

  if (wizardStep === 4) {
    applyWizardResultFilter();
  }
}

function handleNext() {
  if (wizardStep === 1 && !validateStep(1)) return;
  setWizardStep(wizardStep + 1);
}

function handleBack() {
  setWizardStep(wizardStep - 1);
}

function syncGlobalWeightToAdvancedAll() {
  const raw = (document.querySelector("#globalWeightInput")?.value || "").trim();
  const unit = document.querySelector("#globalWeightUnit")?.value || "kg";
  const mlWeightToggle = document.querySelector("#mlWeightToggle");
  const mlWeightValue = document.querySelector("#mlWeightValue");
  const mlWeightUnit = document.querySelector("#mlWeightUnit");
  if (!mlWeightToggle || !mlWeightValue || !mlWeightUnit) return;
  if (!raw) return;
  mlWeightToggle.checked = true;
  mlWeightValue.value = raw;
  mlWeightUnit.value = unit;
}

function uxRecalc() {
  syncGlobalWeightToAdvancedAll();
  recalc({ source: "auto" });
  toggleUxModeSections();
}

function debounceUxRecalc() {
  window.clearTimeout(UX_RECALC_TIMER);
  UX_RECALC_TIMER = window.setTimeout(() => uxRecalc(), 150);
}

function initUxRefactor() {
  buildMarketplaceSelector();
  renderMode1PriceInputs();

  const profitValuePct = document.querySelector("#profitValuePct");
  const metaPercent = document.querySelector("#meta_percent");
  if (profitValuePct && metaPercent) {
    profitValuePct.value = "10";
    metaPercent.checked = true;
    document.querySelector("#profitType").value = "pct";
    document.querySelector("#profitValue").value = "10";
    document.querySelector("#profitFieldBRL")?.classList.add("is-hidden");
    document.querySelector("#profitFieldPCT")?.classList.remove("is-hidden");
  }

  const selectCalcMode = (mode) => {
    if (!mode) return;
    const real = document.querySelector("#mode_real");
    const ideal = document.querySelector("#mode_ideal");
    if (mode === "real" && real) {
      real.checked = true;
      real.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (mode === "ideal" && ideal) {
      ideal.checked = true;
      ideal.dispatchEvent(new Event("change", { bubbles: true }));
    }
    setWizardStep(1);
  };

  const calcModeCards = document.querySelector("#calcModeCards");
  const handleCalcModeCardInteraction = (event) => {
    const card = event.target.closest?.(".modeCard");
    if (!card) return;
    selectCalcMode(card.dataset.mode);
  };

  calcModeCards?.addEventListener("click", handleCalcModeCardInteraction);
  calcModeCards?.addEventListener("pointerup", handleCalcModeCardInteraction);

  document.querySelector("#mode1PriceInputs")?.addEventListener("input", (event) => {
    const input = event.target.closest("[data-ux-price-marketplace]");
    if (!input) return;
    UX_PRICE_VALUES[input.dataset.uxPriceMarketplace] = input.value;
    debounceUxRecalc();
  });

  document.querySelector("#marketplaceSelector")?.addEventListener("change", () => {
    UX_SELECTED_MARKETPLACES = UX_MARKETPLACES.map((mp) => mp.key).filter((key) => document.querySelector(`#ux_mp_${key}`)?.checked);
    renderMode1PriceInputs();
    renderWizardUI();
    uxRecalc();
  });

  document.querySelector("#marketplaceSelector")?.addEventListener("keydown", (event) => {
    const chip = event.target.closest('.marketplaceChip');
    const checkbox = chip?.querySelector('.marketplaceChip__input[type="checkbox"]');
    const isToggleKey = event.key === "Enter" || event.key === " " || event.code === "Space";
    if (!checkbox || !isToggleKey) return;
    event.preventDefault();
    checkbox.checked = !checkbox.checked;
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));
  });

  document.querySelectorAll('input[name="calcMode"]').forEach((el) => el.addEventListener("change", () => {
    if (wizardStep === 0 && getCalcMode()) {
      setWizardStep(1);
      return;
    }
    toggleUxModeSections();
    renderWizardUI();
  }));

  ["#cost", "#tax", "#globalWeightInput", "#profitValueBRL", "#profitValuePct"].forEach((selector) => {
    document.querySelector(selector)?.addEventListener("input", debounceUxRecalc);
  });
  document.querySelector("#globalWeightUnit")?.addEventListener("change", uxRecalc);

  document.querySelector("#wizardBackStep2")?.addEventListener("click", handleBack);
  document.querySelector("#wizardNextStep2")?.addEventListener("click", () => {
    if (!validateStep(1)) return;
    setWizardStep(2);
  });
  document.querySelector("#wizardBackStepData")?.addEventListener("click", handleBack);
  document.querySelector("#wizardNextStepData")?.addEventListener("click", () => setWizardStep(3));
  document.querySelector("#wizardBackStep3")?.addEventListener("click", handleBack);
  document.querySelector("#wizardEditData")?.addEventListener("click", () => setWizardStep(3));
  document.querySelector("#wizardNewCalc")?.addEventListener("click", () => {
    document.querySelectorAll('input[name="calcMode"]').forEach((el) => {
      el.checked = false;
    });
    setWizardStep(0);
  });


  document.querySelector("#recalc")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    syncGlobalWeightToAdvancedAll();
    recalc({ source: "manual" });
    applyWizardResultFilter();
    setWizardStep(4);
  });

  document.querySelectorAll('input[name="calcMode"]').forEach((el) => {
    el.checked = false;
  });

  uxRecalc();
  setWizardStep(0);
  renderWizardUI();
  window.setTimeout(() => {
    setWizardStep(0);
    renderWizardUI();
  }, 0);
}

function initApp() {
  const params = new URLSearchParams(window.location.search);
  const sharedState = params.get("state");

  if (sharedState) {
    try {
      applySharedState(JSON.parse(decodeURIComponent(sharedState)));
    } catch (error) {
      console.error("Erro ao ler estado compartilhado:", error);
    }
  }

  applySimpleShareParams();
  initTheme();
  initUxRefactor();
  loadCurrentPriceState();
  bind();
  bindActionButtons();
  bindMobileMenu();
  bindInputTracking();
  bindTooltipSystem();
  bindSmoothScroll();
  bindSegmentMenuActiveState();
  bindBulk();
  renderSavedSimulations();
  track("session_ready", { device: getDeviceType() });
  uxRecalc();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
