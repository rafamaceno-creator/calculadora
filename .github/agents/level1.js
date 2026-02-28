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

  // 1) Generator pass (multi-agent plan + codex prompt)
  const systemGen = `
Você é um orquestrador multi-agente para melhorias incrementais no projeto.

FONTE DE VERDADE: siga as regras abaixo SEM EXCEÇÃO.

========================
AGENTS_RULES.md
========================
${rules}

Responda SEM markdown (apenas JSON).
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
  "frontend": "Escopo técnico com passos concretos e arquivos a localizar (sem inventar paths)",
  "qa": "Checklist de testes + não-regressão de cálculos",
  "codex_prompt": "UM PROMPT ÚNICO, pronto pra copiar/colar no Codex, com passos de localização no repo, critérios de aceite, e checklist de teste."
}

REGRAS DO CODEX_PROMPT (tem que cumprir):
- Começar com OBJETIVO (P0) e RESTRIÇÕES.
- Incluir passo explícito: 'localize no repo' (não inventar arquivo/caminho).
- Incluir como garantir acessibilidade (Tab + Enter/Space + foco visível) quando relevante.
- Incluir critérios de aceite e roteiro de teste manual.
- Repetir a restrição: NÃO alterar cálculos/fórmulas/custos/comissões/taxas.
- Mudanças mínimas e incrementais.
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
    // fallback: comment raw and stop
    const body = [
      "## 🤖 Agents – Improvement Plan (Level 1)",
      "",
      "⚠️ O modelo retornou fora do formato JSON. Resposta bruta:",
      "",
      "```txt",
      rawGen || "(vazio)",
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

  // 2) Critic pass: make codex_prompt SPECIFIC and non-generic
  const systemCritic = `
Você é um revisor exigente de prompts para Codex.
Seu trabalho: melhorar o prompt para ficar executável, específico e seguro.

Regras:
- NÃO pode violar AGENTS_RULES.md.
- NÃO pode permitir alterações de cálculo.
- Deve exigir que o Codex localize arquivos reais no repo (sem inventar).
- Deve incluir critérios de aceite e checklist de teste manual.
- Se o prompt estiver genérico demais, reescreva completo.
Retorne APENAS o prompt final (texto puro).
`.trim();

  const userCritic = `
Contexto:
Repo: ${repoUrl}
Issue: ${issueTitle}

Prompt atual:
${gen.codex_prompt}

Melhore para ficar "prompt matador" (executável e específico) mantendo mudanças mínimas.
`.trim();

  const improvedPrompt = await chat(
    [
      { role: "system", content: systemCritic },
      { role: "user", content: userCritic }
    ],
    0.2
  );

  // replace codex_prompt by improved version
  gen.codex_prompt = improvedPrompt;

  // 3) Post comment formatted with code block
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
    gen.codex_prompt || "(vazio)",
    "```"
  ].join("\n");

  await github.rest.issues.createComment({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: issueNumber,
    body,
  });
})();
