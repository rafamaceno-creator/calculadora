import fs from "node:fs";
import path from "node:path";

const {
  GITHUB_TOKEN,
  OPENAI_API_KEY,
  OPENAI_MODEL,
  REPO,
  ISSUE_NUMBER,
} = process.env;

// Models
const DEFAULT_MODEL =
  OPENAI_MODEL && OPENAI_MODEL.trim()
    ? OPENAI_MODEL.trim()
    : "gpt-4o-mini";

// Agent 4 (síntese final) usa modelo mais forte
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

// --------------------
// GitHub helper
// --------------------
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

// --------------------
// OpenAI helper
// --------------------
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

// --------------------
// Utils
// --------------------
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

// --------------------
// Repo context builder
// --------------------
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

// --------------------
// Main
// --------------------
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
    "Descrição:",
    issue.body || "",
  ].join("\n");

  const rulesPath = path.resolve(process.cwd(), "AGENTS_RULES.md");
  const rulesText =
    safeReadFileHeadTail(rulesPath, 20000) ||
    "(AGENTS_RULES.md não encontrado na raiz.)";

  const repoContext = buildRepoContext();

  const sharedSystem = [
    "Você é parte de um sistema multi-agente que transforma uma Issue em um PROMPT OPERACIONAL para o Codex abrir um PR.",
    "",
    "REGRAS ABSOLUTAS:",
    "- Obedeça rigorosamente AGENTS_RULES.md.",
    "- NÃO alterar fórmulas, cálculos, custos, taxas, comissões ou regras financeiras.",
    "- NÃO inventar paths/arquivos.",
    "- Melhorias incrementais e seguras. Sem refatorações grandes.",
    "",
    "AGENTS_RULES.md:",
    rulesText,
    "",
    repoContext,
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
        "Mapeie a REALIDADE técnica do projeto.",
        "NÃO proponha soluções. NÃO faça UX.",
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
        "Baseie-se ESTRITAMENTE no CODE SCOUT e na ISSUE.",
        "Reconheça o que já existe para evitar duplicação.",
        "NÃO escreva prompt para Codex.",
        "",
        "Formato:",
        "## UX — Diagnóstico",
        "- Problema P0:",
        "- Impacto:",
        "- Onde acontece:",
        "",
        "## UX — Solução mínima (incremental)",
        "- ...",
        "",
        "## UX — Critérios de aceite",
        "- [ ] ...",
        "",
        "CODE SCOUT:",
        scout,
        "",
        "ISSUE:",
        issueContext,
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
          "Use SOMENTE paths e funções confirmados no CODE SCOUT.",
          "NÃO inventar paths. NÃO assumir frameworks.",
          "",
          "Formato:",
          "## FE — Arquivos reais a editar",
          "- ...",
          "",
          "## FE — Passos técnicos executáveis",
          "1) ...",
          "",
          "## FE — A11y / estados",
          "- focus",
          "- hover",
          "- selected",
          "- disabled",
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
          "Crie checklist de teste manual e não-regressão financeira.",
          "",
          "Formato:",
          "## QA — Desktop",
          "- [ ] ...",
          "",
          "## QA — Mobile",
          "- [ ] ...",
          "",
          "## QA — Acessibilidade",
          "- [ ] ...",
          "",
          "## QA — Não-regressão financeira",
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
          "",
          "IMPORTANTE:",
          "- Você está escrevendo um PROMPT OPERACIONAL para o Codex.",
          "- NÃO escreva resumo, release note ou explicação executiva.",
          "- Cada frase deve ser uma instrução executável.",
          "- Use verbos imperativos: Localize, Edite, Adicione, NÃO altere.",
          "- Cite paths e seletores EXATOS do CODE SCOUT.",
          "- Saída vaga ou abstrata é ERRO.",
          "",
          "FORMATO OBRIGATÓRIO:",
          "1) OBJETIVO (curto)",
          "2) RESTRIÇÕES ABSOLUTAS",
          "3) COMANDOS DE LOCALIZAÇÃO (rg / find)",
          "4) PASSOS EXECUTÁVEIS (numerados)",
          "5) ARQUIVOS QUE NÃO DEVEM SER TOCADOS",
          "6) CHECKLIST DE VALIDAÇÃO",
          "7) PEDIDO DE RETORNO (diff + como testar)",
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
