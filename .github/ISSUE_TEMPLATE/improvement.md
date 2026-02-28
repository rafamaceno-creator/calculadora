---
name: Improvement (Utilidade/Simplicidade)
about: Melhorias focadas em utilidade, simplicidade e UX
title: "[IMPROVE] <título curto e direto>"
labels: ["improve"]
---

## O que quero melhorar
Descreva em 1–3 frases, no formato:
- Hoje acontece: ...
- O problema é: ...
- Eu quero: ...

## Por que isso é importante (utilidade)
- Impacto no usuário: ...
- Impacto no negócio/uso: ...

## Escopo permitido
Marque com X:
- [ ] Apenas UI/CSS/Responsividade (sem mexer fluxo)
- [ ] Pode mexer no fluxo do wizard para simplificar
- [ ] Pode reorganizar opções avançadas para ficarem mais intuitivas
- [ ] Pode criar defaults / auto-seleções (sem mudar fórmulas)

## Escopo proibido (fixo)
- [x] NÃO alterar fórmulas/custos/comissionamento/taxas
- [x] NÃO alterar regras de cálculo (a não ser em issue/PR separado “AUDIT” com evidências)
- [x] NÃO refatorar grande sem necessidade

## Evidências
- Prints/links (cole aqui)
- Arquivos/trechos envolvidos (se souber)

## Critérios de aceite (como eu vou dizer “ficou bom”)
Exemplos:
- Em mobile, não quebra layout em 360px
- Usuário chega no resultado em X passos
- Opções avançadas ficam claras e com explicação curta
- Sem regressão nos cálculos (comparação de 3 cenários)

## Casos de teste (se tiver)
Liste 2–5 cenários:
1) Marketplace X, preço Y, frete Z → resultado esperado (não precisa número, pode ser “não mudou”)
2) ...
