/* =========================
   PDF Export (Modo A)
   ========================= */

function sanitizeFileName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_\s]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 60);
}

function waitForRender() {
  return new Promise(async (resolve) => {
    requestAnimationFrame(async () => {
      if (document.fonts?.ready) {
        try { await document.fonts.ready; } catch (_) {}
      }
      requestAnimationFrame(resolve);
    });
  });
}

function drawInstagramIcon(pdf, x, y, size) {
  const radius = 0.8;
  pdf.roundedRect(x, y, size, size, radius, radius, "S");
  pdf.circle(x + size * 0.5, y + size * 0.5, size * 0.22, "S");
  pdf.circle(x + size * 0.78, y + size * 0.22, size * 0.05, "F");
}

function addWatermark(pdf, pageWidth, pageHeight) {
  const lines = ["precificacao.rafamaceno.com.br", "@macenorafa"];
  const angle = -30;
  const spacingX = 80;
  const spacingY = 55;

  pdf.setTextColor(100, 116, 139);
  pdf.setDrawColor(100, 116, 139);
  pdf.setGState?.(new pdf.GState({ opacity: 0.08 }));

  const instaUrl = "https://www.instagram.com/macenorafa/";

  for (let y = -20; y < pageHeight + 40; y += spacingY) {
    for (let x = -20; x < pageWidth + 40; x += spacingX) {
      pdf.setFontSize(16);
      pdf.text(lines[0], x, y, { angle });

      const textY = y + 10;
      const iconSize = 5;
      drawInstagramIcon(pdf, x, textY - 4, iconSize);
      pdf.text(lines[1], x + iconSize + 2, textY, { angle });

      pdf.link(x - 2, textY - 8, 38, 10, { url: instaUrl });
    }
  }

  pdf.setGState?.(new pdf.GState({ opacity: 1 }));
  pdf.setTextColor(15, 23, 42);
  pdf.setDrawColor(15, 23, 42);
}

async function generatePDF() {
  const reportRoot = document.querySelector("#reportRoot");
  if (!reportRoot || !reportRoot.textContent.trim()) {
    alert("Nenhum relatório disponível. Faça o cálculo primeiro.");
    return;
  }

  const calcName = document.querySelector("#calcName")?.value?.trim() || "calculo";
  const safeName = sanitizeFileName(calcName) || "calculo";

  reportRoot.style.display = "block";
  await waitForRender();

  const canvas = await html2canvas(reportRoot, {
    scale: 3,
    backgroundColor: "#ffffff",
    useCORS: true
  });

  const imgData = canvas.toDataURL("image/jpeg", 0.98);
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const usableWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height * usableWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = margin;

  addWatermark(pdf, pageWidth, pageHeight);
  pdf.addImage(imgData, "JPEG", margin, position, usableWidth, imgHeight);
  heightLeft -= (pageHeight - margin * 2);

  while (heightLeft > 0) {
    pdf.addPage();
    addWatermark(pdf, pageWidth, pageHeight);
    position = margin - (imgHeight - heightLeft);
    pdf.addImage(imgData, "JPEG", margin, position, usableWidth, imgHeight);
    heightLeft -= (pageHeight - margin * 2);
  }

  const now = new Date().toISOString().slice(0, 10);
  pdf.save(`Precificacao_${safeName}_${now}.pdf`);
}
