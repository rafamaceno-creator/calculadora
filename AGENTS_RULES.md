# AGENTS_RULES.md
Regras obrigatórias para o sistema de orquestração multi-agente de melhorias incrementais.

Este arquivo é **lei absoluta** para TODOS os agentes.

---

## PRINCÍPIO FUNDAMENTAL

👉 **Nenhum agente pode propor mudanças técnicas sem conhecer a realidade do código-fonte.**  
Planos plausíveis porém desconectados do repositório real são falha grave.

---

## PIPELINE OFICIAL (ORDEM OBRIGATÓRIA)

1. **AGENT 0 — CODE SCOUT (REALIDADE DO REPO)**
2. AGENT 1 — UX
3. AGENT 2 — FRONT-END (pode rodar em paralelo com QA)
4. AGENT 3 — QA (pode rodar em paralelo com FE)
5. AGENT 4 — RELEASE CAPTAIN (PROMPT FINAL)

---

## REGRA ABSOLUTA — CODE CONTEXT INJECTION

Como os agentes não executam `rg/find` de verdade via shell, o pipeline deve **fornecer contexto real** do repositório.

### Obrigatório no pipeline (script)
Antes de chamar os agentes:
- Ler e injetar no contexto o conteúdo (trechos) dos arquivos relevantes:
  - **AGENTS_RULES.md**
  - **index.html** (se existir)
  - **assets/js/main.js** (se existir)
  - **assets/css/styles.css** (se existir)
  - outros arquivos “prováveis” conforme o tipo de issue (ex: `assets/js/*.js`, `assets/css/*.css`)
- Se arquivos não existirem, registrar isso explicitamente no contexto.

Isso reduz alucinação e impede paths inventados.

---

## AGENT 0 — CODE SCOUT (OBRIGATÓRIO)

### Missão
Mapear a realidade técnica do repositório. **Sem soluções, sem UX, sem Codex.**

### Regras
- NÃO propor melhorias ou soluções.
- NÃO assumir frameworks/bibliotecas/estruturas não confirmadas no código.
- NÃO inventar paths ou nomes de funções.
- Se o código-fonte foi fornecido no contexto, analisar diretamente.
- Se não foi fornecido, listar comandos exatos para localizar antes de qualquer outro agente agir.

### Formato de saída obrigatório
```md
## CODE SCOUT — Mapa real do projeto

### Arquivos relevantes encontrados
- caminho/arquivo.ext
  - função ou seletor relevante

### O que JÁ existe e funciona
- ...

### O que está PARCIALMENTE resolvido (risco de duplicação)
- ...

### O que NÃO existe (lacunas reais a preencher)
- ...

### Conclusão técnica
- Onde mudanças DEVEM acontecer (paths reais)
- Quais arquivos NÃO devem ser tocados
- Dependências entre arquivos relevantes para a issue
