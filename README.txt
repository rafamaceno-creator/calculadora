SITE: Precificação de Marketplace (comissão Shopee por faixa + básico→avançado)
STACK: HTML + CSS + JS (puro) — pronto para Hostinger (public_html)

========================
1) UPLOAD NA HOSTINGER
========================
1. hPanel -> Hospedagem -> Gerenciador de Arquivos
2. Abra public_html
3. Envie TODO o conteúdo deste pacote:
   - index.html
   - assets/ (css, js, img)
   - robots.txt
   - sitemap.xml

========================
2) EDITAR LINKS (WHATS/INSTA)
========================
Arquivo: /assets/js/main.js
const LINKS = {
  whatsapp: "https://chat.whatsapp.com/SEU_LINK",
  instagram: "https://instagram.com/SEU_INSTAGRAM"
};

========================
3) COMO A SHOPEE É CALCULADA
========================
A Shopee muda a comissão conforme o PREÇO DE VENDA (valor do item).
O sistema testa cada faixa, calcula o preço assumindo aquela faixa e valida se o preço cai no intervalo.
A primeira faixa que “fecha” é aplicada e exibida no card.

========================
4) COMO FUNCIONA O FLUXO
========================
- Você preenche custo + imposto + lucro → o resultado aparece (com comissões).
- Só após o primeiro cálculo o site libera o “modo avançado”.
- No avançado você adiciona custos extras (fixo, Ads, devolução, etc).

========================
5) CHECKLIST
========================
[ ] Testar no celular
[ ] Digitar custo/imposto/lucro e ver cards atualizando
[ ] Ver no card da Shopee a faixa aplicada
[ ] Ativar avançado e validar campos extras
[ ] Copiar link e abrir em outra aba (persistência)
