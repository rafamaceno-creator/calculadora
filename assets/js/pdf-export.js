/* =========================
   Exportação para impressão (iframe)
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
  const cards = Array.from(document.querySelectorAll("#results .marketplaceCard"));
  const productNameRaw = document.querySelector("#calcName")?.value?.trim() || "";
  const productName = productNameRaw || "Produto sem nome";

  return cards.map((card) => {
    const marketplace = card.querySelector(".cardTitle")?.textContent?.trim() || "Marketplace";
    const suggestedPrice = card.querySelector(".heroValue")?.textContent?.trim() || "—";

    const summaryRows = Array.from(card.querySelectorAll(".resultGrid:not(.resultGrid--details) .k")).map((labelEl) => {
      const valueEl = labelEl.nextElementSibling;
      return {
        label: labelEl.textContent.replace(/\s+/g, " ").trim(),
        value: valueEl?.textContent?.replace(/\s+/g, " ").trim() || "—"
      };
    });

    const byLabel = (key) => summaryRows.find((row) => row.label.toUpperCase().includes(key))?.value || "—";

    return {
      productName,
      marketplace,
      suggestedPrice,
      received: byLabel("VOCÊ RECEBE"),
      profit: byLabel("LUCRO"),
      incidences: byLabel("TOTAL DE INCIDÊNCIAS")
    };
  });
}

function getReportMarkup() {
  const items = collectReportItems();
  if (!items.length) return "";

  const productName = items[0]?.productName || "Produto sem nome";
  const dateTime = new Date().toLocaleString("pt-BR");

  return `
    <section class="print-report" style="font-family:Inter,Arial,sans-serif;color:#0f172a;padding:20px;">
      <header style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;border-bottom:2px solid #e2e8f0;padding-bottom:12px;margin-bottom:14px;">
        <div>
          <div style="font-size:12px;letter-spacing:.08em;color:#334155;font-weight:700;text-transform:uppercase;">Modo A — Somente resultados</div>
          <h1 style="margin:6px 0 0;font-size:24px;line-height:1.2;">Relatório de Precificação — ${escapeHTML(productName)}</h1>
        </div>
        <div style="font-size:12px;color:#475569;white-space:nowrap;">${escapeHTML(dateTime)}</div>
      </header>
      ${items.map((item) => `
      <section class="report-card" style="margin-top:14px;padding:14px;border:1px solid #d8dee8;border-radius:12px;break-inside:avoid;page-break-inside:avoid;">
        <h2 style="margin:0 0 10px;font-size:18px;color:#0f172a;">${escapeHTML(item.marketplace)}</h2>
        <div style="display:grid;grid-template-columns:1fr auto;gap:7px 12px;font-size:13px;">
          <span>Preço ideal</span><strong>${escapeHTML(item.suggestedPrice)}</strong>
          <span>Você recebe</span><strong>${escapeHTML(item.received)}</strong>
          <span>Lucro</span><strong>${escapeHTML(item.profit)}</strong>
          <span>Total de incidências</span><strong>${escapeHTML(item.incidences)}</strong>
        </div>
      </section>
      `).join("")}
    </section>
  `;
}

function exportPDF() {
  const markup = getReportMarkup();
  if (!markup) {
    alert("Nenhum relatório disponível. Faça o cálculo primeiro.");
    return;
  }

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.setAttribute("aria-hidden", "true");

  const cleanup = () => {
    setTimeout(() => {
      iframe.remove();
    }, 600);
  };

  iframe.onload = () => {
    const win = iframe.contentWindow;
    if (!win) return cleanup();
    win.focus();
    win.print();
    cleanup();
  };

  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) return cleanup();

  doc.open();
  doc.write(`
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>Relatório de Precificação</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body{margin:0;background:#ffffff;color:#0f172a;font-family:Inter,Arial,sans-serif}
          @page{size:A4 portrait;margin:12mm}
        </style>
      </head>
      <body>${markup}</body>
    </html>
  `);
  doc.close();
}

window.exportPDF = exportPDF;
window.generatePDF = exportPDF;
