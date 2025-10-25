Gerador de Planos de Aula (Supabase + IA)

Aplicação que gera planos de aula estruturados (introdução lúdica, objetivos BNCC, passo a passo, rubrica e observações) usando IA e salva tudo no Supabase.

Stack

Frontend: React + Vite

Backend: Supabase (Auth, Postgres, RLS, Edge Functions)

IA: OpenRouter – gpt-4o-mini (troca simples para Gemini descrita abaixo)

💡 Nota: comecei tentando com Google AI Studio / Gemini (requisito original), mas minha maior dificuldade foi o Gemini (detalhes em “Dificuldades com Gemini”). Para concluir o teste sem travar em billing/quotas/erros de versão, usei OpenRouter (gpt-4o-mini), que funcionou estável no ambiente server-to-server.

Como rodar
1) Clonar e instalar
git clone https://github.com/VieriCosta/gerador-de-planos-de-aula
cd gerador-de-planos-de-aula/app
npm i

2) Configurar Supabase local (opcional) ou linkar projeto remoto
# se for usar local:
npx supabase init
npx supabase start

# se já tem projeto na nuvem:
npx supabase link --project-ref <SEU_PROJECT_REF>

3) Variáveis de ambiente

Crie app/.env:

VITE_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
VITE_SUPABASE_ANON_KEY=<SUA_ANON_KEY>


Secrets das Edge Functions (no projeto supabase):

# se usar OpenRouter (caminho adotado)
npx supabase secrets set OPENROUTER_API_KEY=<SUA_CHAVE_OPENROUTER>


Opcional (Gemini):

npx supabase secrets set GOOGLE_API_KEY=<SUA_CHAVE_GOOGLE_AI_STUDIO>

4) Banco de dados

Execute no SQL editor do Supabase:

-- tabela principal
create table if not exists public.lesson_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  tema text not null,
  etapa_ano text not null,
  componente_curricular text not null,
  tempo_estimado_minutes int not null,
  recursos text[] default '{}',
  nivel_turma text,
  tom_estilo text,
  inputs_json jsonb,
  output_json jsonb,
  created_at timestamp with time zone default now()
);

-- RLS
alter table public.lesson_plans enable row level security;

create policy "select own" on public.lesson_plans
  for select using (auth.uid() = user_id);

create policy "insert own" on public.lesson_plans
  for insert with check (auth.uid() = user_id);

5) Edge Function

Arquivo: supabase/functions/generate-lesson-plan/index.ts
(versão usando OpenRouter/gpt-4o-mini com CORS e erros verbosos)

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  const cors = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  try {
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY ausente.");

    const body = await req.json();
    const {
      tema, etapa_ano, componente_curricular,
      tempo_estimado_minutes, recursos = [],
      nivel_turma, tom_estilo, habilidades_bncc_sugeridas
    } = body;

    if (!tema || !etapa_ano || !componente_curricular) {
      throw new Error("Campos obrigatórios: tema, etapa_ano, componente_curricular.");
    }

    const prompt = `
Gere um plano de aula estruturado (markdown) com:
1) Introdução lúdica
2) Objetivo BNCC (${habilidades_bncc_sugeridas || "sugerir"})
3) Passo a passo com tempos
4) Rubrica de avaliação
5) Observações

Dados:
- Tema: ${tema}
- Etapa/Ano: ${etapa_ano}
- Componente: ${componente_curricular}
- Tempo: ${tempo_estimado_minutes} min
- Recursos: ${(Array.isArray(recursos) ? recursos : []).join(", ")}
- Nível: ${nivel_turma}
- Tom: ${tom_estilo}
`;

    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://supabase.com"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Você é um assistente educacional que gera planos claros e alinhados à BNCC." },
          { role: "user", content: prompt }
        ]
      })
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("OpenRouter error:", t);
      return new Response(JSON.stringify({ error: t }), { status: 500, headers: cors });
    }

    const data = await resp.json();
    const plan = data?.choices?.[0]?.message?.content ?? "Não foi possível gerar o plano.";
    return new Response(JSON.stringify({ plan }), { headers: cors });
  } catch (err) {
    console.error("Erro função:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: cors });
  }
});


Deploy:

npx supabase functions deploy generate-lesson-plan

6) Rodar o front
npm run dev
# http://localhost:5173


Faça login (Auth do Supabase), preencha o formulário e gere o plano. O conteúdo volta em markdown e é salvo em lesson_plans.

Dificuldades com Gemini (o que travou)

Minha maior dificuldade foi o Gemini. Principais pontos:

Versões da API
A doc do AI Studio tem exemplos v1 com response_mime_type/response_schema, mas no endpoint público v1beta esses campos não existem.
→ Resultado: 400 Invalid JSON payload ... Unknown name "response_mime_type"/"response_schema".

Nome de modelo & método
Tentei gemini-1.5-flash e gemini-1.5-flash-latest com v1beta:generateContent e recebi 404 ... is not found for API version v1beta.
→ Solução correta seria checar ListModels e usar exatamente o nome suportado para o método em v1beta.

Chave e restrições
Chave do Google Cloud com Generative Language API ativada no mesmo projeto. Se a chave estiver com restrição de referrer, chamadas server-to-server (Supabase) podem falhar silenciosamente.

CORS/Preflight
Enviar apikey custom no header do front quebra o preflight. O certo é Authorization: Bearer JWT (do Supabase) e deixar a função buscar a chave segura via Deno.env.

Resumo: por causa desses atritos (modelo vs. versão, payloads diferentes, restrições de chave), optei por finalizar com OpenRouter/gpt-4o-mini, garantindo o fluxo ponta-a-ponta.

Como trocar para Gemini depois

Se quiser voltar para Gemini quando tudo estiver habilitado:

npx supabase secrets set GOOGLE_API_KEY=<sua_chave>

Trocar o fetch da função para:

const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + GOOGLE_API_KEY;

const resp = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    contents: [{ role: "user", parts: [{ text: prompt }] }]
  }),
});


Importante: não use response_schema/response_mime_type no v1beta.
Garanta que a Generative Language API está ativada no mesmo projeto da chave.

Scripts úteis

Logs da função:

# via dashboard é melhor, mas:
npx supabase functions list
# ver versões


Testar função via PowerShell com corpo de erro:

$ANON="<SUA_ANON_KEY>"
$body='{"tema":"Frações","etapa_ano":"3º ano","componente_curricular":"Matemática","tempo_estimado_minutes":50,"recursos":["papel"],"nivel_turma":"iniciante","tom_estilo":"lúdico","habilidades_bncc_sugeridas":"EF03MA07"}'
try {
  $r = Invoke-WebRequest -Method Post `
    -Uri "https://<PROJECT_REF>.functions.supabase.co/generate-lesson-plan" `
    -Headers @{ Authorization = "Bearer $ANON" } `
    -ContentType "application/json" -Body $body
  $r.Content
} catch {
  $reader = New-Object IO.StreamReader($_.Exception.Response.GetResponseStream())
  $reader.ReadToEnd() | Write-Host
}

Decisões técnicas

OpenRouter/gpt-4o-mini para destravar a entrega e manter custo ≈ zero.

RLS garante que cada usuário veja só seus planos.

Edge Function com CORS explícito e secrets via Deno.env.

Resposta em markdown para render simples; também salvo o JSON bruto para auditoria.

Desafios & Soluções

Gemini v1 vs v1beta → simplifiquei payload e removi campos não suportados; documentei tudo acima.

CORS/Preflight → não enviar apikey do front; apenas JWT do Supabase.

Erros 500 genéricos → logs verbosos e teste com Invoke-WebRequest para ver corpo.

Licença

MIT