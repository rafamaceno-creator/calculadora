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
  currentPriceInput: "price"
};

function track(eventName, params = {}) {
  if (typeof window.gtag === "function") {
    window.gtag("event", eventName, params);
  }
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
  track("usuario_engajado");
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

  track("perfil_ticket", {
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

function sheinFixedByWeight(weightKg) {
  const w = Math.max(0, Number(weightKg));
  for (const row of SHEIN.weightFixedTable) {
    if (w <= row.max) return row.fixed;
  }
  return SHEIN.weightFixedTable[SHEIN.weightFixedTable.length - 1].fixed;
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
    shein: affOn ? Math.max(0, toNumber(document.querySelector("#affShein")?.value)) / 100 : 0
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
  const items = [];

  const tax = Math.max(0, taxPct) / 100;
  const profitPct = profitType === "pct" ? Math.max(0, profitValue) / 100 : 0;

  // Comissão
  if ((marketplacePct || 0) > 0 || (marketplaceFixed || 0) > 0) {
    const commValue = Number.isFinite(price) ? price * (marketplacePct || 0) : 0;
    items.push({
      label: "Comissão",
      pct: marketplacePct || 0,
      brl: commValue + (Number.isFinite(marketplaceFixed) ? marketplaceFixed : 0)
    });
  }

  // Afiliados
  if ((affiliatePct || 0) > 0) {
    const affValue = Number.isFinite(price) ? price * affiliatePct : 0;
    items.push({
      label: "Afiliados",
      pct: affiliatePct,
      brl: affValue
    });
  }

  // Imposto
  if (tax > 0) {
    const impValue = Number.isFinite(price) ? price * tax : 0;
    items.push({
      label: "Imposto",
      pct: tax,
      brl: impValue
    });
  }

  // Lucro
  if (profitType === "brl") {
    const lucroValue = Math.max(0, profitValue);
    const lucroPctReal = Number.isFinite(price) && price > 0 ? (lucroValue / price) : 0;
    items.push({
      label: "Lucro",
      pct: lucroPctReal,
      brl: lucroValue
    });
  } else if (profitPct > 0) {
    const lucroValue = Number.isFinite(price) ? price * profitPct : 0;
    items.push({
      label: "Lucro",
      pct: profitPct,
      brl: lucroValue
    });
  }

  // Ads
  if (advDetails.ads.pct > 0 || advDetails.ads.brl > 0) {
    const adsValue = Number.isFinite(price) ? price * advDetails.ads.pct : 0;
    items.push({
      label: "Ads",
      pct: advDetails.ads.pct,
      brl: adsValue + advDetails.ads.brl
    });
  }

  // Devolução
  if (advDetails.ret.pct > 0 || advDetails.ret.brl > 0) {
    const retValue = Number.isFinite(price) ? price * advDetails.ret.pct : 0;
    items.push({
      label: "Devolução",
      pct: advDetails.ret.pct,
      brl: retValue + advDetails.ret.brl
    });
  }

  // Custo fixo
  if (advDetails.costFixed.pct > 0 || advDetails.costFixed.brl > 0) {
    const cfValue = Number.isFinite(price) ? price * advDetails.costFixed.pct : 0;
    items.push({
      label: "Custo fixo",
      pct: advDetails.costFixed.pct,
      brl: cfValue + advDetails.costFixed.brl
    });
  }

  // DIFAL
  if (advDetails.difal > 0) {
    const difalValue = Number.isFinite(price) ? price * advDetails.difal : 0;
    items.push({
      label: "DIFAL",
      pct: advDetails.difal,
      brl: difalValue
    });
  }

  // PIS
  if (advDetails.pis > 0) {
    const pisValue = Number.isFinite(price) ? price * advDetails.pis : 0;
    items.push({
      label: "PIS",
      pct: advDetails.pis,
      brl: pisValue
    });
  }

  // COFINS
  if (advDetails.cofins > 0) {
    const cofinsValue = Number.isFinite(price) ? price * advDetails.cofins : 0;
    items.push({
      label: "COFINS",
      pct: advDetails.cofins,
      brl: cofinsValue
    });
  }

  // Outro
  if (advDetails.other.pct > 0 || advDetails.other.brl > 0) {
    const otherValue = Number.isFinite(price) ? price * advDetails.other.pct : 0;
    items.push({
      label: "Outro",
      pct: advDetails.other.pct,
      brl: otherValue + advDetails.other.brl
    });
  }

  return items;
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
    wrap.textContent = "Preencha os dados para ver o resumo principal.";
    return;
  }

  const best = results.reduce((acc, item) => {
    if (!acc) return item;
    return (item.profitPctReal || 0) > (acc.profitPctReal || 0) ? item : acc;
  }, null);

  const status = marginStatus((best?.profitPctReal || 0) * 100);
  wrap.innerHTML = `
    <div><strong>${best.title}</strong></div>
    <div>Líquido: <strong>${brl(best.received)}</strong></div>
    <div>Lucro: <strong>${brl(best.profitBRL)}</strong></div>
    <div>Margem: <strong>${((best.profitPctReal || 0) * 100).toFixed(2)}%</strong></div>
    <div class="compareCard__status ${status.className}">${status.label}</div>
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
        .map(
          (item) =>
            `<div class="k">${item.label}</div><div class="v">${(item.pct * 100).toFixed(2)}% (${brl(item.brl)})</div>`
        )
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

  return `
  <div class="card">
    <div class="cardHeader">
      <div class="cardTitle">${title}</div>
      <div class="pill">${pill}</div>
    </div>

    ${shopeeToggleHTML}

    <div class="heroBox">
      <div class="heroLabel">PREÇO SUGERIDO</div>
      <div class="heroValue">${price}</div>
    </div>

    <!-- RESUMO (sem repetir embaixo) -->
    <div class="resultGrid">
      <div class="k">VOCÊ RECEBE</div><div class="v">${received}</div>
      <div class="k">LUCRO</div><div class="v">${profitLine}</div>
      <div class="k">TOTAL DE INCIDÊNCIAS</div><div class="v">${incidencesPct}</div>
      ${extraHTML}
      ${shopeeInfoHTML}
    </div>

    <!-- DIVISOR + TÍTULO -->
    <div class="cardDivider"></div>
    <div class="cardSectionTitle">Detalhamento das incidências</div>

    <!-- DETALHAMENTO (comissão, imposto, afiliados, ads, etc) -->
    <div class="resultGrid resultGrid--details">
      ${itemsHTML}
    </div>
  </div>
  `;
}


/* ===== Main calc ===== */


function runExportPDF(from = "card") {
  try {
    recalc();
    if (typeof window.generatePDF === "function") {
      window.generatePDF();
      track("export_pdf", {
        device: window.innerWidth < 768 ? "mobile" : "desktop"
      });
      return;
    }
    logActionError("generatePDF indisponível");
  } catch (error) {
    logActionError("falha ao exportar PDF", error);
  }
}

async function shareFallback() {
  const summaryText = document.querySelector("#stickySummaryContent")?.innerText?.trim() || "Resumo indisponível.";
  try {
    await navigator.clipboard.writeText(summaryText);
    track("copy_link");
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

function recalc() {
  const cost = Math.max(0, toNumber(document.querySelector("#cost")?.value));
  const taxPct = clamp(toNumber(document.querySelector("#tax")?.value), 0, 99); // ✅ ID correto: #tax

  const profitType = document.querySelector("#profitType")?.value || "brl";
  const profitValue = Math.max(0, toNumber(document.querySelector("#profitValue")?.value));

  const mlClassicPct = toNumber(document.querySelector("#mlClassicPct")?.value) / 100;
  const mlPremiumPct = toNumber(document.querySelector("#mlPremiumPct")?.value) / 100;

  const adv = getAdvancedVars();

  const weightToggle = document.querySelector("#mlWeightToggle")?.checked;
  const weightValue = toNumber(document.querySelector("#mlWeightValue")?.value);
  const weightUnit = document.querySelector("#mlWeightUnit")?.value || "kg";
  const weightKg = weightToggle ? normalizeWeightKg(weightValue, weightUnit) : 0.5;

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
    percentCosts: adv.pctExtra + adv.affiliate.shein
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
        liquidoAposAntecipa: liquidoFinalShopee
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
      adv.affiliate.tiktok
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
      adv.affiliate.shein,
      [
        { k: "Categoria", v: (sheinCategory === "female" ? "Vestuário feminino" : "Demais categorias") },
        { k: "Intermediação de frete", v: brl(sheinFixed) },
        { k: "Peso usado", v: `${weightKg.toFixed(3)} kg` }
      ]
    ),
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
      ]
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
      ]
    )
  ].join("");

  const marketplaceState = [
    { key: "shopee", title: "Shopee", marketplacePct: shFee.pct, marketplaceFixed: shFee.fixed, percentCosts: adv.pctExtra + adv.affiliate.shopee, fixedCosts: adv.fixedBRL },
    { key: "tiktok", title: "TikTok Shop", marketplacePct: TIKTOK.pct, marketplaceFixed: TIKTOK.fixed, percentCosts: adv.pctExtra + adv.affiliate.tiktok, fixedCosts: adv.fixedBRL },
    { key: "shein", title: "SHEIN", marketplacePct: sheinPct, marketplaceFixed: sheinFixed, percentCosts: adv.pctExtra + adv.affiliate.shein, fixedCosts: adv.fixedBRL },
    { key: "mlClassic", title: "Mercado Livre — Clássico", marketplacePct: mlClassicPct, marketplaceFixed: mlClassic.fixed, percentCosts: adv.pctExtra + adv.affiliate.ml, fixedCosts: adv.fixedBRL },
    { key: "mlPremium", title: "Mercado Livre — Premium", marketplacePct: mlPremiumPct, marketplaceFixed: mlPremium.fixed, percentCosts: adv.pctExtra + adv.affiliate.ml, fixedCosts: adv.fixedBRL }
  ];

  const state = { marketplaces: marketplaceState, cost, taxPct, shopeeAntecipa };
  renderSamePriceComparison(state);
  renderCurrentPriceAnalysis(state);
  renderScaleSimulation(state);
  renderShareActions();
  updateStickySummary([
    { title: "Shopee", received: shopee.received, profitBRL: shopee.profitBRL, profitPctReal: shopee.profitPctReal },
    { title: "TikTok Shop", received: tiktok.received, profitBRL: tiktok.profitBRL, profitPctReal: tiktok.profitPctReal },
    { title: "SHEIN", received: shein.received, profitBRL: shein.profitBRL, profitPctReal: shein.profitPctReal },
    { title: "Mercado Livre — Clássico", received: mlClassic.r.received, profitBRL: mlClassic.r.profitBRL, profitPctReal: mlClassic.r.profitPctReal },
    { title: "Mercado Livre — Premium", received: mlPremium.r.received, profitBRL: mlPremium.r.profitBRL, profitPctReal: mlPremium.r.profitPctReal }
  ]);
  updateReportRoot();
  trackPerfilTicket(shopee.price);

  // Mostrar botão de PDF
  const pdfContainer = document.querySelector("#pdfButtonContainer");
  if (pdfContainer) {
    pdfContainer.innerHTML = `<button class="btn btn--ghost btn-export-pdf" data-action="export-pdf" data-from="card" type="button" style="width: 100%;">📥 Gerar Relatório</button>`;
  }


  const y = document.querySelector("#year");
  if (y) y.textContent = String(new Date().getFullYear());
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

  const selected = document.querySelector("#scaleMarketplace")?.value || "shopee";
  const mp = state.marketplaces.find((item) => item.key === selected) || state.marketplaces[0];

  const priceA = Math.max(0, toNumber(document.querySelector("#scalePriceA")?.value));
  const unitsA = Math.max(0, Math.floor(toNumber(document.querySelector("#scaleUnitsA")?.value)));
  const priceB = Math.max(0, toNumber(document.querySelector("#scalePriceB")?.value));
  const unitsB = Math.max(0, Math.floor(toNumber(document.querySelector("#scaleUnitsB")?.value)));

  if (!priceA || !unitsA || !priceB || !unitsB) {
    wrap.innerHTML = "";
    return;
  }

  const scenarioA = calculateMarketplaceAtPrice({
    price: priceA,
    cost: state.cost,
    taxPct: state.taxPct,
    marketplacePct: mp.marketplacePct,
    marketplaceFixed: mp.marketplaceFixed,
    percentCosts: mp.percentCosts,
    fixedCosts: mp.fixedCosts,
    applyAntecipa: mp.key === "shopee" ? state.shopeeAntecipa : false
  });
  const scenarioB = calculateMarketplaceAtPrice({
    price: priceB,
    cost: state.cost,
    taxPct: state.taxPct,
    marketplacePct: mp.marketplacePct,
    marketplaceFixed: mp.marketplaceFixed,
    percentCosts: mp.percentCosts,
    fixedCosts: mp.fixedCosts,
    applyAntecipa: mp.key === "shopee" ? state.shopeeAntecipa : false
  });

  const faturamentoA = priceA * unitsA;
  const faturamentoB = priceB * unitsB;
  const lucroTotalA = scenarioA.lucro * unitsA;
  const lucroTotalB = scenarioB.lucro * unitsB;
  const diff = lucroTotalB - lucroTotalA;

  const message = diff > 0
    ? `🔥 Vendendo mais barato e aumentando volume, você coloca +${brl(diff)} no bolso.`
    : "⚠️ Nesse caso, baixar preço não compensou no lucro líquido.";

  wrap.innerHTML = `
    <article class="compareCard">
      <div class="compareCard__title">${mp.title} • Cenário A</div>
      <div class="compareCard__rows">
        <div class="k">Faturamento bruto</div><div class="v">${brl(faturamentoA)}</div>
        <div class="k">Lucro líquido total</div><div class="v">${brl(lucroTotalA)}</div>
      </div>
    </article>
    <article class="compareCard">
      <div class="compareCard__title">${mp.title} • Cenário B</div>
      <div class="compareCard__rows">
        <div class="k">Faturamento bruto</div><div class="v">${brl(faturamentoB)}</div>
        <div class="k">Lucro líquido total</div><div class="v">${brl(lucroTotalB)}</div>
      </div>
    </article>
    <p class="elasticityMsg">${message}</p>
  `;
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
      <button class="btn btn--ghost" type="button" data-action="share-whatsapp">WhatsApp</button>
      <button class="btn btn--ghost" type="button" data-action="copy-link">Copiar link</button>
    </div>
  `;
}

/* ===== Bindings ===== */


function buildShareLink() {
  const encoded = encodeURIComponent(JSON.stringify(getShareableState()));
  return `${window.location.origin}${window.location.pathname}?state=${encoded}`;
}

function bindActionButtons() {
  document.addEventListener("click", async (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;

    const action = target.getAttribute("data-action");

    try {
      if (action === "export-pdf") {
        event.preventDefault();
        runExportPDF(target.getAttribute("data-from") || "card");
      }

      if (action === "share-whatsapp") {
        event.preventDefault();
        const link = buildShareLink();
        const text = encodeURIComponent(`Simulei minha precificação aqui: ${link}`);
        window.open(`https://wa.me/?text=${text}`, "_blank", "noopener");
        track("share_whatsapp");
      }

      if (action === "copy-link") {
        event.preventDefault();
        const link = buildShareLink();
        try {
          await navigator.clipboard.writeText(link);
          alert("Link copiado com sucesso.");
          track("copy_link");
        } catch {
          prompt("Copie o link:", link);
        }
      }

      if (action === "cta-instagram") {
        track("cta_click", { cta: "instagram", destino: target.href || "" });
      }

      if (action === "cta-whatsapp-community") {
        track("cta_click", { cta: "whatsapp", destino: target.href || "" });
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
      track("input_change", { field });
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
    recalc();
    const mode = document.querySelector("#advToggle")?.checked ? "advanced" : "basic";
    const hasWeight = !!document.querySelector("#mlWeightToggle")?.checked;
    const hasAffiliate = !!(document.querySelector("#advToggle")?.checked && document.querySelector("#affToggle")?.checked);
    track("recalc", { mode, has_weight: hasWeight, has_affiliate: hasAffiliate });
    scrollToResults();
  });

  // Auto recalcular em input/change
  document.querySelectorAll("input, select").forEach((el) => {
    el.addEventListener("input", recalc);
    el.addEventListener("change", recalc);
  });

  document.querySelector("#results")?.addEventListener("change", (event) => {
    const target = event.target;
    if (target && target.id === "shopeeAntecipa") recalc();
  });

  document.querySelectorAll("[data-scroll-target]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-scroll-target");
      const target = targetId ? document.getElementById(targetId) : null;
      if (!target) return;
      scrollToWithTopbarOffset(target);
      const sectionMap = {
        "sec-precificacao": "precificacao",
        "sec-comparar": "comparar_preco",
        "sec-lucro-atual": "lucro_atual",
        "sec-escala": "escala"
      };
      const section = sectionMap[targetId];
      if (section) track("view_section", { section });
    });
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

  bind();
  bindActionButtons();
  bindMobileMenu();
  bindInputTracking();
  bindTooltipSystem();
  bindStickySummaryVisibility();
  track("session_ready", { device: getDeviceType() });
  recalc();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
