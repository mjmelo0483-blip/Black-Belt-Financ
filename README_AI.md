# Mentor de Inteligência Financeira (IA)

Esta funcionalidade foi implementada para fornecer dicas e alertas proativos baseados na movimentação financeira da empresa ou pessoa física.

## Arquitetura Implementada

1.  **`hooks/useAIAdvisor.ts`**: Coleta dados de transações, orçamentos e saldos e gera o contexto para a IA.
2.  **`components/AIAdvisor.tsx`**: Interface premium (sidebar) com animações e micro-interações para exibir os insights.
3.  **Integração Global**: O componente foi injetado no `App.tsx` para estar disponível em todas as telas do sistema.

## Como funciona a Inteligência

Atualmente, o sistema utiliza uma **lógica de análise heurística** (simulando IA) para identificar:
- **Déficit Mensal**: Alerta se as despesas superarem as receitas.
-  **Estouro de Orçamento**: Identifica automaticamente quais categorias passaram do limite definido.
- **Liquidez**: Sugere investimentos se o saldo em conta for superior a 3 meses de despesas.
- **Redução de Custos**: Aponta a categoria de maior peso no mês para foco em economia.

## Conectando ao GPT-4 ou Gemini (Opcional)

Para ter dicas ainda mais "humanas" e profundas, você pode configurar uma **Supabase Edge Function**. Abaixo está o exemplo de código para a função `financial-advisor`:

```typescript
// supabase/functions/financial-advisor/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { OpenAI } from "https://deno.land/x/openai/mod.ts"

serve(async (req) => {
  const { context } = await req.json()
  
  // Exemplo de Prompt para a IA
  const prompt = `Como um mentor financeiro sênior, analise estes dados de uma ${context.type}:
  Receita: R$ ${context.totalIncome}
  Despesas: R$ ${context.totalExpenses}
  Saldo: R$ ${context.balance}
  Top Gastos: ${context.topExpenses.join(', ')}
  Estouros de Orçamento: ${context.overBudgets.map(b => b.name).join(', ')}
  
  Forneça 3 dicas práticas para maximizar resultados e reduzir custos.`

  // Chamada para API de sua preferência (OpenAI, Gemini, etc)
  // ...
  
  return new Response(JSON.stringify({ insights }), { headers: { "Content-Type": "application/json" } })
})
```

---
*Para dúvidas ou novos tipos de análise (ex: análise de DRE por IA), basta solicitar ao assistente Antigravity.*
