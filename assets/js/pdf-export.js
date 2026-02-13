/* =========================
   Exportação para impressão
   ========================= */

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function collectReportItems() {
  const cards = Array.from(document.querySelectorAll("#results .card"));
  const productNameRaw = document.querySelector("#calcName")?.value?.trim() || "";
  const productName = productNameRaw || "Produto sem nome";

  return cards.map((card) => {
    const marketplace = card.querySelector(".cardTitle")?.textContent?.trim() || "Marketplace";
    const suggestedPrice = card.querySelector(".heroValue")?.textContent?.trim() || "—";

    const summaryRows = Array.from(card.querySelectorAll(".resultGrid:not(.resultGrid--details) .k")).map((labelEl) => {
      const valueEl = labelEl.nextElementSibling;
      const normalizedLabel = labelEl.textContent.replace(/\s+/g, " ").trim();
      const valueText = valueEl?.textContent?.replace(/\s+/g, " ").trim() || "—";
      return { label: normalizedLabel, value: valueText };
    });

    const detailsRows = Array.from(card.querySelectorAll(".resultGrid--details .k")).map((labelEl) => {
      const valueEl = labelEl.nextElementSibling;
      return {
        label: labelEl.textContent.trim(),
        value: valueEl?.textContent?.trim() || "—"
      };
    });

    const byLabel = (key) => summaryRows.find((row) => row.label.toUpperCase().includes(key))?.value || "—";

    return {
      productName,
      marketplace,
      suggestedPrice,
      received: byLabel("VOCÊ RECEBE"),
      profit: byLabel("LUCRO"),
      incidences: byLabel("TOTAL DE INCIDÊNCIAS"),
      faixa: byLabel("FAIXA APLICADA"),
      antecipacao: byLabel("ANTECIPA"),
      detailsRows
    };
  });
}

function buildReportCardsHTML(items) {
  return items.map((item) => `
    <section class="report-card" style="margin-top:18px;padding:16px;border:1px solid #d8dee8;border-radius:12px;break-inside:avoid;page-break-inside:avoid;">
      <h2 style="margin:0 0 10px;font-size:18px;color:#0f172a;">${escapeHTML(item.marketplace)}</h2>
      <div style="display:grid;grid-template-columns:1fr auto;gap:6px 12px;font-size:13px;">
        <span>Preço ideal</span><strong>${escapeHTML(item.suggestedPrice)}</strong>
        <span>Você recebe</span><strong>${escapeHTML(item.received)}</strong>
        <span>Lucro</span><strong>${escapeHTML(item.profit)}</strong>
        <span>Total de incidências</span><strong>${escapeHTML(item.incidences)}</strong>
        <span>Faixa aplicada</span><strong>${escapeHTML(item.faixa)}</strong>
        <span>Antecipação</span><strong>${escapeHTML(item.antecipacao)}</strong>
      </div>
      <h3 style="margin:14px 0 6px;font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#334155;">Detalhamento das incidências</h3>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <tbody>
          ${item.detailsRows.map((detail) => `
            <tr>
              <td style="padding:6px;border-top:1px solid #edf1f5;color:#475569;">${escapeHTML(detail.label)}</td>
              <td style="padding:6px;border-top:1px solid #edf1f5;text-align:right;font-weight:700;color:#0f172a;">${escapeHTML(detail.value)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </section>
  `).join("");
}

function getReportMarkup() {
  const items = collectReportItems();
  if (!items.length) return "";

  const productName = items[0]?.productName || "Produto sem nome";
  const today = new Date().toLocaleDateString("pt-BR");

  return `
    <section class="print-report" style="font-family:Inter,Arial,sans-serif;color:#0f172a;">
      <header style="border-bottom:2px solid #e2e8f0;padding-bottom:12px;margin-bottom:14px;">
        <div style="font-size:12px;letter-spacing:.08em;color:#334155;font-weight:700;">RELATÓRIO DE PRECIFICAÇÃO</div>
        <div style="margin-top:6px;font-size:13px;line-height:1.5;">
          <div>Produto: <strong>${escapeHTML(productName)}</strong></div>
          <div>Data: <strong>${escapeHTML(today)}</strong></div>
          <div>Domínio: <strong>precificacao.rafamaceno.com.br</strong></div>
        </div>
      </header>

      <h1 style="margin:0 0 14px;font-size:24px;line-height:1.2;">Relatório de Precificação do Produto "${escapeHTML(productName)}"</h1>

      ${buildReportCardsHTML(items)}
    </section>
  `;
}

function exportPDF() {
  const markup = getReportMarkup();
  if (!markup) {
    alert("Nenhum relatório disponível. Faça o cálculo primeiro.");
    return;
  }

  let printRoot = document.querySelector("#printRoot");
  if (!printRoot) {
    printRoot = document.createElement("div");
    printRoot.id = "printRoot";
    printRoot.className = "printRoot";
    printRoot.setAttribute("aria-hidden", "true");
    document.body.appendChild(printRoot);
  }

  const cleanup = () => {
    document.body.classList.remove("is-printing");
    printRoot.innerHTML = "";
    window.onafterprint = null;
  };

  printRoot.innerHTML = markup;
  document.body.classList.add("is-printing");
  window.onafterprint = cleanup;
  window.print();
}

function generatePDF() {
  exportPDF();
}

window.exportPDF = exportPDF;
window.generatePDF = generatePDF;
