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

  try {
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY ausente nas secrets do Supabase.");
    }

    const {
      tema,
      etapa_ano,
      componente_curricular,
      tempo_estimado_minutes,
      recursos,
      nivel_turma,
      tom_estilo,
      habilidades_bncc_sugeridas,
    } = await req.json();

    // --- Monta o prompt para o modelo ---
    const prompt = `
      Gere um plano de aula completo e criativo com as seguintes informações:
      - Tema: ${tema}
      - Etapa/Ano: ${etapa_ano}
      - Componente Curricular: ${componente_curricular}
      - Tempo estimado: ${tempo_estimado_minutes} minutos
      - Recursos: ${recursos.join(", ")}
      - Nível da turma: ${nivel_turma}
      - Tom e estilo: ${tom_estilo}
      - Habilidades BNCC: ${habilidades_bncc_sugeridas}

      O plano deve conter:
      1. Introdução lúdica e engajante
      2. Objetivo de aprendizagem alinhado à BNCC
      3. Passo a passo detalhado da atividade
      4. Rubrica de avaliação
      5. Observações adicionais
    `;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://supabase.com",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Você é um assistente educacional especializado em criar planos de aula detalhados, claros e lúdicos conforme a BNCC.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenRouter API Error (${response.status}): ${text}`);
    }

    const data = await response.json();
    const plan = data?.choices?.[0]?.message?.content ?? "Não foi possível gerar o plano.";

    return new Response(JSON.stringify({ plan }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("Erro na função:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
