import fs from "node:fs";
import path from "node:path";

const {
  GITHUB_TOKEN,
  OPENAI_API_KEY,
  OPENAI_MODEL,
  REPO,
  ISSUE_NUMBER,
} = process.env;

// Modelo padrão para Agents 0–3
const DEFAULT_MODEL =
  OPENAI_MODEL && OPENAI_MODEL.trim()
    ? OPENAI_MODEL.trim()
    : "gpt-4o-mini";

// Modelo dedicado para o Agent 4 (síntese final)
const CAPTAIN_MODEL = "gpt-4o";

function mustEnv(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) throw new Error(`Missing env: ${name}`);
  return String(v).trim();
}

mustEnv("GITHUB_TOKEN");
mustEnv("OPENAI_API_KEY");
mustEnv("REPO");
mustEnv("ISSUE_NUMBER");

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
  const s = String(text || "");
  const m = s.match(/```[\s\S]*?```/);
  if (m && m[0]) return m[0].trim();
  return null;
}

function ensureSingleFenceBlock(text) {
  const trimmed = String(text || "").trim();
  const first = extractFirstFencedBlock(trimmed);
  if (first) return first;
  return "```\n" + trimmed + "\n```";
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

function buildRepoContext() {
  const candidates = [
    "index.html",
    "assets/js/main.js",
    "assets/css/styles.css",
  ];

  const parts = [];
  parts.push("## REPO CONTEXT (TRECHOS REAIS)");
  parts.push(
    "Observação: os trechos abaixo foram lidos diretamente do repositório."
  );

  for (const rel of candidates) {
    const abs = path.resolve(process.cwd(), rel);

    const maxChars =
      rel === "assets/js/main.js"
        ? 48000
        : rel === "assets/css/styles.css"
        ? 24000
        : 9000;

    const content = safeReadFileHeadTail(abs, maxChars);

    if (content === null) {
      parts.push(`\n### ${rel}\n(NÃO ENCONTRADO)`);
    } else {
      parts.push(`\n### ${rel}\n\`\`\`\n${content}\n\`\`\``);
    }
  }

  const svgDir = path.resolve(process.cwd(), "assets/img/marketplaces");
  if (fs.existsSync(svgDir) && fs.lstatSync(svgDir).isDirectory()) {
    const svgs = fs
      .readdirSync(svgDir)
      .filter((f) => f.toLowerCase().endsWith(".svg"));
    parts.push(
      `\n### assets/img/marketplaces (LISTAGEM)\n${
        svgs.length ? svgs.map((s) => `- ${s}`).join("\n") : "(sem svgs)"
      }\n`
    );
  } else {
    parts.push(`\n### assets/img/marketplaces (LISTAGEM)\n(NÃO ENCONTRADO)\n`);
  }

  return parts.join("\n");
}

async function main() {
  const [owner, repo] = mustEnv("REPO").split("/");
  const issueNumber = mustEnv("ISSUE_NUMBER");

  const issue = await ghFetch(
    `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`
  );

  const issueTitle = issue.title || "";
  const issueBody = issue.body || "";

  const rulesPath = path.resolve(process.cwd(), "AGENTS_RULES.md");
  const rulesText =
    safeReadFileHeadTail(rulesPath, 20000) ||
    "(AGENTS_RULES.md não encontrado na raiz.)";

  const repoContext = buildRepoContext();

  const sharedSystem = [
    "Você é parte de um sistema multi-agente que transforma uma Issue em um PROMPT ÚNICO para o Codex abrir um PR.",
    "",
    "REGRAS ABSOLUTAS:",
    "- Obedeça rigorosamente AGENTS_RULES.md.",
    "- NÃO alterar fórmulas, cálculos, custos, taxas, comissões ou regras financeiras.",
    "- NÃO inventar paths/arquivos: usar somente o que estiver confirmado no CODE SCOUT.",
    "- Melhorias incrementais e seguras.",
    "",
    "AGENTS_RULES.md:",
    rulesText,
    "",
    repoContext,
  ].join("\n");

  const issueContext = [
    "## ISSUE",
    `Título: ${issueTitle}`,
    "",
    "Descrição:",
    issueBody,
  ].join("\n");

  // =========================
  // AGENT 0 — CODE SCOUT
  // =========================
  const scout = await openaiChat([
    { role: "system", content: sharedSystem },
    {
      role: "user",
      content: [
        "Você é o AGENT 0 (CODE SCOUT).",
        "Mapeie a realidade técnica do repositório com base APENAS no REPO CONTEXT.",
        "NÃO proponha soluções.",
        "",
        "Formato obrigatório:",
        "## CODE SCOUT — Mapa real do projeto",
        "",
        "### Arquivos relevantes encontrados",
        "- caminho/arquivo.ext",
        "",
        "### O que JÁ existe e funciona",
        "- ...",
        "",
        "### O que está PARCIALMENTE resolvido (risco de duplicação)",
        "- ...",
        "",
        "### O que NÃO existe (lacunas reais)",
        "- ...",
        "",
        "### Conclusão técnica",
        "- Onde mudanças DEVEM acontecer",
        "- Quais arquivos NÃO devem ser tocados",
        "",
        issueContext,
      ].join("\n"),
    },
  ]);

  // =========================
  // AGENT 1 — UX
  // =========================
  const ux = await openaiChat([
    { role: "system", content: sharedSystem },
    {
      role: "user",
      content: [
        "Você é o AGENT 1 (UX).",
        "Baseie-se estritamente no CODE SCOUT.",
        "NÃO escreva prompt para Codex.",
        "",
        "Formato:",
        "## UX — Diagnóstico",
        "- Problema P0:",
        "- Impacto:",
        "",
        "## UX — Solução mínima",
        "- ...",
        "",
        "## UX — Critérios de aceite",
        "- [ ] ...",
        "",
        scout,
      ].join("\n"),
    },
  ]);

  // =========================
  // AGENTS 2 e 3 — FE + QA (paralelo)
  // =========================
  const [fe, qa] = await Promise.all([
    openaiChat([
      { role: "system", content: sharedSystem },
      {
        role: "user",
        content: [
          "Você é o AGENT 2 (FRONT-END).",
          "Use SOMENTE paths confirmados no CODE SCOUT.",
          "",
          "Formato:",
          "## FE — Arquivos reais a editar",
          "- ...",
          "",
          "## FE — Plano técnico",
          "- ...",
          "",
          scout,
          ux,
        ].join("\n"),
      },
    ]),
    openaiChat([
      { role: "system", content: sharedSystem },
      {
        role: "user",
        content: [
          "Você é o AGENT 3 (QA).",
          "Crie checklist de teste e não-regressão financeira.",
          "",
          "Formato:",
          "## QA — Checklist",
          "- [ ] ...",
          "",
          scout,
          ux,
        ].join("\n"),
      },
    ]),
  ]);

  // =========================
  // AGENT 4 — RELEASE CAPTAIN
  // =========================
  const finalPrompt = await openaiChat(
    [
      {
        role: "system",
        content: [
          "Você é o AGENT 4 (RELEASE CAPTAIN).",
          "Gere UM PROMPT ÚNICO para colar no Codex e abrir PR.",
          "",
          "REGRAS:",
          "- NÃO alterar fórmulas, cálculos ou regras financeiras.",
          "- Usar APENAS paths confirmados no CODE SCOUT.",
          "- Retornar APENAS um bloco fenced Markdown.",
          "",
          "AGENTS_RULES.md:",
          rulesText,
        ].join("\n"),
      },
      {
        role: "user",
        content: [scout, ux, fe, qa].join("\n\n---\n\n"),
      },
    ],
    CAPTAIN_MODEL
  );

  const finalPromptBlock = ensureSingleFenceBlock(finalPrompt);

  await ghFetch(
    `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
    {
      method: "POST",
      body: JSON.stringify({ body: finalPromptBlock }),
    }
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
