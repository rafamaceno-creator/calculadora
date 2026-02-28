import fs from "node:fs";
import path from "node:path";

const {
  GITHUB_TOKEN,
  OPENAI_API_KEY,
  OPENAI_MODEL,
  REPO,
  ISSUE_NUMBER,
} = process.env;

// =======================
// MODELS
// =======================
const DEFAULT_MODEL =
  OPENAI_MODEL && OPENAI_MODEL.trim()
    ? OPENAI_MODEL.trim()
    : "gpt-4o-mini";

// Agent 4 precisa sintetizar com precisão
const CAPTAIN_MODEL = "gpt-4o";

// =======================
// ENV
// =======================
function mustEnv(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) throw new Error(`Missing env: ${name}`);
  return String(v).trim();
}

mustEnv("GITHUB_TOKEN");
mustEnv("OPENAI_API_KEY");
mustEnv("REPO");
mustEnv("ISSUE_NUMBER");

// =======================
// HELPERS
// =======================
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

async function openaiChat(messages, model = DEFAULT_MODEL) {
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

function extractFirstFencedBlock(text) {
  const m = String(text || "").match(/```[\s\S]*?```/);
  return m ? m[0].trim() : null;
}

function ensureSingleFenceBlock(text) {
  const first = extractFirstFencedBlock(text);
  return first ? first : "```\n" + text.trim() + "\n```";
}

function safeReadFileHeadTail(p, maxChars) {
  try {
    if (!fs.existsSync(p)) return null;
    const raw = fs.readFileSync(p, "utf8");
    if (raw.length <= maxChars) return raw;
    const half = Math.floor(maxChars / 2);
    return (
      raw.slice(0, half) +
      "\n\n[... TRECHO OMITIDO POR TAMANHO ...]\n\n" +
      raw.slice(-half)
    );
  } catch {
    return null;
  }
}

// =======================
// REPO CONTEXT
// =======================
function buildRepoContext() {
  const files = [
    "index.html",
    "assets/js/main.js",
    "assets/css/styles.css",
  ];

  const parts = ["## REPO CONTEXT (TRECHOS REAIS)"];

  for (const rel of files) {
    const abs = path.resolve(process.cwd(), rel);
    const maxChars =
      rel === "assets/js/main.js" ? 48000 :
      rel === "assets/css/styles.css" ? 24000 :
      9000;

    const content = safeReadFileHeadTail(abs, maxChars);
    parts.push(
      `\n### ${rel}\n${
        content ? "```" + "\n" + content + "\n```" : "(NÃO ENCONTRADO)"
      }`
    );
  }

  const svgDir = path.resolve(process.cwd(), "assets/img/marketplaces");
  if (fs.existsSync(svgDir)) {
    const svgs = fs.readdirSync(svgDir).filter(f => f.endsWith(".svg"));
    parts.push(
      `\n### assets/img/marketplaces (LISTAGEM)\n` +
      (svgs.length ? svgs.map(s => `- ${s}`).join("\n") : "(sem svgs)")
    );
  }

  return parts.join("\n");
}

// =======================
// MAIN
// =======================
async function main() {
  const [owner, repo] = mustEnv("REPO").split("/");
  const issueNumber = mustEnv("ISSUE_NUMBER");

  const issue = await ghFetch(
    `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`
  );

  const issueContext = [
    "## ISSUE",
    `Título: ${issue.title || ""}`,
    "",
    issue.body || "",
  ].join("\n");

  const rulesText =
    safeReadFileHeadTail(path.resolve(process.cwd(), "AGENTS_RULES.md"), 20000) ||
    "(AGENTS_RULES.md não encontrado)";

  const repoContext = buildRepoContext();

  const sharedSystem = [
    "Sistema multi-agente para gerar PROMPT OPERACIONAL para Codex.",
    "",
    "REGRAS ABSOLUTAS:",
    "- NÃO alterar fórmulas, cálculos, custos ou regras financeiras.",
    "- NÃO inventar paths.",
    "- Usar apenas o que o CODE SCOUT confirmar.",
    "",
    "AGENTS_RULES.md:",
    rulesText,
    "",
    repoContext,
  ].join("\n");

  // =======================
  // AGENT 0 — CODE SCOUT
  // =======================
  const scout = await openaiChat([
    { role: "system", content: sharedSystem },
    {
      role: "user",
      content: [
        "AGENT 0 — CODE SCOUT",
        "Mapeie a realidade técnica. NÃO proponha soluções.",
        "",
        issueContext,
      ].join("\n"),
    },
  ]);

  // =======================
  // AGENT 1 — UX
  // =======================
  const ux = await openaiChat([
    { role: "system", content: sharedSystem },
    {
      role: "user",
      content: [
        "AGENT 1 — UX",
        "Baseie-se no CODE SCOUT + ISSUE.",
        "Reconheça o que já existe.",
        "",
        scout,
        "",
        issueContext,
      ].join("\n"),
    },
  ]);

  // =======================
  // AGENT 2 — FRONT-END (COM CÓDIGO)
  // =======================
  const fe = await openaiChat([
    { role: "system", content: sharedSystem },
    {
      role: "user",
      content: [
        "AGENT 2 — FRONT-END",
        "",
        "OBRIGATÓRIO:",
        "- Use SOMENTE paths e seletores confirmados no CODE SCOUT.",
        "- NÃO parafrasear.",
        "- Fornecer CÓDIGO EXATO.",
        "",
        "FORMATO OBRIGATÓRIO:",
        "## FE — Arquivos reais a editar",
        "",
        "## FE — Código proposto",
        "Para cada mudança:",
        "ARQUIVO:",
        "SELETOR:",
        "AÇÃO: adicionar | substituir | remover",
        "```css",
        "/* código exato */",
        "```",
        "",
        scout,
        ux,
      ].join("\n"),
    },
  ]);

  // =======================
  // AGENT 3 — QA
  // =======================
  const qa = await openaiChat([
    { role: "system", content: sharedSystem },
    {
      role: "user",
      content: [
        "AGENT 3 — QA",
        "Checklist de teste e não-regressão financeira.",
        "",
        scout,
        ux,
      ].join("\n"),
    },
  ]);

  // =======================
  // AGENT 4 — RELEASE CAPTAIN
  // =======================
  const finalPrompt = await openaiChat(
    [
      {
        role: "system",
        content: [
          "AGENT 4 — RELEASE CAPTAIN",
          "",
          "IMPORTANTE:",
          "- Copie os blocos de código do AGENT 2 LITERALMENTE.",
          "- NÃO parafrasear código.",
          "- NÃO usar faixas (ex: 24–28px).",
          "- Cada passo deve citar arquivo, seletor e código exato.",
          "- Saída vaga é ERRO.",
          "",
          "FORMATO:",
          "1) OBJETIVO",
          "2) RESTRIÇÕES",
          "3) COMANDOS DE LOCALIZAÇÃO",
          "4) PASSOS EXECUTÁVEIS (com código literal)",
          "5) ARQUIVOS QUE NÃO DEVEM SER TOCADOS",
          "6) CHECKLIST",
          "7) PEDIDO DE RETORNO",
        ].join("\n"),
      },
      {
        role: "user",
        content: [scout, ux, fe, qa].join("\n\n---\n\n"),
      },
    ],
    CAPTAIN_MODEL
  );

  await ghFetch(
    `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
    {
      method: "POST",
      body: JSON.stringify({ body: ensureSingleFenceBlock(finalPrompt) }),
    }
  );
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
