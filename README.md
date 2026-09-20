# Calculadora de Precificação

## Google Analytics 4 (GA4)

- **Measurement ID (GA4):** `G-7RHBD29L5S`

## Onde o GA4 está instalado

`index.html`, `a-hora-com-o-especialista.html` e `obrigado.php`. Nesta última o
`page_location` é reescrito sem a query string: a URL carrega o `session_id` do
Stripe, que vale como credencial (quem tem ele obtém um token em
`/api/get-token.php`), e não pode chegar ao Google.

## Eventos implementados

Os nomes abaixo saem do código (`assets/js/main.js` e `assets/js/ledger.js`) —
confira lá antes de configurar qualquer coisa no painel do GA4.

Funil principal:

- `user_engaged` — primeira interação real do visitante
- `profile_ticket` — faixa de ticket do usuário (parâmetro `faixa`)
- `wizard_step` — navegação entre os 4 passos (parâmetros: `step`, `mode`)
- `apply_cost_suggestion` — sugestão de custo extra aplicada (parâmetros: `tipo`, `valor`, `unidade`)
- `export_pdf` — exportação do relatório (parâmetro `section`)
- `generate_lead` — captura de e-mail confirmada pelo servidor (parâmetros: `method`, `marketplace`)
- `click_specialist` — clique no CTA da Hora com o Especialista (parâmetro `section`)
- `purchase` — pagamento confirmado em `obrigado.php` (parâmetros: `value` 997, `currency` BRL,
  `transaction_id` = SHA-256 truncado do `session_id`, nunca o identificador cru)

Há outros eventos de uso da ferramenta (`recalc`, `bulk_calculate`, `save_simulation`,
`view_composition`, `share_whatsapp`, `copy_link` e afins) disparados pelos mesmos arquivos.

**User property:** `perfil_ticket` é propriedade de usuário, não evento — não procure por
ela na lista de eventos do GA4.

## Como configurar Key events no GA4

1. Acesse **Administrador** no GA4.
2. Em **Eventos**, localize:
   - `purchase`
   - `generate_lead`
   - `click_specialist`
   - `export_pdf`
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

## Meta Pixel e API de Conversões

- **Pixel (dataset):** `4410552279212380` — "Calculadora de Precificação".
- Código base (PageView) no `<head>` de `index.html` e `a-hora-com-o-especialista.html`.
  Fica fora de `obrigado.php` e `agendar.php`, porque essas URLs carregam `session_id`/token.
- **CalculoConcluido** (evento personalizado): marca quem usou a calculadora, uma vez por visita,
  ao chegar no passo 4 (Resultado) ou ao calcular em lote. Parâmetros: `origem` (`passo_4`|`lote`)
  e `modo` (`ideal`|`real`). Não depende de e-mail.
- **Lead:** disparado em `submitLeadCaptureForm` (`assets/js/main.js`) só depois que `/api/lead.php`
  confirma o cadastro, com `eventID` = `meta_event_id` enviado no payload.
- **API de Conversões:** `api/lead.php` chama `meta_capi_send_lead()` (`api/meta-capi.php`) depois de
  responder ao navegador, com o mesmo `event_id` (deduplicação). E-mail e nome vão em SHA-256.
- O token fica **só** no `api/config.local.php` do servidor: `const META_CAPI_TOKEN = '...';`
  (opcional durante testes: `const META_CAPI_TEST_CODE = 'TEST12345';`). Sem token, nada é enviado.
- Para conferir se o token está configurado no servidor **sem expor o valor**, chame
  `/api/health.php?token=SEU_HEALTH_TOKEN` e veja `meta_capi_token_present`
  (e `meta_capi_test_code_present`). O endpoint devolve só `true`/`false`.

## Endpoints de diagnóstico

`/api/health.php` e `/api/health-env.php` exigem `?token=` igual ao `HEALTH_TOKEN`
do `api/config.local.php`. Ambos respondem só `true`/`false` sobre o que está
configurado — nunca o valor de nenhum segredo. Sem token, respondem 401.
