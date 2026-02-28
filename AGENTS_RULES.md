- name: Run agents (Level 1)
  id: run-agents
  run: |
    echo "📖 Reading AGENTS_RULES.md..."

    if [ ! -f AGENTS_RULES.md ]; then
      echo "❌ AGENTS_RULES.md not found in repo root"
      exit 1
    fi

    AGENTS_RULES_CONTENT=$(cat AGENTS_RULES.md)

    echo "🤖 Building prompt with rules + issue content..."

    PROMPT=$(cat <<'EOF'
Você é um sistema de orquestração multi-agente para melhorias incrementais de produto.

========================
REGRAS OBRIGATÓRIAS (LEIA COM ATENÇÃO)
========================
${AGENTS_RULES_CONTENT}

========================
CONTEXTO DA ISSUE
========================
Título:
${{ github.event.issue.title }}

Descrição:
${{ github.event.issue.body }}

========================
INSTRUÇÕES GERAIS
========================
- Você deve respeitar TODAS as regras acima.
- NÃO altere fórmulas, cálculos, custos, taxas ou regras financeiras.
- Gere apenas melhorias incrementais e seguras.
- Divida sua análise nos papéis:
  1) UX
  2) Front-end
  3) QA
  4) Release Captain (gerador do PROMPT FINAL para Codex)
- O Release Captain deve gerar UM PROMPT ÚNICO, pronto para copiar e colar no Codex.
- Não gere código diretamente, apenas o plano e o prompt final.

Responda em português.
EOF
)

    echo "🚀 Sending prompt to OpenAI..."

    RESPONSE=$(curl https://api.openai.com/v1/chat/completions \
      -H "Authorization: Bearer $OPENAI_API_KEY" \
      -H "Content-Type: application/json" \
      -d "{
        \"model\": \"gpt-4.1-mini\",
        \"messages\": [
          {\"role\": \"system\", \"content\": \"$PROMPT\"}
        ],
        \"temperature\": 0.2
      }"
    )

    echo "📝 Posting response back to issue..."

    COMMENT=$(echo "$RESPONSE" | jq -r '.choices[0].message.content')

    curl -X POST \
      -H "Authorization: Bearer ${{ secrets.GITHUB_TOKEN }}" \
      -H "Content-Type: application/json" \
      https://api.github.com/repos/${{ github.repository }}/issues/${{ github.event.issue.number }}/comments \
      -d "{
        \"body\": \"$COMMENT\"
      }"
