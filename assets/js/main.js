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

  const affOn = advOn && document.querySelector("#affToggle")?.checked;
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

function updateStickySummary(results) {
  const wrap = document.querySelector("#stickySummaryContent");
  if (!wrap) return;

  if (!Array.isArray(results) || !results.length) {
    wrap.textContent = "Preencha os dados para ver o resumo estratégico.";
    return;
  }

  const sorted = [...results].sort((a, b) => (b?.profitBRL || 0) - (a?.profitBRL || 0));
  const first = sorted[0];
  const second = sorted[1] || sorted[0];
  const diffPct = (first?.profitBRL || 0) > 0
    ? (((first?.profitBRL || 0) - (second?.profitBRL || 0)) / (first?.profitBRL || 1)) * 100
    : 0;

  let indicator = "🟡 Apertado";
  if (diffPct >= 10) indicator = "🟢 Saudável";
  if (diffPct < 3) indicator = "🔴 Risco";

  wrap.innerHTML = `
    <div><strong>Marketplace mais lucrativo:</strong> ${first.title}</div>
    <div><strong>Diferença percentual (1º x 2º):</strong> ${diffPct.toFixed(2)}%</div>
    <div><strong>Indicador:</strong> ${indicator}</div>
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
  return `
  <div class="card marketplaceCard resultCard ${options.marketplaceClass || ""}">
    <div class="cardHeader">
      <div class="cardTitleWrap">
        <span class="cardIcon" aria-hidden="true">${options.marketplaceIcon || "🛒"}</span>
        <div class="cardTitle">${title}</div>
      </div>
      <div class="pill">${pill}</div>
    </div>

    ${shopeeToggleHTML}

    <div class="heroBox">
      <div class="heroLabel">PREÇO IDEAL</div>
      <div class="heroValue">${price}</div>
    </div>

    <!-- RESUMO (sem repetir embaixo) -->
    <div class="resultGrid">
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

    <div id="${accordionId}" class="incidencePanel" aria-hidden="true">
      <div class="resultGrid resultGrid--details">
        ${itemsHTML}
      </div>
    </div>

    ${assumedWeightNoteHTML}
  </div>
  `;
}


/* ===== Main calc ===== */


function runExportPDF(from = "card", triggerButton = null) {
  const button = triggerButton instanceof HTMLElement ? triggerButton : null;
  const originalLabel = button ? button.innerHTML : "";

  if (button) {
    button.disabled = true;
    button.classList.add("is-loading");
    button.innerHTML = "Gerando relatório...";
    button.setAttribute("aria-busy", "true");
  }

  try {
    recalc({ source: "export" });
    if (typeof window.generatePDF === "function") {
      window.generatePDF();
      trackGA4Event("export_pdf", {
        section: from,
        value: window.innerWidth < 768 ? "mobile" : "desktop"
      });
      return;
    }
    logActionError("generatePDF indisponível");
  } catch (error) {
    logActionError("falha ao exportar PDF", error);
  } finally {
    if (button) {
      button.disabled = false;
      button.classList.remove("is-loading");
      button.innerHTML = originalLabel;
      button.removeAttribute("aria-busy");
    }
  }
}

async function shareFallback() {
  const summaryText = document.querySelector("#stickySummaryContent")?.innerText?.trim() || "Resumo indisponível.";
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

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeTooltip();
  });

  document.addEventListener("click", (event) => {
    if (!activeTrigger) return;
    if (event.target === activeTrigger || activeTrigger.contains(event.target)) return;
    closeTooltip();
  });
}

function bindStickySummaryVisibility() {
  const sticky = document.querySelector("#stickySummary");
  const closeBtn = document.querySelector("#stickyClose");
  const openBtn = document.querySelector("#stickyOpen");
  if (!sticky || !closeBtn || !openBtn) return;

  if (window.matchMedia("(max-width: 768px)").matches && localStorage.getItem("stickyHidden") === null) {
    localStorage.setItem("stickyHidden", "1");
  }

  const applyState = () => {
    const hidden = localStorage.getItem("stickyHidden") === "1";
    sticky.classList.toggle("is-hidden", hidden);
    openBtn.classList.toggle("is-visible", hidden);
  };

  closeBtn.addEventListener("click", () => {
    localStorage.setItem("stickyHidden", "1");
    applyState();
  });

  openBtn.addEventListener("click", () => {
    localStorage.setItem("stickyHidden", "0");
    applyState();
  });

  applyState();
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

function recalc(options = {}) {
  const source = options.source || "auto";
  const cost = Math.max(0, toNumber(document.querySelector("#cost")?.value));
  const taxPct = clamp(toNumber(document.querySelector("#tax")?.value), 0, 99); // ✅ ID correto: #tax

  const profitType = document.querySelector("#profitType")?.value || "brl";
  const profitValue = Math.max(0, toNumber(document.querySelector("#profitValue")?.value));

  const mlClassicPct = toNumber(document.querySelector("#mlClassicPct")?.value) / 100;
  const mlPremiumPct = toNumber(document.querySelector("#mlPremiumPct")?.value) / 100;

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
  const sheinCategory = document.querySelector("#sheinCategory")?.value || "other";
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

  const custoAntecipa = shopeeAntecipa ? Math.max(0, shopeeRaw.received) * 0.025 : 0;
  const liquidoFinalShopee = shopeeRaw.received - custoAntecipa;
  const shopee = {
    ...shopeeRaw,
    received: liquidoFinalShopee,
    profitBRL: shopeeRaw.profitBRL - custoAntecipa,
    profitPctReal: shopeeRaw.price > 0 ? (shopeeRaw.profitBRL - custoAntecipa) / shopeeRaw.price : 0
  };

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
    amazonOriginWrap.classList.toggle("hidden", !shouldShowOrigin);
  }

  const resultsEl = document.querySelector("#results");
  if (!resultsEl) return;

  resultsEl.innerHTML = [
    resultCardHTML(
      "Shopee",
      `${(shFee.pct * 100).toFixed(0)}% + ${brl(shFee.fixed)}`,
      shopee,
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
  renderSamePriceComparison(state);
  renderCurrentPriceAnalysis(state);
  renderScaleSimulation(state);
  renderShareActions();
  renderRankingInsights(computedResults);
  updateStickySummary([
    { title: "Shopee", received: shopee.received, profitBRL: shopee.profitBRL, profitPctReal: shopee.profitPctReal },
    { title: "TikTok Shop", received: tiktok.received, profitBRL: tiktok.profitBRL, profitPctReal: tiktok.profitPctReal },
    { title: "SHEIN", received: shein.received, profitBRL: shein.profitBRL, profitPctReal: shein.profitPctReal },
    ...(amazonDbaEnabled && amazonData ? [{ title: "Amazon (DBA)", received: amazonData.result.received, profitBRL: amazonData.result.profitBRL, profitPctReal: amazonData.result.profitPctReal }] : []),
    { title: "Mercado Livre — Clássico", received: mlClassic.r.received, profitBRL: mlClassic.r.profitBRL, profitPctReal: mlClassic.r.profitPctReal },
    { title: "Mercado Livre — Premium", received: mlPremium.r.received, profitBRL: mlPremium.r.profitBRL, profitPctReal: mlPremium.r.profitPctReal }
  ]);
  updateReportRoot();
  trackPerfilTicket(shopee.price);
  trackGA4Event("recalc", { section: source || "auto", value: Number(shopee.price || 0) });

  // Mostrar botão de PDF
  const pdfContainer = document.querySelector("#pdfButtonContainer");
  if (pdfContainer) {
    pdfContainer.innerHTML = `<button class="btn btn--ghost btn-export-pdf" data-action="export-pdf" data-from="card" type="button" style="width: 100%;">📥 Gerar Relatório</button>`;
  }


  const y = document.querySelector("#year");
  if (y) y.textContent = String(new Date().getFullYear());

  if (window.matchMedia("(max-width: 768px)").matches && source === "manual") {
    localStorage.setItem("stickyHidden", "0");
    const sticky = document.querySelector("#stickySummary");
    const openBtn = document.querySelector("#stickyOpen");
    sticky?.classList.remove("is-hidden");
    openBtn?.classList.remove("is-visible");
  }
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
  if (!wrap) return;

  const currentPrice = Math.max(0, toNumber(document.querySelector("#currentPriceInput")?.value));
  if (!currentPrice) {
    wrap.innerHTML = "";
    return;
  }

  const cards = state.marketplaces.map((mp) => {
    const analysis = calculateMarketplaceAtPrice({
      price: currentPrice,
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
      if (action === "export-pdf") {
        event.preventDefault();
        runExportPDF(target.getAttribute("data-from") || "card", target);
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
    "currentPriceInput"
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


function bind() {
  const $ = (s) => document.querySelector(s);

  const scrollToResults = () => {
    const results = $("#results");
    scrollToWithTopbarOffset(results);
  };

  $("#recalc")?.addEventListener("click", () => {
    recalc({ source: "manual" });
    const mode = document.querySelector("#advToggle")?.checked ? "advanced" : "basic";
    const hasWeight = !!document.querySelector("#mlWeightToggle")?.checked;
    const hasAffiliate = !!(document.querySelector("#advToggle")?.checked && document.querySelector("#affToggle")?.checked);
    trackGA4Event("recalc", { section: "button", value: mode, has_weight: hasWeight, has_affiliate: hasAffiliate });
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
  document.querySelectorAll("input, select").forEach((el) => {
    el.addEventListener("input", () => recalc({ source: "auto" }));
    el.addEventListener("change", () => recalc({ source: "auto" }));
  });

  document.querySelector("#results")?.addEventListener("change", (event) => {
    const target = event.target;
    if (target && target.id === "shopeeAntecipa") recalc({ source: "auto" });
  });

  document.querySelector("#results")?.addEventListener("click", (event) => {
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

  // Mostrar/esconder box avançadas
  const advToggle = $("#advToggle");
  const advBox = $("#advBox");
  const applyAdvBox = () => {
    if (!advToggle || !advBox) return;
    advBox.classList.toggle("hidden", !advToggle.checked);
  };
  advToggle?.addEventListener("change", applyAdvBox);
  applyAdvBox();

  // Afiliados box
  const affToggle = $("#affToggle");
  const affBox = $("#affBox");
  const applyAffBox = () => {
    if (!affToggle || !affBox) return;
    affBox.classList.toggle("hidden", !affToggle.checked);
  };
  affToggle?.addEventListener("change", applyAffBox);
  applyAffBox();

  // Peso box
  const wToggle = $("#mlWeightToggle");
  const wBox = $("#mlWeightBox");
  const applyWBox = () => {
    if (!wToggle || !wBox) return;
    wBox.classList.toggle("hidden", !wToggle.checked);
  };
  wToggle?.addEventListener("change", applyWBox);
  applyWBox();

  const amazonToggle = $("#amazonDbaToggle");
  const amazonBox = $("#amazonDbaBox");
  const applyAmazonBox = () => {
    if (!amazonToggle || !amazonBox) return;
    amazonBox.classList.toggle("hidden", !amazonToggle.checked);
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
}


function bindSegmentMenuActiveState() {
  const buttons = Array.from(document.querySelectorAll(".segmentMenu__btn[data-scroll]"));
  if (!buttons.length || !('IntersectionObserver' in window)) return;

  const setActive = (id) => {
    buttons.forEach((btn) => {
      btn.classList.toggle("is-active", btn.getAttribute("data-scroll") === `#${id}`);
    });
  };

  const observer = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (visible?.target?.id) setActive(visible.target.id);
  }, { rootMargin: "-35% 0px -55% 0px", threshold: [0.2, 0.5, 0.8] });

  buttons.forEach((btn) => {
    const targetSelector = btn.getAttribute("data-scroll");
    const target = targetSelector ? document.querySelector(targetSelector) : null;
    if (target) observer.observe(target);
  });
}


function bindSmoothScroll() {
  const sectionMap = {
    "#sec-precificacao": "precificacao",
    "#sec-comparar": "comparar_preco",
    "#sec-lucro-atual": "lucro_atual",
    "#sec-escala": "escala"
  };

  document.querySelectorAll("[data-scroll]").forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      const selector = trigger.getAttribute("data-scroll");
      if (!selector) return;
      const target = document.querySelector(selector);
      if (!target) return;
      scrollToWithTopbarOffset(target);
      if (typeof window.history?.replaceState === "function") {
        window.history.replaceState(null, "", selector);
      }
      const section = sectionMap[selector];
      if (section && trigger.classList.contains("segmentMenu__btn")) {
        trackGA4Event("click_tab", { section, value: "menu_top" });
      }
    });
  });
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
  bind();
  bindActionButtons();
  bindMobileMenu();
  bindInputTracking();
  bindTooltipSystem();
  bindStickySummaryVisibility();
  bindSmoothScroll();
  bindSegmentMenuActiveState();
  renderSavedSimulations();
  track("session_ready", { device: getDeviceType() });
  recalc({ source: "auto" });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
