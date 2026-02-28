import fs from "node:fs";
import path from "node:path";

const {
  GITHUB_TOKEN,
  OPENAI_API_KEY,
  OPENAI_MODEL,
  REPO,
  ISSUE_NUMBER,
} = process.env;

const model = (OPENAI_MODEL && OPENAI_MODEL.trim()) ? OPENAI_MODEL.trim() : "gpt-4o-mini";

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
  : "(AGENTS_RULES.md não encontrado na raiz. CRIE/CONFIRME ESTE ARQUIVO.)";

async function ghFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Authorization": `Bearer ${GITHUB_TOKEN}`,
      "Accept": "application/vnd.github+json",
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
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
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

async function main() {
  const [owner, repo] = REPO.split("/");
  const issue = await ghFetch(`https://api.github.com/repos/${owner}/${repo}/issues/${ISSUE_NUMBER}`);

  const issueTitle = issue.title || "";
  const issueBody = issue.body || "";

  const system = `
Você é um "Release Captain" + "UX/Front-end lead" para o repositório.
Sua missão: transformar a Issue em UM PROMPT ÚNICO, pronto pra colar no Codex, para gerar um PR.
REGRAS:
- Obedeça rigorosamente o arquivo AGENTS_RULES.md (abaixo).
- Não invente paths/arquivos: peça para o Codex buscar no repo (rg/find) e só então editar.
- O output final DEVE ser APENAS um bloco de código (markdown \`\`\`) contendo o prompt final.
- O prompt final deve:
  1) Explicar objetivo
  2) Restrições (não mexer em cálculos/regras financeiras)
  3) Passos para localizar arquivos no repo (com rg/find)
  4) Plano de mudanças (UI/UX/A11y) com critérios de aceite
  5) Checklist de teste manual
Nada fora do bloco de código no final.

AGENTS_RULES.md:
${rulesText}
`.trim();

  const user = `
Issue:
Título: ${issueTitle}

Descrição:
${issueBody}
`.trim();

  const result = await openaiChat([
    { role: "system", content: system },
    { role: "user", content: user },
  ]);

  const commentBody =
`🤖 **Agents – Improvement Plan (Level 1)**

Abaixo está o **PROMPT ÚNICO** pronto para colar no Codex e gerar um PR:

${result}
`;

  await ghFetch(`https://api.github.com/repos/${owner}/${repo}/issues/${ISSUE_NUMBER}/comments`, {
    method: "POST",
    body: JSON.stringify({ body: commentBody }),
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
