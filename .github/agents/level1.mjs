import fs from "fs";

async function openaiChat({ apiKey, messages }) {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      temperature: 0.2,
      messages,
    }),
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(`OpenAI error ${resp.status}: ${JSON.stringify(data)}`);
  }
  return (data.choices?.[0]?.message?.content || "").trim();
}

function safeBlock(text) {
  const t = (text || "").trim();
  // Evita quebrar markdown do comentário se o modelo soltar ```
  return t.replace(/```/g, "~~~");
}

export async function run({ github, context, core, apiKey }) {
  try {
    if (!apiKey) throw new Error("Missing OPENAI_API_KEY. Add it in repo Secrets (Actions).");

    const rulesPath = "AGENTS_RULES.md";
    if (!fs.existsSync(rulesPath)) throw new Error("AGENTS_RULES.md not found in repo root.");

    const rules = fs.readFileSync(rulesPath, "utf8");

    const issue = context.payload.issue;
    if (!issue) throw new Error("No issue payload found.");

    const title = issue.title || "";
    const body = issue.body || "";
    const issue_number = issue.number;

    const repoUrl = `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}`;

    const system = `
Você é um assistente de engenharia para gerar UM prompt perfeito para Codex, com foco em utilidade e simplicidade.

REGRAS (obrigatório seguir):
${rules}

FORMATO OBRIGATÓRIO:
Você DEVE retornar somente o texto do prompt final (texto puro), com estas seções nesta ordem:

1) OBJETIVO (P0)
2) RESTRIÇÕES
3) COMO LOCALIZAR NO REPO  (com comandos começando com "$ ", sem blocos de código markdown)
4) IMPLEMENTAÇÃO
5) CRITÉRIOS DE ACEITE
6) ROTEIRO DE TESTE MANUAL

REGRAS IMPORTANTES:
- NÃO use blocos de código markdown (não use ```).
- NÃO invente caminhos/arquivos. Exija que o Codex localize no repo com busca.
- PROIBIDO alterar fórmulas/cálculos/custos/comissões/taxas/regras financeiras.
- Preferir HTML acessível nativo: <button> OU <input + label>.
`.trim();

    const user = `
Repo: ${repoUrl}

ISSUE:
Título: ${title}

Descrição:
${body}

Agora gere o PROMPT FINAL para o Codex seguindo o formato obrigatório.
`.trim();

    const promptFinal = await openaiChat({
      apiKey,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const comment = [
      "## 🤖 Agents – Improvement Plan (Level 1)",
      "",
      "### 🚀 PROMPT PARA O CODEX (copie e cole)",
      "```txt",
      safeBlock(promptFinal || "(vazio)"),
      "```",
    ].join("\n");

    await github.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number,
      body: comment,
    });
  } catch (err) {
    core.setFailed(err?.message || String(err));
  }
}
