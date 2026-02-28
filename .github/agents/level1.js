const fs = require("fs");

(async () => {
  // 1) Validate OPENAI key
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    core.setFailed("Missing OPENAI_API_KEY. Add it in Settings → Secrets and variables → Actions.");
    return;
  }

  // 2) Read rules from repo root
  const rulesPath = "AGENTS_RULES.md";
  if (!fs.existsSync(rulesPath)) {
    core.setFailed("AGENTS_RULES.md not found in repo root.");
    return;
  }
  const rules = fs.readFileSync(rulesPath, "utf8");

  // 3) Get issue context
  const issueTitle = context.payload.issue?.title || "";
  const issueBody = context.payload.issue?.body || "";
  const issueNumber = context.payload.issue?.number;
  const repoUrl = `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}`;

  // 4) Prompt construction (ask for strict JSON to format cleanly)
  const systemMsg = `
Você é um orquestrador multi-agente para melhorias incrementais no projeto.

FONTE DE VERDADE: siga as regras abaixo SEM EXCEÇÃO.

========================
AGENTS_RULES.md
========================
${rules}
`.trim();

  const userMsg = `
Repo: ${repoUrl}

ISSUE
Título: ${issueTitle}

Descrição:
${issueBody}

TAREFA
Responda em PT-BR e retorne APENAS um JSON válido (sem markdown) com estas chaves:
{
  "ux": "...",
  "frontend": "...",
  "qa": "...",
  "codex_prompt": "..."
}

Regras do conteúdo:
- Foco em utilidade e correção do problema descrito.
- PROIBIDO alterar fórmulas/cálculos/custos/comissões/taxas/regras financeiras.
- PR pequeno, mudanças mínimas.
- "codex_prompt" deve ser um prompt único, pronto para copiar e colar no Codex.
- Não invente caminhos/arquivos: instrua o Codex a localizar os pontos corretos no repo.
`.trim();

  async function callOpenAI() {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature: 0.2,
        messages: [
          { role: "system", content: systemMsg },
          { role: "user", content: userMsg },
        ],
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(`OpenAI API error ${res.status}: ${JSON.stringify(data)}`);
    }
    return data.choices?.[0]?.message?.content?.trim() || "";
  }

  let raw = "";
  let parsed = null;

  try {
    raw = await callOpenAI();
    parsed = JSON.parse(raw);
  } catch (err) {
    parsed = null;
  }

  // 5) Build comment (PROMPT in code block)
  let body = "## 🤖 Agents – Improvement Plan (Level 1)\n\n";

  if (parsed && parsed.ux && parsed.frontend && parsed.qa && parsed.codex_prompt) {
    body += [
      "### 🧠 UX",
      parsed.ux,
      "",
      "---",
      "### 🛠️ Front-end",
      parsed.frontend,
      "",
      "---",
      "### 🧪 QA",
      parsed.qa,
      "",
      "---",
      "### 🚀 PROMPT PARA O CODEX (copie e cole)",
      "```txt",
      parsed.codex_prompt,
      "```",
    ].join("\n");
  } else {
    body += [
      "⚠️ Não consegui parsear JSON (modelo retornou fora do formato). Segue resposta bruta:",
      "",
      "```txt",
      raw || "(vazio)",
      "```",
    ].join("\n");
  }

  // 6) Post comment to issue
  await github.rest.issues.createComment({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: issueNumber,
    body,
  });
})();
