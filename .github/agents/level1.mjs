import fs from "node:fs";
import path from "node:path";

const {
  GITHUB_TOKEN,
  OPENAI_API_KEY,
  OPENAI_MODEL,
  REPO,
  ISSUE_NUMBER,
} = process.env;

const model =
  OPENAI_MODEL && OPENAI_MODEL.trim() ? OPENAI_MODEL.trim() : "gpt-4o-mini";

function mustEnv(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) throw new Error(`Missing env: ${name}`);
  return String(v).trim();
}

mustEnv("GITHUB_TOKEN");
mustEnv("OPENAI_API_KEY");
mustEnv("REPO");
mustEnv("ISSUE_NUMBER");

const rulesPath = path.resolve(process.cwd(), "AGENTS_RULES.md");
const rulesText = fs.existsSync(rulesPath)
  ? fs.readFileSync(rulesPath, "utf8")
  : `(AGENTS_RULES.md não encontrado na raiz.\nCRIE/CONFIRME ESTE ARQUIVO.)`;

async function ghFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "agents-level1",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub API error ${res.status}: ${body}`);
  }
  return res.json();
}

async function openaiChat(messages) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenAI API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI: resposta vazia");
  return content;
}

function ensureSingleFenceBlock(text) {
  const trimmed = String(text || "").trim();

  // Se já vier fenced, mantém.
  if (trimmed.startsWith("```") && trimmed.endsWith("```")) return trimmed;
  if (trimmed.startsWith("~~~") && trimmed.endsWith("~~~")) return trimmed;

  // Caso contrário, envolve com crases (string normal, NÃO template literal).
  return "```\n" + trimmed + "\n```";
}

async function main() {
  const [owner, repo] = mustEnv("REPO").split("/");
  const issueNumber = mustEnv("ISSUE_NUMBER");

  const issue = await ghFetch(
    `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`
  );

  const issueTitle = issue.title || "";
  const issueBody = issue.body || "";

  const sharedSystem = [
    "Você é parte de um sistema multi-agente que transforma Issues em um PROMPT ÚNICO para Codex gerar PR.",
    "",
    "REGRAS ABSOLUTAS:",
    "- Obedeça rigorosamente AGENTS_RULES.md (abaixo).",
    "- NÃO alterar fórmulas, cálculos, custos, taxas, comissões ou regras financeiras.",
    "- NÃO inventar paths/arquivos: sempre mandar o Codex localizar com rg/find antes de editar.",
    "- Melhorias incrementais e seguras.",
    "- O resultado final precisa ser copiável e utilizável.",
    "",
    "AGENTS_RULES.md:",
    rulesText,
  ].join("\n");

  const issueContext = [
    "ISSUE:",
    `Título: ${issueTitle}`,
    "",
    "Descrição:",
    issueBody,
  ].join("\n");

  // =========================
  // AGENT 1 — UX
  // =========================
  const ux = await openaiChat([
    { role: "system", content: sharedSystem },
    {
      role: "user",
      content: [
        "Você é o AGENT 1 (UX).",
        "Tarefa: produzir um diagnóstico e plano UX prático, enxuto e priorizado.",
        "Formato obrigatório:",
        "",
        "## UX — Diagnóstico",
        "- Problema P0:",
        "- Impacto:",
        "- Onde acontece (step/tela):",
        "- O que o usuário sente (1 linha):",
        "",
        "## UX — Solução mínima (incremental)",
        "- Mudanças visuais obrigatórias (bullets)",
        "- Estados: hover / focus / selected / disabled (bullets)",
        "- Responsivo mobile (bullets)",
        "- A11y mínima (bullets)",
        "",
        "## UX — Critérios de aceite",
        "- [ ] ...",
        "- [ ] ...",
        "",
        "Não escrever prompt pro Codex ainda.",
        "",
        "Contexto:",
        issueContext,
      ].join("\n"),
    },
  ]);

  // =========================
  // AGENT 2 — FRONT-END
  // =========================
  const fe = await openaiChat([
    { role: "system", content: sharedSystem },
    {
      role: "user",
      content: [
        "Você é o AGENT 2 (FRONT-END).",
        "Use o output do UX e traduza para um plano técnico aplicável sem inventar paths.",
        "",
        "Formato obrigatório:",
        "",
        "## FE — Como localizar no repo (comandos)",
        "- rg ...",
        "- rg ...",
        "- find ...",
        "",
        "## FE — Estratégia de implementação (mínima)",
        "- Estrutura (preferência por input+label ou button nativo):",
        "- Classes/estilos (o que criar/alterar):",
        "- A11y (tabindex/aria/label):",
        "- Responsividade (flex-wrap/line-height/gap):",
        "",
        "## FE — Mudanças por arquivos (genérico, sem inventar paths)",
        "- Arquivo do componente de chips: (localizar via rg)",
        "  - ...",
        "- Arquivo(s) de CSS: (localizar via rg)",
        "  - ...",
        "- SVGs: (confirmar onde estão via find)",
        "  - ...",
        "",
        "## FE — Riscos técnicos + mitigação",
        "- Risco:",
        "  - Mitigação:",
        "",
        "Base UX:",
        ux,
      ].join("\n"),
    },
  ]);

  // =========================
  // AGENT 3 — QA
  // =========================
  const qa = await openaiChat([
    { role: "system", content: sharedSystem },
    {
      role: "user",
      content: [
        "Você é o AGENT 3 (QA).",
        "Crie checklist de teste MANUAL e não-regressão, bem objetivo.",
        "",
        "Formato obrigatório:",
        "",
        "## QA — Checklist Desktop",
        "- [ ] ...",
        "",
        "## QA — Checklist Mobile",
        "- [ ] ...",
        "",
        "## QA — Acessibilidade (teclado)",
        "- [ ] ...",
        "",
        "## QA — Não-regressão (financeiro)",
        "- [ ] Confirmar que não mudou cálculo/regras (como validar rapidamente)",
        "",
        "Base UX:",
        ux,
        "",
        "Base FE:",
        fe,
      ].join("\n"),
    },
  ]);

  // =========================
  // AGENT 4 — RELEASE CAPTAIN (PROMPT FINAL)
  // =========================
  const finalPrompt = await openaiChat([
    { role: "system", content: sharedSystem },
    {
      role: "user",
      content: [
        "Você é o AGENT 4 (RELEASE CAPTAIN).",
        "Tarefa: gerar o PROMPT ÚNICO para colar no Codex e abrir PR.",
        "",
        "REGRAS DE FORMATO (OBRIGATÓRIAS):",
        "- Retorne APENAS 1 bloco fenced de código Markdown (use fence de 3 crases).",
        "- Nada fora do bloco.",
        "- Linguagem PT-BR, estilo ctrl+c / ctrl+v.",
        "",
        "O prompt deve conter:",
        "1) Objetivo (P0)",
        "2) Restrições (inclui NÃO mexer em finanças e NÃO inventar paths)",
        "3) Como localizar arquivos (rg/find) — obrigatório",
        "4) Plano de mudanças (UI/CSS/A11y) com bullets claros",
        "5) Critérios de aceite (checklist)",
        "6) Roteiro de teste manual (checklist QA)",
        "7) Pedido de retorno do Codex: mostrar diff + instruções de teste",
        "",
        "Use como base:",
        "",
        "=== UX ===",
        ux,
        "",
        "=== FE ===",
        fe,
        "",
        "=== QA ===",
        qa,
      ].join("\n"),
    },
  ]);

  const finalPromptBlock = ensureSingleFenceBlock(finalPrompt);

  const commentBody = [
    "🤖 **Agents – Improvement Plan (Level 1)**",
    "",
    "Abaixo está o **PROMPT ÚNICO** pronto para colar no Codex e gerar um PR:",
    "",
    finalPromptBlock,
  ].join("\n");

  await ghFetch(
    `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
    {
      method: "POST",
      body: JSON.stringify({ body: commentBody }),
    }
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
