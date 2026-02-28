
---

## 2) `level1.mjs` — versão inteira refinada (Agent 0 + injection + FE/QA em paralelo)

Cole **inteiro** em: `.github/agents/level1.mjs`

```js
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

function safeReadFile(p, maxChars = 8000) {
  try {
    if (!fs.existsSync(p)) return null;
    const raw = fs.readFileSync(p, "utf8");
    const clipped = raw.length > maxChars ? raw.slice(0, maxChars) : raw;
    return clipped;
  } catch {
    return null;
  }
}

function buildRepoContext() {
  // Lista “provável” + segura (ajuste quando quiser)
  const candidates = [
    "index.html",
    "assets/js/main.js",
    "assets/css/styles.css",
    "assets/js/app.js",
    "assets/js/wizard.js",
    "assets/css/main.css",
    "assets/css/app.css",
    "AGENTS_RULES.md",
  ];

  const parts = [];
  parts.push("## REPO CONTEXT (TRECHOS REAIS)");
  parts.push("Observação: estes são trechos lidos diretamente do repositório. Se um arquivo não existir, será informado.");

  for (const rel of candidates) {
    const abs = path.resolve(process.cwd(), rel);
    const content = safeReadFile(abs, 9000);
    if (content === null) {
      parts.push(`\n### ${rel}\n(NÃO ENCONTRADO)`);
    } else {
      parts.push(`\n### ${rel}\n\`\`\`\n${content}\n\`\`\``);
    }
  }

  // Opcional: listar SVGs se a pasta existir (sem ler tudo)
  const svgDir = path.resolve(process.cwd(), "assets/img/marketplaces");
  if (fs.existsSync(svgDir) && fs.lstatSync(svgDir).isDirectory()) {
    const svgs = fs.readdirSync(svgDir).filter((f) => f.toLowerCase().endsWith(".svg"));
    parts.push(`\n### assets/img/marketplaces (LISTAGEM)\n${svgs.length ? svgs.map(s => `- ${s}`).join("\n") : "(sem svgs)"}\n`);
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

  // Lê rules direto (sem depender de env anterior)
  const rulesPath = path.resolve(process.cwd(), "AGENTS_RULES.md");
  const rulesText = safeReadFile(rulesPath, 12000) || "(AGENTS_RULES.md não encontrado na raiz.)";

  const repoContext = buildRepoContext();

  const sharedSystem = [
    "Você é parte de um sistema multi-agente que transforma uma Issue em um PROMPT ÚNICO para o Codex abrir um PR.",
    "",
    "REGRAS ABSOLUTAS:",
    "- Obedeça rigorosamente AGENTS_RULES.md.",
    "- NÃO alterar fórmulas, cálculos, custos, taxas, comissões ou regras financeiras.",
    "- NÃO inventar paths/arquivos: use somente paths confirmados no CODE SCOUT.",
    "- Melhorias incrementais e seguras. Sem refatoração grande.",
    "",
    "AGENTS_RULES.md (REAL):",
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
        "Mapeie a realidade técnica do repo baseado no REPO CONTEXT fornecido acima.",
        "NÃO proponha soluções. NÃO faça UX. NÃO escreva prompt Codex.",
        "",
        "Formato obrigatório (copie e preencha):",
        "## CODE SCOUT — Mapa real do projeto",
        "",
        "### Arquivos relevantes encontrados",
        "- caminho/arquivo.ext",
        "  - função ou seletor relevante",
        "",
        "### O que JÁ existe e funciona",
        "- ...",
        "",
        "### O que está PARCIALMENTE resolvido (risco de duplicação)",
        "- ...",
        "",
        "### O que NÃO existe (lacunas reais a preencher)",
        "- ...",
        "",
        "### Conclusão técnica",
        "- Onde mudanças DEVEM acontecer (paths reais)",
        "- Quais arquivos NÃO devem ser tocados",
        "- Dependências entre arquivos relevantes para a issue",
        "",
        "Contexto da issue:",
        issueContext,
      ].join("\n"),
    },
  ]);

  // =========================
  // AGENT 1 — UX (depende do scout)
  // =========================
  const ux = await openaiChat([
    { role: "system", content: sharedSystem },
    {
      role: "user",
      content: [
        "Você é o AGENT 1 (UX).",
        "Baseie-se ESTRITAMENTE no CODE SCOUT e na issue.",
        "Reconheça explicitamente o que já existe e o que está parcialmente resolvido para evitar duplicação.",
        "NÃO escreva prompt Codex.",
        "",
        "Formato obrigatório:",
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
  // AGENTS 2 e 3 em paralelo (FE + QA)
  // =========================
  const [fe, qa] = await Promise.all([
    openaiChat([
      { role: "system", content: sharedSystem },
      {
        role: "user",
        content: [
          "Você é o AGENT 2 (FRONT-END).",
          "Crie um plano técnico executável, usando SOMENTE paths/funções/seletores confirmados no CODE SCOUT.",
          "NÃO inventar paths. NÃO assumir frameworks.",
          "",
          "Formato obrigatório:",
          "## FE — Arquivos reais que serão editados (somente os do CODE SCOUT)",
          "- ...",
          "",
          "## FE — Plano técnico (mínimo)",
          "- ...",
          "",
          "## FE — A11y e estados (focus/hover/selected/disabled)",
          "- ...",
          "",
          "## FE — Riscos + mitigação",
          "- ...",
          "",
          "CODE SCOUT:",
          scout,
          "",
          "UX:",
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
          "Baseie-se no CODE SCOUT + UX.",
          "",
          "Formato obrigatório:",
          "## QA — Desktop",
          "- [ ] ...",
          "",
          "## QA — Mobile",
          "- [ ] ...",
          "",
          "## QA — Teclado/Acessibilidade",
          "- [ ] ...",
          "",
          "## QA — Não-regressão financeira",
          "- [ ] ... (como validar rapidamente sem mudar fórmulas)",
          "",
          "CODE SCOUT:",
          scout,
          "",
          "UX:",
          ux,
        ].join("\n"),
      },
    ]),
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
        "Gere o PROMPT ÚNICO para colar no Codex e abrir PR.",
        "",
        "REGRAS DE FORMATO (INVIOLÁVEIS):",
        "- Retorne APENAS um bloco fenced Markdown com 3 crases.",
        "- Nada fora do bloco.",
        "- O prompt DEVE citar paths reais do CODE SCOUT (não inventar).",
        "",
        "O prompt deve conter, nesta ordem:",
        "1) Objetivo (P0)",
        "2) Restrições absolutas",
        "3) Onde mexer (paths reais + funções/seletores do CODE SCOUT)",
        "4) Passos (mudanças UI/CSS/JS/A11y) detalhados, incrementais",
        "5) Critérios de aceite (checklist)",
        "6) Roteiro de teste manual (QA)",
        "7) Pedido de retorno do Codex: mostrar diff + instruções de teste",
        "",
        "CODE SCOUT:",
        scout,
        "",
        "UX:",
        ux,
        "",
        "FE:",
        fe,
        "",
        "QA:",
        qa,
      ].join("\n"),
    },
  ]);

  const finalPromptBlock = ensureSingleFenceBlock(finalPrompt);

  // Comentário = só o bloco fenced (evita “metade dentro/metade fora”)
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
