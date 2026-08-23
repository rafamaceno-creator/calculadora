# Calculadora de Precificação

## Google Analytics 4 (GA4)

- **Measurement ID (GA4):** `G-7RHBD29L5S`

## Eventos implementados

- `usuario_engajado`
- `perfil_ticket`
- `export_pdf`
- `cta_click`
- `wizard_step` — navegação entre os 4 passos (parâmetros: `step`, `mode`)
- `apply_cost_suggestion` — sugestão de custo extra aplicada no passo Resultado (parâmetros: `tipo`, `valor`, `unidade`)

## Como configurar Key events no GA4

1. Acesse **Administrador** no GA4.
2. Em **Eventos**, localize os eventos:
   - `export_pdf`
   - `cta_click`
3. Marque cada um como **Key event** (evento principal).

## Como criar dimensões personalizadas no GA4

Acesse **Administrador → Definições personalizadas → Criar dimensão personalizada** e crie:

1. **Faixa de ticket**
   - Escopo: **Evento**
   - Parâmetro do evento: `faixa`

2. **Preço sugerido**
   - Escopo: **Evento**
   - Parâmetro do evento: `preco_sugerido`

## Arquitetura do front-end (redesign "Ledger")

- `index.html` — estrutura do wizard de 4 passos, prévia por canal e seções de conteúdo.
- `assets/css/styles.css` — tokens do design Ledger (tema claro/escuro), layout e componentes.
- `assets/js/main.js` — **motor de cálculo** (tabelas oficiais dos canais, `solvePrice`,
  `solvePriceComFaixa`, `resultAtPrice`), GA4, cálculo em lote e simulações salvas.
- `assets/js/ledger.js` — camada de UI: estado do wizard, prévia em tempo real, cards de
  resultado, sugestão de custos extras e tema. Envolve `window.recalc` para redesenhar a
  interface depois de cada cálculo e atualiza o DOM no lugar (nunca troca `innerHTML` do
  container), para não engolir cliques nem fechar os cards abertos a cada tecla.
- `assets/js/pdf-export.js` — relatório de impressão, montado a partir dos cards do Ledger.
- `#results`, `#reportRoot` e `#shareBox` continuam no DOM ocultos: alimentam o filtro por
  canal e as rotinas legadas do motor.
