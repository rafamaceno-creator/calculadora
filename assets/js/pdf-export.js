/* =========================
   PDF Export
   pdf-export.js
   ========================= */

function formatNumberBR(value, decimals = 2) {
  return Number(value || 0).toFixed(decimals).replace('.', ',');
}

function sanitizeFileName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 60);
}

function collectResultCards() {
  const cards = [...document.querySelectorAll('#results .card')];

  return cards.map((card) => {
    const title = card.querySelector('.cardTitle')?.textContent?.trim() || 'Marketplace';
    const commission = card.querySelector('.pill')?.textContent?.trim() || '—';
    const price = card.querySelector('.heroValue')?.textContent?.trim() || '—';

    const summaryRows = [...card.querySelectorAll('.resultGrid:not(.resultGrid--details) .k')].map((kEl, idx) => {
      const vEl = card.querySelectorAll('.resultGrid:not(.resultGrid--details) .v')[idx];
      return {
        key: kEl.textContent?.trim() || '',
        value: vEl?.textContent?.trim() || ''
      };
    }).filter((row) => row.key && row.value);

    const detailsRows = [...card.querySelectorAll('.resultGrid--details .k')].map((kEl, idx) => {
      const vEl = card.querySelectorAll('.resultGrid--details .v')[idx];
      return {
        key: kEl.textContent?.trim() || '',
        value: vEl?.textContent?.trim() || ''
      };
    }).filter((row) => row.key && row.value && row.key !== '—');

    return { title, commission, price, summaryRows, detailsRows };
  });
}

function generatePDF() {
  const calcName = document.querySelector('#calcName')?.value?.trim() || '';

  const cost = document.querySelector('#cost')?.value;
  const tax = document.querySelector('#tax')?.value;
  const profitType = document.querySelector('#profitType')?.value;
  const profitValue = document.querySelector('#profitValue')?.value;
  const mlClassicPct = document.querySelector('#mlClassicPct')?.value;
  const mlPremiumPct = document.querySelector('#mlPremiumPct')?.value;

  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const timeStr = now.toLocaleTimeString('pt-BR');

  const cards = collectResultCards();
  if (!cards.length) {
    alert('Nenhum resultado para exportar. Faça o cálculo primeiro.');
    return;
  }

  const referenceName = calcName || 'Cálculo sem nome';
  const safeName = sanitizeFileName(calcName) || `calculo_${dateStr.replace(/\//g, '-')}`;

  const cardsHtml = cards.map((card) => `
    <section class="platform-card">
      <div class="platform-head">
        <h3>${card.title}</h3>
        <span>${card.commission}</span>
      </div>
      <div class="price">Preço sugerido: <strong>${card.price}</strong></div>

      <table class="table">
        <thead><tr><th colspan="2">Resumo</th></tr></thead>
        <tbody>
          ${card.summaryRows.map((row) => `<tr><td>${row.key}</td><td>${row.value}</td></tr>`).join('')}
        </tbody>
      </table>

      ${card.detailsRows.length ? `
        <table class="table details">
          <thead><tr><th colspan="2">Detalhamento das incidências</th></tr></thead>
          <tbody>
            ${card.detailsRows.map((row) => `<tr><td>${row.key}</td><td>${row.value}</td></tr>`).join('')}
          </tbody>
        </table>
      ` : ''}
    </section>
  `).join('');

  const htmlContent = `
    <div class="pdf-wrap">
      <header>
        <h1>Precificação Marketplaces</h1>
        <p class="meta"><strong>Referência:</strong> ${referenceName}</p>
        <p class="meta">Gerado em ${dateStr} às ${timeStr}</p>
      </header>

      <section class="table-block">
        <h2>Dados de entrada</h2>
        <table class="table">
          <tbody>
            <tr><td>Preço de custo final</td><td>R$ ${formatNumberBR(cost)}</td></tr>
            <tr><td>Imposto de venda</td><td>${formatNumberBR(tax)}%</td></tr>
            <tr><td>Lucro desejado</td><td>${profitType === 'brl' ? 'R$ ' : ''}${formatNumberBR(profitValue)}${profitType === 'pct' ? '%' : ''}</td></tr>
            <tr><td>ML Clássico</td><td>${formatNumberBR(mlClassicPct)}%</td></tr>
            <tr><td>ML Premium</td><td>${formatNumberBR(mlPremiumPct)}%</td></tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>Resultados por marketplace</h2>
        ${cardsHtml}
      </section>
    </div>
  `;

  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.left = '-99999px';
  wrapper.style.top = '0';
  wrapper.style.width = '210mm';
  wrapper.innerHTML = `
    <style>
      .pdf-wrap { font-family: Arial, sans-serif; color: #111827; padding: 12mm; font-size: 12px; }
      h1 { margin: 0 0 4px; font-size: 20px; }
      h2 { margin: 16px 0 8px; font-size: 15px; }
      .meta { margin: 2px 0; color: #374151; }
      .table-block { margin-bottom: 10px; }
      .table { width: 100%; border-collapse: collapse; margin-top: 6px; }
      .table th, .table td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; vertical-align: top; }
      .table th { background: #f3f4f6; font-weight: 700; }
      .platform-card { border: 1px solid #d1d5db; border-radius: 6px; padding: 10px; margin-bottom: 10px; page-break-inside: avoid; }
      .platform-head { display: flex; justify-content: space-between; gap: 10px; align-items: center; margin-bottom: 6px; }
      .platform-head h3 { margin: 0; font-size: 14px; }
      .platform-head span { font-size: 11px; color: #4b5563; background: #f3f4f6; padding: 3px 6px; border-radius: 999px; }
      .price { margin-bottom: 8px; }
      .details { margin-top: 8px; }
    </style>
    ${htmlContent}
  `;

  document.body.appendChild(wrapper);

  const opt = {
    margin: 0,
    filename: `Precificacao_${safeName}_${dateStr.replace(/\//g, '-')}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
  };

  html2pdf()
    .set(opt)
    .from(wrapper)
    .save()
    .catch((error) => {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar PDF. Verifique o console.');
    })
    .finally(() => {
      wrapper.remove();
    });
}
