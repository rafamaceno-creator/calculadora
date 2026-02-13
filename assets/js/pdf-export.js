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

function buildPrintHTML(items) {
  const now = new Date();
  const dateTime = now.toLocaleString("pt-BR");

  const cardsHTML = items.map((item) => `
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

  return `<!doctype html>
  <html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Relatório de Precificação</title>
    <style>
      body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;padding:24px;margin:0}
      h1{margin:0 0 8px;font-size:24px}
      .date{color:#475569;font-size:12px;margin-bottom:18px}
      .report-card{border:1px solid #cbd5e1;border-radius:12px;padding:14px;margin-bottom:14px;break-inside:avoid}
      .report-card h2{margin:0 0 8px;font-size:18px}
      .report-card .meta{font-size:13px;color:#334155;margin-bottom:8px}
      .row{display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px dashed #e2e8f0}
      .row:last-of-type{margin-bottom:8px}
      .row span{color:#334155}
      h3{margin:12px 0 6px;font-size:14px}
      table{width:100%;border-collapse:collapse;font-size:13px}
      td{border-top:1px solid #e2e8f0;padding:6px 2px;vertical-align:top}
      td:last-child{text-align:right;font-weight:600}
      @media print { body{padding:12mm} }
    </style>
  </head>
  <body>
    <h1>Relatório de Precificação</h1>
    <div class="date">Gerado em ${escapeHTML(dateTime)}</div>
    ${cardsHTML}
  </body>
  </html>`;
}

async function generatePDF() {
  const reportRoot = document.querySelector("#reportRoot");
  if (!reportRoot || !reportRoot.textContent.trim()) {
    alert("Nenhum relatório disponível. Faça o cálculo primeiro.");
    return;
  }

  const items = collectReportItems();
  if (!items.length) {
    alert("Nenhum resultado encontrado para exportar.");
    return;
  }

  const printWindow = window.open("", "_blank", "noopener,noreferrer");
  if (!printWindow) {
    throw new Error("Não foi possível abrir a janela de impressão (popup bloqueado).");
  }

  printWindow.document.open();
  printWindow.document.write(buildPrintHTML(items));
  printWindow.document.close();

  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
  };

  printWindow.onafterprint = () => {
    printWindow.close();
  };

  setTimeout(() => {
    if (!printWindow.closed) {
      printWindow.close();
    }
  }, 120000);
}


window.generatePDF = generatePDF;
