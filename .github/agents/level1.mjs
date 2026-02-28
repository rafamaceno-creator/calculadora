import fs from "fs";

function sanitizeCodeFences(text) {
  if (!text) return text;
  return text.replace(/```/g, "~~~");
}

async function chat({ apiKey, messages, temperature = 0.2 }) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      temperature,
      messages,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`OpenAI API error ${res.status}: ${JSON.stringify(data)}`);
  return data.choices?.[0]?.message?.content?.trim() || "";
}

export async function run({ github, context, core, apiKey }) {
  if (!apiKey) {
    core.setFailed("Missing OPENAI_API_KEY. Add it in Settings → Secrets and variables → Actions.");
    return;
  }

  const rulesPath = "AGENTS_RULES.md";
  if (!fs.existsSync(rulesPath)) {
    core.setFailed("AGENTS_RULES.md not found in repo root.");
    return;
  }
  const rules = fs.readFileSync(rulesPath, "utf8");

  const issueTitle = context.payload.issue?.title || "";
  const issueBody = context.payload.issue?.body || "";
  const issueNumber = context.payload.issue?.number;
  const repoUrl = `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}`;

  // 1) Generator (JSON only)
  const systemGen = `
Você é um orquestrador multi-agente para melhorias incrementais no projeto.

FONTE DE VERDADE: siga as regras abaixo SEM EXCEÇÃO.

========================
AGENTS_RULES.md
========================
${rules}

FORMATO: responda APENAS JSON válido (sem markdown).
`.trim();

  const userGen = `
Repo: ${repoUrl}

ISSUE
Título: ${issueTitle}

Descrição:
${issueBody}

SAÍDA OBRIGATÓRIA (JSON válido, sem markdown):
{
  "ux": "Lista priorizada (P0/P1) com solução mínima e impacto/esforço",
  "frontend": "Escopo técnico com passos concretos",
  "qa": "Checklist de testes + não-regressão",
  "codex_prompt": "UM PROMPT ÚNICO, pronto pra copiar/colar no Codex"
}

REGRAS CRÍTICAS:
- PROIBIDO alterar fórmulas/cálculos/custos/comissões/taxas/regras financeiras.
- Mudanças mínimas e incrementais.
- NÃO inventar caminhos/arquivos. Se precisar mencionar arquivos, exija que o Codex localize no repo com busca.
- O codex_prompt DEVE conter uma seção 'COMO LOCALIZAR NO REPO' com comandos (escreva como texto, sem ```):
  - $ rg -n "marketplace|Marketplaces|Selecione marketplaces|Shopee|Mercado Livre|SHEIN|Amazon|TikTok"
  - $ rg -n "marketplaceChip|mpIcon|mpCheck|chip"
  - $ find . -iname "*.svg"
- Preferir HTML acessível nativo: <button> OU <input + label> (evitar role="button").
- IMPORTANTE: NÃO use blocos de código markdown (não use ```).
`.trim();

  let rawGen = await chat({
    apiKey,
    messages: [
      { role: "system", content: systemGen },
      { role: "user", content: userGen },
    ],
    temperature: 0.2,
  });

  let gen;
  try {
    gen = JSON.parse(rawGen);
  } catch (e) {
    const body = [
      "## 🤖 Agents – Improvement Plan (Level 1)",
      "",
      "⚠️ O modelo retornou fora do formato JSON. Resposta bruta:",
      "",
      "```txt",
      sanitizeCodeFences(rawGen || "(vazio)"),
      "```",
    ].join("\n");

    await github.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: issueNumber,
      body,
    });
    return;
  }

  // 2) Critic (rewrite prompt to be executable, no invented paths, no markdown fences)
  const systemCritic = `
Você é um revisor MUITO exigente de prompts para Codex.

REGRAS ABSOLUTAS:
- NÃO violar AGENTS_RULES.md.
- PROIBIDO alterar cálculos/fórmulas/custos/comissões/taxas/regras financeiras.
- PROIBIDO inventar arquivos/paths (NÃO use "provavelmente em src/...").
- Deve conter 'COMO LOCALIZAR NO REPO' com comandos (como texto com "$ ", sem ```).
- Preferir HTML acessível nativo: <button> OU <input + label>.
- NÃO use blocos de código markdown (NÃO use ```).
- Estrutura obrigatória:
  1) OBJETIVO (P0)
  2) RESTRIÇÕES
  3) COMO LOCALIZAR NO REPO
  4) IMPLEMENTAÇÃO
  5) CRITÉRIOS DE ACEITE
  6) ROTEIRO DE TESTE MANUAL
Retorne APENAS o prompt final (texto puro).
`.trim();

  const userCritic = `
Repo: ${repoUrl}
Issue: ${issueTitle}

PROMPT ATUAL:
${gen.codex_prompt}
`.trim();

  const improvedPrompt = await chat({
    apiKey,
    messages: [
      { role: "system", content: systemCritic },
      { role: "user", content: userCritic },
    ],
    temperature: 0.2,
  });

  gen.codex_prompt = improvedPrompt;

  const safeCodexPrompt = sanitizeCodeFences(gen.codex_prompt || "(vazio)");

  const body = [
    "## 🤖 Agents – Improvement Plan (Level 1)",
    "",
    "### 🧠 UX",
    gen.ux || "(vazio)",
    "",
    "---",
    "### 🛠️ Front-end",
    gen.frontend || "(vazio)",
    "",
    "---",
    "### 🧪 QA",
    gen.qa || "(vazio)",
    "",
    "---",
    "### 🚀 PROMPT PARA O CODEX (copie e cole)",
    "```txt",
    safeCodexPrompt,
    "```",
  ].join("\n");

  await github.rest.issues.createComment({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: issueNumber,
    body,
  });
}
