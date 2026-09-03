/* =========================================================
   Precificação Marketplaces — camada de UI "Ledger"
   ---------------------------------------------------------
   Wizard de 4 passos, prévia por canal em tempo real, cards
   de resultado e sugestão de custos extras.

   O motor de cálculo continua sendo o de main.js: aqui só
   chamamos solvePrice / solvePriceComFaixa / resultAtPrice e
   as tabelas oficiais já declaradas lá.
   ========================================================= */

(function LedgerUI() {
  "use strict";

  const q = (sel) => document.querySelector(sel);
  const qa = (sel) => Array.from(document.querySelectorAll(sel));

  const NEG_CLASS = "is-negative";
  const SUGGESTION_DEFAULTS = { ads: 3, ret: 2, fix: 2 };
  /* TODO: trocar por a URL do artigo sobre custos fixos quando publicado. */
  const FIXED_COST_ARTICLE_URL = "#faq";

  const CHANNELS = [
    { key: "shopee", title: "Shopee", domain: "shopee.com.br" },
    { key: "mlClassic", title: "Mercado Livre · Clássico", domain: "mercadolivre.com.br" },
    { key: "mlPremium", title: "Mercado Livre · Premium", domain: "mercadolivre.com.br" },
    { key: "tiktok", title: "TikTok Shop", domain: "tiktok.com" },
    { key: "shein", title: "SHEIN", domain: "shein.com.br" },
    { key: "amazon", title: "Amazon (DBA)", domain: "amazon.com.br" }
  ];

  const EXTRA_DEFS = [
    { key: "ads", label: "Custo de Ads", toggle: "#adsToggle", type: "#adsType", value: "#adsValue" },
    { key: "ret", label: "Taxa de devolução", toggle: "#returnToggle", type: "#returnType", value: "#returnValue" },
    { key: "fix", label: "Custo fixo por pedido", toggle: "#costFixedToggle", type: "#costFixedType", value: "#costFixedValue" },
    { key: "other", label: "Outro custo", toggle: "#otherToggle", type: "#otherType", value: "#otherValue" }
  ];

  const state = {
    step: 1,
    applied: { ads: false, ret: false, fix: false }
  };

  /* ===== helpers ===== */

  const esc = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  const money = (v) => (typeof brl === "function" ? brl(v) : `R$ ${Number(v || 0).toFixed(2)}`);
  const num = (v) => (typeof toNumber === "function" ? toNumber(v) : Number(v) || 0);
  const favicon = (domain) => `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  const pctText = (v, digits = 2) => `${Number(v || 0).toFixed(digits).replace(".", ",")}%`;

  function isRealMode() {
    return typeof getCalcMode === "function" ? getCalcMode() === "real" : false;
  }

  function selectedKeys() {
    if (typeof getSelectedMarketplaces === "function") {
      const keys = getSelectedMarketplaces();
      if (keys.length) return keys;
    }
    return [];
  }

  function readExtras() {
    return EXTRA_DEFS.map((def) => {
      const on = !!q(def.toggle)?.checked;
      const type = q(def.type)?.value || "pct";
      const value = Math.max(0, num(q(def.value)?.value));
      return { ...def, on, type, value };
    });
  }

  function formatExtra(extra) {
    return extra.type === "brl" ? money(extra.value) : pctText(extra.value, 1);
  }

  function pctLabel(pct) {
    const value = Number(pct * 100);
    return `${value.toFixed(value % 1 === 0 ? 0 : 2).replace(".", ",")}%`;
  }

  /* O card sempre mostra os dois componentes da cobrança do canal, mesmo
     quando a taxa fixa é zero: "14,00%" sozinho deixava a dúvida se a taxa
     não existe naquela faixa ou se o cálculo esqueceu dela. */
  function commissionPill(pct, fixed) {
    return `${pctLabel(pct)} + ${money(fixed || 0)}`;
  }

  /* Cada canal chama a taxa fixa de um jeito e a cobra por uma regra
     diferente; a nota diz de onde saiu o valor — e, quando é zero, por quê. */
  function fixedFeeNote(key, faixa) {
    if (key === "mlClassic" || key === "mlPremium") {
      const limite = typeof ML_LIMITE_CUSTO_UNIDADE === "number" ? ML_LIMITE_CUSTO_UNIDADE : 79;
      return faixa.fixed > 0
        ? `custo por unidade vendida · abaixo de R$ ${limite}`
        : `isento a partir de R$ ${limite}`;
    }
    if (key === "shein") return "intermediação de frete · por peso";
    if (key === "amazon") return "tarifa DBA · por preço e peso";
    return faixa.label || "";
  }

  /* ===== cálculo ===== */

  function affiliateFor(key, adv) {
    if (key === "shopee") return adv.affiliate.shopee;
    if (key === "mlClassic" || key === "mlPremium") return adv.affiliate.ml;
    if (key === "tiktok") return adv.affiliate.tiktok;
    if (key === "amazon") return adv.affiliate.amazon;
    return 0;
  }

  /* Mesma correção de preço que recalc() faz na Shopee: com o Antecipa
     ligado o preço sobe até o lucro voltar ao alvo original. */
  function applyShopeeAntecipa(baseResult, faixa, params, ctx) {
    const target = Math.max(0, baseResult.profitBRL);
    const priceOf = (price) => breakdownAtPrice({
      price,
      cost: ctx.cost,
      taxPct: ctx.taxPct,
      marketplacePct: faixa.pct,
      marketplaceFixed: faixa.fixed,
      percentCosts: params.percentCosts,
      fixedCosts: params.fixedCosts,
      applyAntecipa: true
    });

    let low = Math.max(0, ctx.cost + params.fixedCosts + faixa.fixed);
    let high = Math.max(low + 1, baseResult.price || 0);
    let guard = 0;
    while (priceOf(high).profitValue < target && guard < 25) {
      high *= 2;
      guard += 1;
    }
    for (let i = 0; i < 40; i += 1) {
      const mid = (low + high) / 2;
      if (priceOf(mid).profitValue < target) low = mid; else high = mid;
    }

    const price = Math.max(0, Math.round(high * 100) / 100);
    const bd = priceOf(price);
    return {
      result: {
        ...baseResult,
        price,
        commissionValue: bd.commissionValue,
        received: price - bd.commissionValue - bd.antecipaFee,
        profitBRL: bd.profitValue,
        profitPctReal: price > 0 ? bd.profitValue / price : 0
      },
      antecipaFee: bd.antecipaFee
    };
  }

  function computeChannel(key, ctx) {
    const { cost, taxPct, profitType, profitValue, adv, weightKg, isReal, salePrice, cfg, antecipa } = ctx;
    const percentCosts = adv.pctExtra + affiliateFor(key, adv);
    const params = { cost, taxPct, profitType, profitValue, fixedCosts: adv.fixedBRL, percentCosts };
    const atPrice = (pct, fixed) => resultAtPrice(salePrice, { cost, taxPct, marketplacePct: pct, marketplaceFixed: fixed, fixedCosts: adv.fixedBRL, percentCosts });

    let result = null;
    let faixa = null;
    let antecipaFee = 0;

    if (key === "shopee") {
      if (isReal) {
        faixa = shopeeFaixaByPrice(salePrice);
        result = atPrice(faixa.pct, faixa.fixed);
        if (antecipa) {
          const bd = breakdownAtPrice({ price: salePrice, cost, taxPct, marketplacePct: faixa.pct, marketplaceFixed: faixa.fixed, percentCosts, fixedCosts: adv.fixedBRL, applyAntecipa: true });
          antecipaFee = bd.antecipaFee;
          result = { ...result, profitBRL: bd.profitValue, received: salePrice - bd.commissionValue - bd.antecipaFee, profitPctReal: salePrice > 0 ? bd.profitValue / salePrice : 0 };
        }
      } else {
        const solved = solvePriceComFaixa(shopeeFaixaByPrice, SHOPEE_FAIXA_PADRAO, params);
        faixa = solved.faixa;
        result = solved.result;
        if (antecipa) {
          const adjusted = applyShopeeAntecipa(result, faixa, params, ctx);
          result = adjusted.result;
          antecipaFee = adjusted.antecipaFee;
        }
      }
    } else if (key === "tiktok") {
      if (isReal) {
        faixa = tiktokFaixaByPrice(salePrice);
        result = atPrice(faixa.pct, faixa.fixed);
      } else {
        const solved = solvePriceComFaixa(tiktokFaixaByPrice, TIKTOK_FAIXA_PADRAO, params);
        faixa = solved.faixa;
        result = solved.result;
      }
    } else if (key === "mlClassic" || key === "mlPremium") {
      const mlPct = key === "mlClassic" ? cfg.mlClassicPct : cfg.mlPremiumPct;
      const faixas = mlFaixas(mlPct, weightKg);
      if (isReal) {
        faixa = faixaByPrice(faixas, salePrice, faixas[0]);
        result = atPrice(faixa.pct, faixa.fixed);
      } else {
        const solved = solveMercadoLivre(mlPct, weightKg, params);
        result = solved.r;
        faixa = { pct: mlPct, fixed: solved.fixed };
      }
    } else if (key === "shein") {
      const pct = cfg.sheinCustomPct != null ? cfg.sheinCustomPct : SHEIN.pctOther;
      const fixed = sheinFixedByWeight(weightKg);
      faixa = { pct, fixed };
      result = isReal ? atPrice(pct, fixed) : solvePrice({ ...params, marketplacePct: pct, marketplaceFixed: fixed });
    } else if (key === "amazon") {
      const pct = cfg.amazonPct;
      const origin = cfg.amazonOriginGroup;
      if (isReal) {
        const fee = amazonDbaFee({ price: salePrice, weightKg, originGroup: origin });
        faixa = { pct, fixed: fee };
        result = atPrice(pct, fee);
      } else {
        let fee = amazonDbaFee({ price: Math.max(0, cost + adv.fixedBRL + (profitType === "brl" ? profitValue : 0)), weightKg, originGroup: origin });
        let solved = null;
        for (let i = 0; i < 6; i += 1) {
          solved = solvePrice({ ...params, marketplacePct: pct, marketplaceFixed: fee });
          const nextFee = amazonDbaFee({ price: solved.price, weightKg, originGroup: origin });
          if (Math.abs(nextFee - fee) < 0.0001) { fee = nextFee; break; }
          fee = nextFee;
        }
        if (!solved) solved = solvePrice({ ...params, marketplacePct: pct, marketplaceFixed: fee });
        faixa = { pct, fixed: fee };
        result = solved;
      }
    }

    if (!result || !faixa) return null;

    const price = Math.max(0, Number.isFinite(result.price) ? result.price : 0);
    const profitBRL = Number.isFinite(result.profitBRL) ? result.profitBRL : 0;
    const share = (value) => (price > 0 ? Math.max(0, Math.min(100, (value / price) * 100)) : 0);

    const feesValue = (result.commissionValue || 0) + adv.fixedBRL + antecipaFee;
    const taxValue = price * (taxPct / 100 + percentCosts);

    const def = CHANNELS.find((c) => c.key === key);
    return {
      key,
      title: def.title,
      fav: favicon(def.domain),
      pill: key === "amazon" ? `${commissionPill(faixa.pct, faixa.fixed)} (DBA)` : commissionPill(faixa.pct, faixa.fixed),
      commissionPct: faixa.pct,
      fixedFee: faixa.fixed || 0,
      fixedNote: fixedFeeNote(key, faixa),
      price,
      received: Number.isFinite(result.received) ? result.received : 0,
      profitBRL,
      marginPct: price > 0 ? (profitBRL / price) * 100 : 0,
      antecipaFee,
      affiliatePct: affiliateFor(key, adv) * 100,
      segments: {
        cost: share(cost),
        fees: share(feesValue),
        tax: share(taxValue),
        profit: share(Math.max(0, profitBRL))
      }
    };
  }

  function computeAll() {
    if (typeof getCalculationConfig !== "function") return { rows: [], ctx: null };

    /* No layout Ledger cada linha de custo extra liga sozinha; o master do
       motor precisa continuar ligado mesmo se um link compartilhado antigo
       (?state=) trouxer advToggle=false. */
    const advMaster = q("#advToggle");
    if (advMaster && !advMaster.checked) advMaster.checked = true;

    const cfg = getCalculationConfig();
    const ctx = {
      cost: Math.max(0, num(q("#cost")?.value)),
      taxPct: cfg.taxPct,
      profitType: cfg.profitType,
      profitValue: cfg.profitValue,
      adv: cfg.adv,
      weightKg: cfg.weightData.kg,
      isReal: isRealMode(),
      salePrice: Math.max(0, num(q("#salePrice")?.value)),
      antecipa: !!q("#shopeeAntecipa")?.checked,
      cfg
    };

    const keys = selectedKeys();
    const rows = CHANNELS
      .filter((c) => keys.includes(c.key))
      .map((c) => computeChannel(c.key, ctx))
      .filter(Boolean);

    return { rows, ctx };
  }

  /* ===== render ===== */

  /* Atualizações em UM NÓ EXISTENTE, nunca innerHTML no container.
     Trocar o HTML a cada tecla engolia cliques (o blur de um input dispara
     recalc, o nó some entre o mousedown e o mouseup) e fechava os cards
     de resultado que o usuário tinha aberto. */
  function setText(el, value) {
    if (el && el.textContent !== value) el.textContent = value;
  }

  function setClass(el, name, on) {
    if (el) el.classList.toggle(name, !!on);
  }

  function compBarSkeleton() {
    return `<div class="compBar" aria-hidden="true">
        <span class="compBar__cost"></span>
        <span class="compBar__fees"></span>
        <span class="compBar__tax"></span>
        <span class="compBar__profit"></span>
      </div>`;
  }

  function updateCompBar(bar, seg) {
    if (!bar) return;
    const parts = ["cost", "fees", "tax", "profit"];
    parts.forEach((part) => {
      const el = bar.querySelector(`.compBar__${part}`);
      if (el) el.style.width = `${seg[part].toFixed(2)}%`;
    });
  }

  /* Reconciliação por chave: cria o que falta, remove o que sobrou,
     mantém (e reordena) o resto. */
  function syncList(wrap, rows, create, update) {
    const keys = new Set(rows.map((row) => row.key));
    Array.from(wrap.children).forEach((el) => {
      if (!el.dataset || !el.dataset.key || !keys.has(el.dataset.key)) el.remove();
    });
    rows.forEach((row, index) => {
      let el = wrap.querySelector(`:scope > [data-key="${row.key}"]`);
      if (!el) {
        el = create(row);
        el.dataset.key = row.key;
      }
      update(el, row);
      if (wrap.children[index] !== el) wrap.insertBefore(el, wrap.children[index] || null);
    });
  }

  function showEmptyState(wrap, message) {
    const existing = wrap.querySelector(":scope > .emptyState");
    if (existing) { setText(existing, message); return; }
    wrap.innerHTML = "";
    const p = document.createElement("p");
    p.className = "emptyState";
    p.textContent = message;
    wrap.appendChild(p);
  }

  function clearEmptyState(wrap) {
    wrap.querySelector(":scope > .emptyState")?.remove();
  }

  function renderRail(ctx) {
    const wrap = q("#ledgerRail");
    if (!wrap || !ctx) return;

    if (wrap.childElementCount !== 4) {
      wrap.innerHTML = [1, 2, 3, 4].map((n) => `
        <button type="button" class="railStep" data-ledger-goto="${n}">
          <span class="railStep__label"></span>
          <span class="railStep__hint"></span>
        </button>`).join("");
    }

    const isReal = ctx.isReal;
    const channels = selectedKeys().length;
    const hints = [
      isReal ? "Ver quanto estou ganhando" : "Descobrir preço de venda",
      `${money(ctx.cost)} · ${channels} ${channels === 1 ? "canal" : "canais"}`,
      isReal
        ? (ctx.salePrice > 0 ? `Preço ${money(ctx.salePrice)}` : "Preço praticado")
        : (ctx.profitType === "pct" ? `${pctText(ctx.profitValue, 0)} de margem` : `${money(ctx.profitValue)} por venda`),
      isReal ? "Lucro por canal" : "Preço por canal"
    ];
    const labels = ["O que você quer fazer", "Produto e canais", isReal ? "Preço praticado" : "Meta e ajustes", "Resultado"];

    Array.from(wrap.children).forEach((btn, i) => {
      const n = i + 1;
      setClass(btn, "is-current", state.step === n);
      setClass(btn, "is-done", state.step > n);
      setText(btn.querySelector(".railStep__label"), `${n}. ${labels[i]}`);
      setText(btn.querySelector(".railStep__hint"), state.step === n ? "Você está aqui" : hints[i]);
    });
  }

  function renderSteps() {
    qa(".step[data-step]").forEach((section) => {
      const n = Number(section.getAttribute("data-step"));
      section.hidden = n !== state.step;
    });
  }

  function buildRows(row, ctx) {
    const extras = readExtras().filter((e) => e.on);
    const rows = [
      [ctx.isReal ? "Preço de venda" : "Preço sugerido", money(row.price), ""],
      ["Você recebe (após comissão)", money(row.received), ""],
      ["Comissão do canal", pctLabel(row.commissionPct), ""],
      ["Taxa fixa do canal", money(row.fixedFee), "", row.fixedNote]
    ];
    if (row.antecipaFee > 0) rows.push(["Antecipa Shopee (2,5%)", `− ${money(row.antecipaFee)}`, ""]);
    rows.push(["Imposto de venda", pctText(ctx.taxPct), ""]);
    extras.forEach((e) => rows.push([e.label, formatExtra(e), ""]));
    if (row.affiliatePct > 0) rows.push(["Comissão de afiliado", pctText(row.affiliatePct), ""]);
    [["DIFAL", "difal"], ["PIS", "pis"], ["COFINS", "cofins"]].forEach(([label, key]) => {
      const value = ctx.adv?.details?.[key] || 0;
      if (value > 0) rows.push([label, pctText(value * 100), ""]);
    });
    rows.push([
      "Lucro por venda",
      `${money(row.profitBRL)} (${pctText(row.marginPct)})`,
      row.profitBRL < 0 ? NEG_CLASS : "is-profit"
    ]);
    return rows;
  }

  function createResultCard() {
    const el = document.createElement("details");
    el.className = "ledgerCard";
    el.innerHTML = `
      <summary>
        <div class="ledgerCard__row">
          <img class="ledgerCard__icon" alt="" loading="lazy" width="28" height="28" />
          <div class="ledgerCard__id">
            <div class="ledgerCard__name"></div>
            <div class="ledgerCard__pill"></div>
          </div>
          <div class="ledgerCard__figure">
            <div class="ledgerCard__figureLabel"></div>
            <div class="ledgerCard__figureValue"></div>
          </div>
          <span class="ledgerCard__chevron" aria-hidden="true">▾</span>
        </div>
        ${compBarSkeleton()}
      </summary>
      <div class="ledgerCard__body"><dl class="kvGrid"></dl></div>`;
    return el;
  }

  function updateResultCard(el, row, ctx) {
    const icon = el.querySelector(".ledgerCard__icon");
    if (icon && icon.getAttribute("src") !== row.fav) icon.setAttribute("src", row.fav);

    setText(el.querySelector(".ledgerCard__name"), row.title);
    setText(el.querySelector(".ledgerCard__pill"), row.pill);
    setText(el.querySelector(".ledgerCard__figureLabel"), ctx.isReal ? "LUCRO REAL" : "VENDER POR");

    const value = el.querySelector(".ledgerCard__figureValue");
    setText(value, ctx.isReal ? money(row.profitBRL) : money(row.price));
    setClass(value, NEG_CLASS, ctx.isReal && row.profitBRL < 0);

    updateCompBar(el.querySelector(".compBar"), row.segments);

    el.dataset.reportName = row.title;
    el.dataset.reportPrice = money(row.price);
    el.dataset.reportReceived = money(row.received);
    el.dataset.reportProfit = `${money(row.profitBRL)} (${pctText(row.marginPct)})`;
    el.dataset.reportCommission = row.pill;

    const dl = el.querySelector(".kvGrid");
    const html = buildRows(row, ctx)
      .map(([k, v, cls, note]) => `<dt>${esc(k)}${note ? `<small class="kvGrid__note">${esc(note)}</small>` : ""}</dt><dd class="${cls}">${esc(v)}</dd>`)
      .join("");
    if (dl && dl.innerHTML !== html) dl.innerHTML = html;
  }

  function renderResults(rows, ctx) {
    const wrap = q("#ledgerResults");
    if (!wrap) return;

    const title = q("#resultsTitle");
    if (title) setText(title, ctx.isReal ? "Quanto sobra por canal" : "Por quanto vender em cada canal");

    const sub = q("#resultsSub");
    if (sub) {
      const name = q("#calcName")?.value?.trim();
      const tail = ctx.isReal
        ? ` · preço ${money(ctx.salePrice)}`
        : (ctx.profitType === "pct" ? ` · margem ${pctText(ctx.profitValue, 0)}` : ` · lucro ${money(ctx.profitValue)}`);
      setText(sub, `${name ? `${name} · ` : ""}custo ${money(ctx.cost)} · imposto ${pctText(ctx.taxPct, 0)}${tail}`);
    }

    if (!rows.length) {
      showEmptyState(wrap, "Selecione ao menos um marketplace no passo 2 para ver o resultado.");
      return;
    }
    clearEmptyState(wrap);
    syncList(wrap, rows, createResultCard, (el, row) => updateResultCard(el, row, ctx));
  }

  function createPreviewRow() {
    const el = document.createElement("div");
    el.className = "previewRow";
    el.innerHTML = `
      <div class="previewRow__top">
        <span class="previewRow__id">
          <img class="previewRow__icon" alt="" loading="lazy" width="24" height="24" />
          <span class="previewRow__name"></span>
        </span>
        <span class="previewRow__value"></span>
      </div>
      ${compBarSkeleton()}
      <div class="previewRow__foot">
        <span class="previewRow__pill"></span>
        <span>lucro <strong></strong></span>
      </div>`;
    return el;
  }

  function updatePreviewRow(el, row, ctx) {
    const icon = el.querySelector(".previewRow__icon");
    if (icon && icon.getAttribute("src") !== row.fav) icon.setAttribute("src", row.fav);

    setText(el.querySelector(".previewRow__name"), row.title);

    const value = el.querySelector(".previewRow__value");
    setText(value, ctx.isReal ? money(row.profitBRL) : money(row.price));
    setClass(value, NEG_CLASS, ctx.isReal && row.profitBRL < 0);

    updateCompBar(el.querySelector(".compBar"), row.segments);
    setText(el.querySelector(".previewRow__pill"), row.pill);

    const profit = el.querySelector(".previewRow__foot strong");
    setText(profit, money(row.profitBRL));
    setClass(profit, NEG_CLASS, row.profitBRL < 0);
  }

  function renderPreview(rows, ctx) {
    const wrap = q("#ledgerPreview");
    if (!wrap) return;

    const ready = rows.length > 0 && ctx.cost > 0 && (!ctx.isReal || ctx.salePrice > 0);
    if (!ready) {
      showEmptyState(wrap, "Selecione ao menos um marketplace e preencha o custo para ver a prévia.");
      return;
    }
    clearEmptyState(wrap);
    syncList(wrap, rows, createPreviewRow, (el, row) => updatePreviewRow(el, row, ctx));
  }

  let suggestionSignature = "";

  function renderSuggestions() {
    const card = q("#costSuggestions");
    if (!card) return;

    const extras = readExtras();
    const noneActive = extras.every((e) => !e.on);
    const anyApplied = Object.values(state.applied).some(Boolean);
    const visible = state.step === 4 && (noneActive || anyApplied);
    const signature = `${visible}|${state.applied.ads}|${state.applied.ret}|${state.applied.fix}`;

    card.classList.toggle("is-hidden", !visible);
    if (signature === suggestionSignature) return;
    suggestionSignature = signature;

    if (!visible) { card.innerHTML = ""; return; }

    const items = [
      { key: "ads", title: "Custo de Ads", desc: `quase toda operação investe em anúncios; comece com ${SUGGESTION_DEFAULTS.ads}% do faturamento`, badge: `${SUGGESTION_DEFAULTS.ads}%` },
      { key: "ret", title: "Taxa de devolução", desc: `trocas e devoluções acontecem; uma estimativa segura é ${SUGGESTION_DEFAULTS.ret}%`, badge: `${SUGGESTION_DEFAULTS.ret}%` },
      { key: "fix", title: "Custo fixo por pedido", desc: `embalagem, etiqueta e operação: some seus fixos do mês e divida pelos pedidos; sem esse número, use ${money(SUGGESTION_DEFAULTS.fix)}`, badge: money(SUGGESTION_DEFAULTS.fix) }
    ];

    card.innerHTML = `
      <div class="suggestCard__title">Seu cálculo está sem custos extras — na prática, eles existem.</div>
      <p class="suggestCard__lead">Ads, devoluções e custos fixos comem margem em silêncio. Aplique as sugestões abaixo ou ajuste com seus números reais. <a href="${FIXED_COST_ARTICLE_URL}">O que são custos fixos e como calcular os seus →</a></p>
      <div class="suggestCard__list">
        ${items.map((item) => `
          <div class="suggestItem">
            <span class="suggestItem__text"><strong>${esc(item.title)}</strong> — ${esc(item.desc)}</span>
            ${state.applied[item.key]
              ? `<span class="suggestItem__done">✓ aplicado</span>`
              : `<button type="button" class="suggestItem__apply" data-ledger-suggest="${item.key}">Aplicar ${esc(item.badge)}</button>`}
          </div>`).join("")}
      </div>`;
  }

  function syncExtraRows() {
    EXTRA_DEFS.forEach((def) => {
      const toggle = q(def.toggle);
      const row = toggle?.closest(".extraRow");
      if (!row || !toggle) return;
      row.classList.toggle("is-on", toggle.checked);
      const mini = row.querySelector(".miniInput");
      if (mini) mini.setAttribute("data-unit", q(def.type)?.value || "pct");
    });
  }

  function syncThemeLabel() {
    const dark = document.body.classList.contains("theme-dark");
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    setText(q("#themeToggleLabel"), dark ? "Tema claro" : "Tema escuro");
    setText(q(".btn__themeIcon"), dark ? "◑" : "◐");
  }

  function updatePrintRoot() {
    const root = q("#printRoot");
    if (!root || typeof window.getReportMarkup !== "function") return;
    const markup = window.getReportMarkup() || "";
    if (root.innerHTML !== markup) root.innerHTML = markup;
  }

  function render() {
    const { rows, ctx } = computeAll();
    if (!ctx) return;
    syncExtraRows();
    renderSteps();
    renderRail(ctx);
    renderPreview(rows, ctx);
    renderResults(rows, ctx);
    renderSuggestions();
  }

  /* ===== navegação ===== */

  function goToStep(step) {
    const next = Math.min(4, Math.max(1, step));
    if (next === state.step) return;
    state.step = next;
    render();
    if (typeof trackGA4Event === "function") trackGA4Event("wizard_step", { step: next, mode: isRealMode() ? "real" : "ideal" });
    const pane = q(".calcGrid");
    if (pane && typeof scrollToWithTopbarOffset === "function" && window.scrollY > pane.offsetTop) {
      scrollToWithTopbarOffset(pane);
    }
  }

  function applySuggestion(key) {
    const map = {
      ads: { toggle: "#adsToggle", type: "#adsType", value: "#adsValue", unit: "pct", amount: SUGGESTION_DEFAULTS.ads },
      ret: { toggle: "#returnToggle", type: "#returnType", value: "#returnValue", unit: "pct", amount: SUGGESTION_DEFAULTS.ret },
      fix: { toggle: "#costFixedToggle", type: "#costFixedType", value: "#costFixedValue", unit: "brl", amount: SUGGESTION_DEFAULTS.fix }
    }[key];
    if (!map) return;

    const toggle = q(map.toggle);
    const type = q(map.type);
    const value = q(map.value);
    if (!toggle || !type || !value) return;

    toggle.checked = true;
    type.value = map.unit;
    value.value = String(map.amount);
    state.applied[key] = true;

    if (typeof trackGA4Event === "function") trackGA4Event("apply_cost_suggestion", { tipo: key, valor: map.amount, unidade: map.unit });

    /* dispara o recálculo pelo mesmo caminho de qualquer edição manual */
    toggle.dispatchEvent(new Event("change", { bubbles: true }));
  }

  /* ===== binds ===== */

  function bindLedger() {
    document.addEventListener("click", (event) => {
      const next = event.target.closest("[data-ledger-next]");
      if (next) { goToStep(state.step + 1); return; }

      const back = event.target.closest("[data-ledger-back]");
      if (back) { goToStep(state.step - 1); return; }

      const goto = event.target.closest("[data-ledger-goto]");
      if (goto) { goToStep(Number(goto.getAttribute("data-ledger-goto"))); return; }

      const suggest = event.target.closest("[data-ledger-suggest]");
      if (suggest) { applySuggestion(suggest.getAttribute("data-ledger-suggest")); return; }
    });

    q("#themeToggle")?.addEventListener("click", () => window.setTimeout(syncThemeLabel, 0));

    q("#exportPdf")?.addEventListener("click", () => {
      if (typeof trackGA4Event === "function") trackGA4Event("export_pdf", { section: "results" });
      updatePrintRoot();
      if (typeof window.exportPDF === "function") window.exportPDF();
    });

    /* Ctrl+P usa o mesmo relatório do botão. */
    window.addEventListener("beforeprint", updatePrintRoot);

    /* mantém rótulos e a barra de composição em dia a cada tecla */
    q("#sec-precificacao")?.addEventListener("input", () => syncExtraRows());
    q("#sec-precificacao")?.addEventListener("change", () => syncExtraRows());
  }

  /* Re-renderiza a UI Ledger depois de cada cálculo do motor. */
  function patchRecalc() {
    if (typeof window.recalc !== "function" || window.recalc.__ledgerPatched) return;
    const original = window.recalc;
    const patched = function ledgerRecalc(...args) {
      const out = original.apply(this, args);
      try { render(); } catch (error) { console.warn("Ledger render falhou", error); }
      return out;
    };
    patched.__ledgerPatched = true;
    window.recalc = patched;
  }

  function init() {
    patchRecalc();
    bindLedger();
    syncThemeLabel();
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
