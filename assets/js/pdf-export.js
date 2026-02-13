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

  return cards.map((card) => {
    const calcName = document.querySelector("#calcName")?.value?.trim() || "Cálculo sem nome";
    const marketplace = card.querySelector(".cardTitle")?.textContent?.trim() || "Marketplace";
    const suggestedPrice = card.querySelector(".heroValue")?.textContent?.trim() || "—";
    const summaryRows = Array.from(card.querySelectorAll(".resultGrid:not(.resultGrid--details) .k"))
      .map((labelEl) => {
        const valueEl = labelEl.nextElementSibling;
        return {
          label: labelEl.textContent.trim().toUpperCase(),
          value: valueEl?.textContent?.trim() || "—"
        };
      });

    const detailsRows = Array.from(card.querySelectorAll(".resultGrid--details .k"))
      .map((labelEl) => {
        const valueEl = labelEl.nextElementSibling;
        return {
          label: labelEl.textContent.trim(),
          value: valueEl?.textContent?.trim() || "—"
        };
      });

    const findSummary = (key) => summaryRows.find((row) => row.label.includes(key))?.value || "—";
    const lucroLinha = findSummary("LUCRO");
    const margemMatch = lucroLinha.match(/\(([^)]+)\)/);

    return {
      calcName,
      marketplace,
      suggestedPrice,
      received: findSummary("VOCÊ RECEBE"),
      profit: lucroLinha,
      margin: margemMatch ? margemMatch[1] : "—",
      detailsRows
    };
  });
}

function buildReportCardsHTML(items) {
  return items.map((item) => `
    <section class="report-card">
      <h2>${escapeHTML(item.marketplace)}</h2>
      <div class="meta">Nome do cálculo: <strong>${escapeHTML(item.calcName)}</strong></div>
      <div class="row"><span>Marketplace</span><strong>${escapeHTML(item.marketplace)}</strong></div>
      <div class="row"><span>Preço sugerido</span><strong>${escapeHTML(item.suggestedPrice)}</strong></div>
      <div class="row"><span>Você recebe</span><strong>${escapeHTML(item.received)}</strong></div>
      <div class="row"><span>Lucro</span><strong>${escapeHTML(item.profit)}</strong></div>
      <div class="row"><span>Margem</span><strong>${escapeHTML(item.margin)}</strong></div>
      <h3>Detalhamento</h3>
      <table>
        <tbody>
          ${item.detailsRows.map((detail) => `
            <tr>
              <td>${escapeHTML(detail.label)}</td>
              <td>${escapeHTML(detail.value)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </section>
  `).join("");
}

function getReportMarkup() {
  const reportRoot = document.querySelector("#reportRoot");
  if (reportRoot && reportRoot.innerHTML.trim()) {
    return reportRoot.innerHTML;
  }

  const items = collectReportItems();
  if (!items.length) return "";

  const now = new Date();
  const dateTime = now.toLocaleString("pt-BR");

  return `
    <section class="print-report">
      <h1>Relatório de Precificação</h1>
      <div class="date">Gerado em ${escapeHTML(dateTime)}</div>
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
