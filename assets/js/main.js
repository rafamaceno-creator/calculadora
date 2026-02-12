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
  extraRows = []
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

  return `
  <div class="card">
    <div class="cardHeader">
      <div class="cardTitle">${title}</div>
      <div class="pill">${pill}</div>
    </div>

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
  const shopee = shopeeData.result;
  const shFee = shopeeData.faixa;

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
      [{ k: "Faixa aplicada", v: shFee.label }]
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

  // Mostrar botão de PDF
  const pdfContainer = document.querySelector("#pdfButtonContainer");
  if (pdfContainer) {
    pdfContainer.innerHTML = `
      <button class="btn btn--ghost btn-export-pdf" type="button" style="width: 100%;">
        📥 Exportar PDF
      </button>
    `;
    pdfContainer.querySelector(".btn-export-pdf").addEventListener("click", generatePDF);
  }

  const y = document.querySelector("#year");
  if (y) y.textContent = String(new Date().getFullYear());
}

/* ===== Bindings ===== */

function bind() {
  const $ = (s) => document.querySelector(s);

  const scrollToResults = () => {
    const results = $("#results");
    if (!results) return;

    const topbar = $(".topbar");
    const offset = (topbar ? topbar.offsetHeight : 0) + 16;

    const y = results.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({ top: y, behavior: "smooth" });
  };

  $("#recalc")?.addEventListener("click", () => {
    recalc();
    scrollToResults();
  });

  // Auto recalcular em input/change
  document.querySelectorAll("input, select").forEach((el) => {
    el.addEventListener("input", recalc);
    el.addEventListener("change", recalc);
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

document.addEventListener("DOMContentLoaded", () => {
  bind();
  recalc();
});
