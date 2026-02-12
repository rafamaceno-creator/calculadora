/* =========================
   Precificação Marketplaces
   storage.js (localStorage persistence)
   ========================= */

const STORAGE_KEY = "precificacao_config";

/**
 * Salva a configuração atual do vendedor no localStorage
 */
function saveConfig() {
  const config = {
    // Dados básicos
    cost: document.querySelector("#cost")?.value || "",
    tax: document.querySelector("#tax")?.value || "",
    profitType: document.querySelector("#profitType")?.value || "brl",
    profitValue: document.querySelector("#profitValue")?.value || "",

    // Mercado Livre
    mlClassicPct: document.querySelector("#mlClassicPct")?.value || "",
    mlPremiumPct: document.querySelector("#mlPremiumPct")?.value || "",

    // Peso ML
    mlWeightToggle: document.querySelector("#mlWeightToggle")?.checked || false,
    mlWeightValue: document.querySelector("#mlWeightValue")?.value || "",
    mlWeightUnit: document.querySelector("#mlWeightUnit")?.value || "kg",

    // Variáveis avançadas
    advToggle: document.querySelector("#advToggle")?.checked || false,

    // Ads
    adsToggle: document.querySelector("#adsToggle")?.checked || false,
    adsType: document.querySelector("#adsType")?.value || "pct",
    adsValue: document.querySelector("#adsValue")?.value || "",

    // Devolução
    returnToggle: document.querySelector("#returnToggle")?.checked || false,
    returnType: document.querySelector("#returnType")?.value || "pct",
    returnValue: document.querySelector("#returnValue")?.value || "",

    // DIFAL
    difalToggle: document.querySelector("#difalToggle")?.checked || false,
    difalValue: document.querySelector("#difalValue")?.value || "",

    // PIS
    pisToggle: document.querySelector("#pisToggle")?.checked || false,
    pisValue: document.querySelector("#pisValue")?.value || "",

    // COFINS
    cofinsToggle: document.querySelector("#cofinsToggle")?.checked || false,
    cofinsValue: document.querySelector("#cofinsValue")?.value || "",

    // Outro
    otherToggle: document.querySelector("#otherToggle")?.checked || false,
    otherType: document.querySelector("#otherType")?.value || "pct",
    otherValue: document.querySelector("#otherValue")?.value || "",

    // Afiliados
    affToggle: document.querySelector("#affToggle")?.checked || false,
    affShopee: document.querySelector("#affShopee")?.value || "",
    affML: document.querySelector("#affML")?.value || "",
    affTikTok: document.querySelector("#affTikTok")?.value || "",

    // Timestamp
    savedAt: new Date().toISOString()
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    console.log("✅ Configuração salva com sucesso");
  } catch (error) {
    console.error("❌ Erro ao salvar configuração:", error);
  }
}

/**
 * Carrega a configuração salva do localStorage
 */
function loadConfig() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      console.log("⚪ Nenhuma configuração anterior encontrada");
      return null;
    }

    const config = JSON.parse(saved);
    console.log("✅ Configuração carregada:", config.savedAt);
    return config;
  } catch (error) {
    console.error("❌ Erro ao carregar configuração:", error);
    return null;
  }
}

/**
 * Aplica os valores salvos aos campos do formulário
 */
function applyConfig(config) {
  if (!config) return;

  const set = (selector, value, isCheckbox = false) => {
    const el = document.querySelector(selector);
    if (!el) return;

    if (isCheckbox) {
      el.checked = value === true || value === "on";
    } else {
      el.value = value;
    }
  };

  // Dados básicos
  set("#cost", config.cost);
  set("#tax", config.tax);
  set("#profitType", config.profitType);
  set("#profitValue", config.profitValue);

  // Mercado Livre
  set("#mlClassicPct", config.mlClassicPct);
  set("#mlPremiumPct", config.mlPremiumPct);

  // Peso ML
  set("#mlWeightToggle", config.mlWeightToggle, true);
  set("#mlWeightValue", config.mlWeightValue);
  set("#mlWeightUnit", config.mlWeightUnit);

  // Variáveis avançadas
  set("#advToggle", config.advToggle, true);

  // Ads
  set("#adsToggle", config.adsToggle, true);
  set("#adsType", config.adsType);
  set("#adsValue", config.adsValue);

  // Devolução
  set("#returnToggle", config.returnToggle, true);
  set("#returnType", config.returnType);
  set("#returnValue", config.returnValue);

  // DIFAL
  set("#difalToggle", config.difalToggle, true);
  set("#difalValue", config.difalValue);

  // PIS
  set("#pisToggle", config.pisToggle, true);
  set("#pisValue", config.pisValue);

  // COFINS
  set("#cofinsToggle", config.cofinsToggle, true);
  set("#cofinsValue", config.cofinsValue);

  // Outro
  set("#otherToggle", config.otherToggle, true);
  set("#otherType", config.otherType);
  set("#otherValue", config.otherValue);

  // Afiliados
  set("#affToggle", config.affToggle, true);
  set("#affShopee", config.affShopee);
  set("#affML", config.affML);
  set("#affTikTok", config.affTikTok);

  console.log("✅ Configuração aplicada ao formulário");
}

/**
 * Limpa a configuração salva (útil para reset)
 */
function clearConfig() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log("✅ Configuração apagada");
  } catch (error) {
    console.error("❌ Erro ao apagar configuração:", error);
  }
}

/**
 * Mostra informações sobre a configuração salva
 */
function getConfigInfo() {
  const config = loadConfig();
  if (!config) return null;

  return {
    savedAt: new Date(config.savedAt).toLocaleString("pt-BR"),
    custo: config.cost,
    imposto: config.tax,
    lucro: `${config.profitValue} (${config.profitType === "brl" ? "R$" : "%"})`
  };
}