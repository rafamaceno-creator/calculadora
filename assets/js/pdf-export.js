/* =========================
   PDF Export
   pdf-export.js
   ========================= */

function generatePDF() {
  const cost = document.querySelector("#cost")?.value;
  const tax = document.querySelector("#tax")?.value;
  const profitType = document.querySelector("#profitType")?.value;
  const profitValue = document.querySelector("#profitValue")?.value;

  const mlClassicPct = document.querySelector("#mlClassicPct")?.value;
  const mlPremiumPct = document.querySelector("#mlPremiumPct")?.value;

  const advToggle = document.querySelector("#advToggle")?.checked;
  const weightToggle = document.querySelector("#mlWeightToggle")?.checked;
  const weightValue = document.querySelector("#mlWeightValue")?.value;
  const weightUnit = document.querySelector("#mlWeightUnit")?.value;

  // Coletar dados avançados
  const advData = {};
  if (advToggle) {
    const adsToggle = document.querySelector("#adsToggle")?.checked;
    const returnToggle = document.querySelector("#returnToggle")?.checked;
    const costFixedToggle = document.querySelector("#costFixedToggle")?.checked;
    const difalToggle = document.querySelector("#difalToggle")?.checked;
    const pisToggle = document.querySelector("#pisToggle")?.checked;
    const cofinsToggle = document.querySelector("#cofinsToggle")?.checked;
    const otherToggle = document.querySelector("#otherToggle")?.checked;
    const affToggle = document.querySelector("#affToggle")?.checked;

    if (adsToggle) {
      advData.ads = {
        type: document.querySelector("#adsType")?.value,
        value: document.querySelector("#adsValue")?.value
      };
    }
    if (returnToggle) {
      advData.return = {
        type: document.querySelector("#returnType")?.value,
        value: document.querySelector("#returnValue")?.value
      };
    }
    if (costFixedToggle) {
      advData.costFixed = {
        type: document.querySelector("#costFixedType")?.value,
        value: document.querySelector("#costFixedValue")?.value
      };
    }
    if (difalToggle) {
      advData.difal = document.querySelector("#difalValue")?.value;
    }
    if (pisToggle) {
      advData.pis = document.querySelector("#pisValue")?.value;
    }
    if (cofinsToggle) {
      advData.cofins = document.querySelector("#cofinsValue")?.value;
    }
    if (otherToggle) {
      advData.other = {
        type: document.querySelector("#otherType")?.value,
        value: document.querySelector("#otherValue")?.value
      };
    }
    if (affToggle) {
      advData.affiliates = {
        shopee: document.querySelector("#affShopee")?.value,
        ml: document.querySelector("#affML")?.value,
        tiktok: document.querySelector("#affTikTok")?.value
      };
    }
  }

  const resultsHTML = document.querySelector("#results")?.innerHTML || "";

  // Data/hora
  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const timeStr = now.toLocaleTimeString("pt-BR");

  // HTML do PDF
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          color: #333;
          line-height: 1.6;
          background: #fff;
        }
        .container {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }
        header {
          border-bottom: 3px solid #6366f1;
          padding-bottom: 15px;
          margin-bottom: 30px;
        }
        .logo {
          font-size: 28px;
          font-weight: 800;
          color: #1f2937;
          margin-bottom: 5px;
        }
        .subtitle {
          font-size: 12px;
          color: #6b7280;
          margin-bottom: 10px;
        }
        .meta {
          font-size: 11px;
          color: #9ca3af;
        }
        h2 {
          font-size: 16px;
          font-weight: 700;
          color: #1f2937;
          margin-top: 25px;
          margin-bottom: 12px;
          border-left: 4px solid #6366f1;
          padding-left: 10px;
        }
        .section {
          margin-bottom: 20px;
          background: #f9fafb;
          padding: 15px;
          border-radius: 8px;
        }
        .row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          margin-bottom: 10px;
        }
        .field {
          display: flex;
          flex-direction: column;
        }
        .field-label {
          font-size: 11px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }
        .field-value {
          font-size: 14px;
          font-weight: 600;
          color: #1f2937;
        }
        .results-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 15px;
          margin-top: 15px;
        }
        .result-card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 15px;
          page-break-inside: avoid;
        }
        .result-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 12px;
          border-bottom: 2px solid #f3f4f6;
          padding-bottom: 10px;
        }
        .result-card-title {
          font-size: 14px;
          font-weight: 700;
          color: #1f2937;
        }
        .result-card-pill {
          font-size: 10px;
          background: #eef2ff;
          color: #4f46e5;
          padding: 4px 8px;
          border-radius: 4px;
          font-weight: 600;
        }
        .price-box {
          text-align: center;
          padding: 12px;
          background: #f0f9ff;
          border-radius: 6px;
          margin-bottom: 12px;
        }
        .price-label {
          font-size: 10px;
          color: #0369a1;
          text-transform: uppercase;
          font-weight: 600;
          margin-bottom: 4px;
        }
        .price-value {
          font-size: 22px;
          font-weight: 800;
          color: #059669;
        }
        .result-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          padding: 6px 0;
          border-bottom: 1px solid #f3f4f6;
          font-size: 11px;
        }
        .result-row:last-child {
          border-bottom: none;
        }
        .result-label {
          color: #6b7280;
          font-weight: 500;
        }
        .result-value {
          text-align: right;
          font-weight: 600;
          color: #1f2937;
        }
        .advanced-section {
          margin-top: 20px;
          font-size: 10px;
        }
        .advanced-title {
          font-weight: 700;
          color: #1f2937;
          margin-bottom: 8px;
          margin-top: 10px;
        }
        .advanced-item {
          display: flex;
          justify-content: space-between;
          padding: 3px 0;
          color: #6b7280;
        }
        .footer-note {
          margin-top: 30px;
          padding-top: 15px;
          border-top: 1px solid #e5e7eb;
          font-size: 9px;
          color: #9ca3af;
          text-align: center;
        }
        @page {
          size: A4;
          margin: 10mm;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <header>
          <div class="logo">📊 Precificação</div>
          <div class="subtitle">Calculadora de Preços para Marketplaces</div>
          <div class="meta">Gerado em ${dateStr} às ${timeStr}</div>
        </header>

        <h2>Dados de Entrada</h2>
        <div class="section">
          <div class="row">
            <div class="field">
              <span class="field-label">Custo Final (R$)</span>
              <span class="field-value">R$ ${parseFloat(cost || 0).toFixed(2).replace(".", ",")}</span>
            </div>
            <div class="field">
              <span class="field-label">Imposto de Venda (%)</span>
              <span class="field-value">${parseFloat(tax || 0).toFixed(2).replace(".", ",")}%</span>
            </div>
          </div>
          <div class="row">
            <div class="field">
              <span class="field-label">Lucro Desejado</span>
              <span class="field-value">${profitType === "brl" ? "R$ " : ""}${parseFloat(profitValue || 0).toFixed(2).replace(".", ",")}${profitType === "pct" ? "%" : ""}</span>
            </div>
            <div class="field">
              <span class="field-label">ML Clássico / Premium</span>
              <span class="field-value">${parseFloat(mlClassicPct || 0).toFixed(2).replace(".", ",")}% / ${parseFloat(mlPremiumPct || 0).toFixed(2).replace(".", ",")}</span>
            </div>
          </div>
          ${weightToggle ? `
            <div class="row">
              <div class="field">
                <span class="field-label">Peso (ML)</span>
                <span class="field-value">${parseFloat(weightValue || 0).toFixed(3).replace(".", ",")} ${weightUnit}</span>
              </div>
            </div>
          ` : ""}
        </div>

        ${Object.keys(advData).length > 0 ? `
          <h2>Variáveis Avançadas</h2>
          <div class="section advanced-section">
            ${advData.ads ? `<div class="advanced-item"><span>Ads:</span> <span>${advData.ads.type === "brl" ? "R$" : ""} ${parseFloat(advData.ads.value || 0).toFixed(2).replace(".", ",")}${advData.ads.type === "pct" ? "%" : ""}</span></div>` : ""}
            ${advData.return ? `<div class="advanced-item"><span>Devolução:</span> <span>${advData.return.type === "brl" ? "R$" : ""} ${parseFloat(advData.return.value || 0).toFixed(2).replace(".", ",")}${advData.return.type === "pct" ? "%" : ""}</span></div>` : ""}
            ${advData.costFixed ? `<div class="advanced-item"><span>Custo Fixo:</span> <span>${advData.costFixed.type === "brl" ? "R$" : ""} ${parseFloat(advData.costFixed.value || 0).toFixed(2).replace(".", ",")}${advData.costFixed.type === "pct" ? "%" : ""}</span></div>` : ""}
            ${advData.difal ? `<div class="advanced-item"><span>DIFAL:</span> <span>${parseFloat(advData.difal || 0).toFixed(2).replace(".", ",")}</span></div>` : ""}
            ${advData.pis ? `<div class="advanced-item"><span>PIS:</span> <span>${parseFloat(advData.pis || 0).toFixed(2).replace(".", ",")}</span></div>` : ""}
            ${advData.cofins ? `<div class="advanced-item"><span>COFINS:</span> <span>${parseFloat(advData.cofins || 0).toFixed(2).replace(".", ",")}</span></div>` : ""}
            ${advData.other ? `<div class="advanced-item"><span>Outro:</span> <span>${advData.other.type === "brl" ? "R$" : ""} ${parseFloat(advData.other.value || 0).toFixed(2).replace(".", ",")}${advData.other.type === "pct" ? "%" : ""}</span></div>` : ""}
            ${advData.affiliates ? `
              <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e5e7eb;">
                <div class="advanced-title">Afiliados</div>
                ${advData.affiliates.shopee ? `<div class="advanced-item"><span>Shopee:</span> <span>${parseFloat(advData.affiliates.shopee || 0).toFixed(2).replace(".", ",")}%</span></div>` : ""}
                ${advData.affiliates.ml ? `<div class="advanced-item"><span>Mercado Livre:</span> <span>${parseFloat(advData.affiliates.ml || 0).toFixed(2).replace(".", ",")}%</span></div>` : ""}
                ${advData.affiliates.tiktok ? `<div class="advanced-item"><span>TikTok:</span> <span>${parseFloat(advData.affiliates.tiktok || 0).toFixed(2).replace(".", ",")}%</span></div>` : ""}
              </div>
            ` : ""}
          </div>
        ` : ""}

        <h2>Resultados</h2>
        <div class="results-grid">
          ${resultsHTML}
        </div>

        <div class="footer-note">
          <strong>Precificação Marketplaces</strong><br>
          Calcule o melhor preço para Shopee, Mercado Livre e TikTok Shop<br>
          © ${new Date().getFullYear()} • precificacao.rafamaceno.com.br
        </div>
      </div>
    </body>
    </html>
  `;

  // Configurações do html2pdf
  const opt = {
    margin: 10,
    filename: `Precificacao_${dateStr.replace(/\//g, "-")}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { orientation: "portrait", unit: "mm", format: "a4" }
  };

  // Gerar PDF
  try {
    html2pdf().set(opt).from(htmlContent).save();
  } catch (error) {
    console.error("Erro ao gerar PDF:", error);
    alert("Erro ao gerar PDF. Verifique o console.");
  }
}