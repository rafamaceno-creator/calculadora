import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

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

const STRONG_MODEL = "gpt-4o";

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

  if (res.status === 204) return null;
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

function safeReadFile(p) {
  try {
    if (!fs.existsSync(p)) return null;
    return fs.readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

function truncate(text, maxChars = 16000) {
  if (!text) return "";
  if (text.length <= maxChars) return text;
  const half = Math.floor(maxChars / 2);
  return (
    text.slice(0, half) +
    "\n\n[... TRECHO OMITIDO POR TAMANHO ...]\n\n" +
    text.slice(-half)
  );
}

function shellEscapeSingleQuotes(str) {
  return String(str).replace(/'/g, `'\\''`);
}

function runRg(pattern, file) {
  try {
    const cmd = `rg -n -C 6 '${shellEscapeSingleQuotes(pattern)}' ${file}`;
    return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch {
    return "";
  }
}

function buildTargetedRepoContext() {
  const targets = [
    {
      file: "assets/js/main.js",
      patterns: [
        "solvePrice",
        "breakdownAtPrice",
        "wizard",
        "stepper",
        "adjust",
        "summary",
        "marketplace",
        "affiliate",
        "extra",
      ],
    },
    {
      file: "assets/css/styles.css",
      patterns: [
        "segmentMenu__btn",
        "wizardStepper__dot",
        "wizardStepper__item",
        "adjCard__header",
        "adjCard",
        "summary",
        "result",
        "breakdown",
      ],
    },
    {
      file: "index.html",
      patterns: [
        "wizard",
        "stepper",
        "summary",
        "marketplace",
        "affiliate",
        "extra",
        "breakdown",
        "resultado",
      ],
    },
  ];

  const parts = ["## REPO CONTEXT (TRECHOS LOCALIZADOS)"];

  for (const target of targets) {
    const abs = path.resolve(process.cwd(), target.file);
    if (!fs.existsSync(abs)) {
      parts.push(`\n### ${target.file}\n(NÃO ENCONTRADO)`);
      continue;
    }

    const fileParts = [];
    for (const pattern of target.patterns) {
      const out = runRg(pattern, abs);
      if (out && out.trim()) {
        fileParts.push(`#### rg: ${pattern}\n\`\`\`\n${truncate(out, 8000)}\n\`\`\``);
      }
    }

    if (!fileParts.length) {
      const raw = safeReadFile(abs);
      parts.push(`\n### ${target.file}\n\`\`\`\n${truncate(raw, 12000)}\n\`\`\``);
    } else {
      parts.push(`\n### ${target.file}\n${fileParts.join("\n\n")}`);
    }
  }

  const svgDir = path.resolve(process.cwd(), "assets/img/marketplaces");
  if (fs.existsSync(svgDir)) {
    const svgs = fs
      .readdirSync(svgDir)
      .filter((f) => f.toLowerCase().endsWith(".svg"));
    parts.push(
      `\n### assets/img/marketplaces (LISTAGEM)\n${
        svgs.length ? svgs.map((s) => `- ${s}`).join("\n") : "(sem svgs)"
      }`
    );
  }

  return parts.join("\n");
}

function buildSharedSystem({ rulesText, repoContext }) {
  return [
    "Sistema multi-agente para gerar PROMPT OPERACIONAL para Codex.",
    "",
    "IMPORTANTE:",
    "- Esta pipeline NÃO implementa código, NÃO cria PR e NÃO altera arquivos.",
    "- A saída final deve ser um plano operacional de alta precisão para execução posterior.",
    "",
    "REGRAS ABSOLUTAS:",
    "- NÃO alterar fórmulas, cálculos, custos ou regras financeiras, salvo se a issue pedir explicitamente e houver evidência clara no código.",
    "- NÃO inventar arquivos, paths, funções, seletores ou componentes.",
    "- Usar apenas o que o CODE SCOUT confirmar.",
    "- Se a issue for ampla, NÃO reduzi-la automaticamente a microajustes cosméticos.",
    "- Diferenciar claramente: problema visual vs problema estrutural vs problema de lógica de exibição.",
    "",
    "AGENTS_RULES.md:",
    rulesText,
    "",
    repoContext,
  ].join("\n");
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
    safeReadFile(path.resolve(process.cwd(), "AGENTS_RULES.md")) ||
    "(AGENTS_RULES.md não encontrado)";

  const repoContext = buildTargetedRepoContext();
  const sharedSystem = buildSharedSystem({ rulesText, repoContext });

  // =======================
  // AGENT 0 — CODE SCOUT
  // =======================
  const scout = await openaiChat(
    [
      { role: "system", content: sharedSystem },
      {
        role: "user",
        content: [
          "AGENT 0 — CODE SCOUT",
          "Mapeie a realidade técnica. NÃO proponha solução ainda.",
          "",
          "RESPONDA EM 5 BLOCOS:",
          "1) ARQUIVOS RELEVANTES",
          "2) FUNÇÕES / SELETORES / TRECHOS CONFIRMADOS",
          "3) O QUE JÁ EXISTE HOJE",
          "4) LIMITAÇÕES DE CONTEXTO / INCERTEZAS",
          "5) O QUE A ISSUE PARECE EXIGIR (sem propor implementação)",
          "",
          issueContext,
        ].join("\n"),
      },
    ],
    DEFAULT_MODEL
  );

  // =======================
  // AGENT 1 — PRODUCT / UX
  // =======================
  const productUx = await openaiChat(
    [
      { role: "system", content: sharedSystem },
      {
        role: "user",
        content: [
          "AGENT 1 — PRODUCT / UX",
          "Baseie-se no CODE SCOUT + ISSUE.",
          "Seu papel é traduzir a issue em problema real de experiência do usuário.",
          "",
          "RESPONDA EM 4 BLOCOS:",
          "1) PROBLEMA CENTRAL",
          "2) SINAIS SECUNDÁRIOS",
          "3) O QUE É VISUAL vs O QUE É ESTRUTURAL",
          "4) CRITÉRIOS DE SUCESSO PARA O USUÁRIO",
          "",
          scout,
          "",
          issueContext,
        ].join("\n"),
      },
    ],
    DEFAULT_MODEL
  );

  // =======================
  // AGENT 2 — FE VISUAL
  // =======================
  const feVisual = await openaiChat(
    [
      { role: "system", content: sharedSystem },
      {
        role: "user",
        content: [
          "AGENT 2 — FE VISUAL",
          "",
          "OBJETIVO:",
          "Propor apenas melhorias visuais e de hierarquia, sem inventar estrutura inexistente.",
          "",
          "OBRIGATÓRIO:",
          "- Use somente paths e seletores confirmados no CODE SCOUT.",
          "- Forneça código literal quando propor CSS.",
          "- Não repetir código existente sem alteração real.",
          "",
          "RESPONDA EM BLOCOS REPETÍVEIS NESTE FORMATO:",
          "SELETOR EXISTENTE:",
          "PROBLEMA VISUAL:",
          "ARQUIVO:",
          "AÇÃO: adicionar | ajustar | complementar",
          "```css",
          "/* código exato */",
          "```",
          "",
          scout,
          "",
          productUx,
        ].join("\n"),
      },
    ],
    STRONG_MODEL
  );

  // =======================
  // AGENT 3 — FE STRUCTURE
  // =======================
  const feStructure = await openaiChat(
    [
      { role: "system", content: sharedSystem },
      {
        role: "user",
        content: [
          "AGENT 3 — FE STRUCTURE",
          "",
          "OBJETIVO:",
          "Propor melhorias estruturais do fluxo, HTML/JS e explicabilidade da etapa final.",
          "",
          "IMPORTANTE:",
          "- Não alterar regras financeiras.",
          "- Não inventar funções/paths.",
          "- Se a estrutura atual não suportar algo, diga explicitamente.",
          "- Você pode propor mudanças em HTML, JS e organização da UI, desde que baseadas no CODE SCOUT.",
          "",
          "RESPONDA EM 5 BLOCOS:",
          "1) OPORTUNIDADES ESTRUTURAIS",
          "2) TRECHOS/FUNÇÕES QUE PRECISAM MUDAR",
          "3) RESUMO DO QUE O CODEX DEVE IMPLEMENTAR",
          "4) RISCOS / DEPENDÊNCIAS",
          "5) CÓDIGO EXATO quando houver evidência suficiente",
          "",
          scout,
          "",
          productUx,
          "",
          issueContext,
        ].join("\n"),
      },
    ],
    STRONG_MODEL
  );

  // =======================
  // AGENT 4 — SCOPE GUARD
  // =======================
  const scopeGuard = await openaiChat(
    [
      { role: "system", content: sharedSystem },
      {
        role: "user",
        content: [
          "AGENT 4 — SCOPE GUARD",
          "",
          "Verifique se a proposta ficou aderente à issue.",
          "Seu papel é apontar quando a solução ficou estreita demais.",
          "",
          "RESPONDA EM 4 BLOCOS:",
          "1) PARTES DA ISSUE COBERTAS",
          "2) PARTES DA ISSUE NÃO COBERTAS",
          "3) A SOLUÇÃO ESTÁ REDUZIDA A MICROAJUSTES? (sim/não + justificativa)",
          "4) O QUE O PROMPT FINAL PRECISA EXIGIR PARA NÃO PERDER O OBJETIVO",
          "",
          issueContext,
          "",
          scout,
          "",
          productUx,
          "",
          feVisual,
          "",
          feStructure,
        ].join("\n"),
      },
    ],
    DEFAULT_MODEL
  );

  // =======================
  // AGENT 5 — QA
  // =======================
  const qa = await openaiChat(
    [
      { role: "system", content: sharedSystem },
      {
        role: "user",
        content: [
          "AGENT 5 — QA",
          "Monte um checklist de validação para Codex e revisão humana.",
          "",
          "RESPONDA EM 3 BLOCOS:",
          "1) TESTES VISUAIS",
          "2) TESTES FUNCIONAIS",
          "3) NÃO-REGRESSÃO",
          "",
          scout,
          "",
          productUx,
          "",
          feVisual,
          "",
          feStructure,
        ].join("\n"),
      },
    ],
    DEFAULT_MODEL
  );

  // =======================
  // AGENT 6 — RELEASE CAPTAIN
  // =======================
  const finalPrompt = await openaiChat(
    [
      {
        role: "system",
        content: [
          "AGENT 6 — RELEASE CAPTAIN",
          "",
          "Sua missão é consolidar tudo em um prompt operacional para Codex.",
          "Esta pipeline não altera código; ela apenas produz instruções de implementação.",
          "",
          "REGRAS OBRIGATÓRIAS:",
          "- Não inventar paths, seletores ou funções.",
          "- Não omitir lacunas de escopo.",
          "- Se a issue for ampla, o prompt final deve refletir isso.",
          "- Separar claramente: EXECUTIVO vs EXECUÇÃO.",
          "- Copiar blocos de código literais quando existirem.",
          "",
          "FORMATO FINAL OBRIGATÓRIO:",
          "1) RESUMO EXECUTIVO",
          "2) OBJETIVO",
          "3) RESTRIÇÕES",
          "4) COMANDOS DE LOCALIZAÇÃO",
          "5) PASSOS EXECUTÁVEIS",
          "6) ARQUIVOS QUE NÃO DEVEM SER TOCADOS",
          "7) CHECKLIST",
          "8) PEDIDO DE RETORNO",
          "",
          "REGRAS ESPECIAIS:",
          "- No RESUMO EXECUTIVO, explicar o que é visual, estrutural e o que ficou fora.",
          "- Em PASSOS EXECUTÁVEIS, priorizar ações que resolvam o objetivo central da issue.",
          "- Não transformar uma issue estrutural em uma lista de CSS se houver evidência de mudanças em JS/HTML.",
          "- Se houver código exato do FE VISUAL ou FE STRUCTURE, copiar literalmente.",
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          issueContext,
          scout,
          productUx,
          feVisual,
          feStructure,
          scopeGuard,
          qa,
        ].join("\n\n---\n\n"),
      },
    ],
    STRONG_MODEL
  );

  const body = [
    "> Resultado do Level 1: plano operacional para implementação via Codex.",
    "> Nenhum arquivo foi alterado e nenhum PR foi aberto por esta Action.",
    "",
    finalPrompt.trim(),
  ].join("\n");

  await ghFetch(
    `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
    {
      method: "POST",
      body: JSON.stringify({ body }),
    }
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
