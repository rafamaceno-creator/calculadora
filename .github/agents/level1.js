const fs = require("fs");

(async () => {
  const apiKey = process.env.OPENAI_API_KEY;
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

  async function chat(messages, temperature = 0.2) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
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

  // Prevent markdown fence breakage inside a fenced block
  function sanitizeCodeFences(text) {
    if (!text) return text;
    // Replace any triple-backtick fences with triple-tilde to avoid breaking outer ```txt block
    return text.replace(/```/g, "~~~");
  }

  // 1) Generator pass (strict JSON)
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
- O codex_prompt DEVE conter uma seção 'COMO LOCALIZAR NO REPO' com comandos de busca (exemplos):
  - rg -n "marketplace|Marketplaces|Selecione marketplaces|Shopee|Mercado Livre|SHEIN|Amazon|TikTok"
  - rg -n "marketplaceChip|mpIcon|mpCheck|chip"
  - find . -iname "*.svg"
- Preferir HTML acessível nativo: <button> OU <input + label> (evitar role="button").
- IMPORTANTE: NÃO use blocos de código markdown (não use ```). Use apenas texto normal.
`.trim();

  let rawGen = await chat(
    [
      { role: "system", content: systemGen },
      { role: "user", content: userGen }
    ],
    0.2
  );

  let gen = null;
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
      "```"
    ].join("\n");

    await github.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: issueNumber,
      body,
    });
    return;
  }

  // 2) Critic pass: rewrite codex_prompt as plain text (no ```), no invented paths, must include search commands
  const systemCritic = `
Você é um revisor MUITO exigente de prompts para Codex.

OBJETIVO:
Transformar o prompt em um "PROMPT MATADOR" executável e específico.

REGRAS ABSOLUTAS:
- NÃO pode violar AGENTS_RULES.md.
- PROIBIDO alterar cálculos/fórmulas/custos/comissões/taxas/regras financeiras.
- PROIBIDO inventar arquivos ou paths (NÃO use "provavelmente em src/...").
- O prompt deve incluir 'COMO LOCALIZAR NO REPO' com comandos (rg/find).
- Preferir HTML acessível nativo: <button> OU <input + label>.
- NÃO use blocos de código markdown (NÃO use ```). Se precisar mostrar comandos, escreva como texto simples com prefixo "$ ".
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

  const improvedPrompt = await chat(
    [
      { role: "system", content: systemCritic },
      { role: "user", content: userCritic }
    ],
    0.2
  );

  gen.codex_prompt = improvedPrompt;

  // Sanitize any accidental fences anyway
  const safeCodexPrompt = sanitizeCodeFences(gen.codex_prompt || "(vazio)");

  // 3) Post comment with ONE single fenced block for Codex prompt
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
    "```"
  ].join("\n");

  await github.rest.issues.createComment({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: issueNumber,
    body,
  });
})();
