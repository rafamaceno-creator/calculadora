# Changelog

Registro das atualizações da calculadora. A entrada mais recente fica no topo.
Cada entrada leva a data, o build publicado (`version.json`) e o que mudou para quem usa.

## 2026-10-07 — build `20261007-1`

### Alterado
- **Shopee:** a taxa fixa da faixa de R$8 a R$79,99 subiu de R$4,00 para R$4,50 por item.
  A comissão nessa faixa passa a ser 20% + R$4,50. As demais faixas não mudaram
  (abaixo de R$8: 50% sem taxa fixa; R$80–R$99,99: 14% + R$16; R$100–R$199,99: 14% + R$20;
  acima de R$200: 14% + R$26).
  - Fórmula: `SHOPEE_FAIXAS` em `assets/js/main.js`.
  - Textos: FAQ da comissão Shopee em `index.html`.
  - Exemplo: item de R$50 → comissão de R$14,50 (antes R$14,00).
