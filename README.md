# Calculadora de Precificação

## Google Analytics 4 (GA4)

- **Measurement ID (GA4):** `G-7RHBD29L5S`

## Eventos implementados

- `usuario_engajado`
- `perfil_ticket`
- `export_pdf`
- `cta_click`

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
