import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";

type PlanoIA = {
  introducao_ludica?: string;
  objetivos_bncc?: { codigo: string; descricao: string }[];
  passo_a_passo?: { etapa: number; descricao: string; tempo_minutos: number; materiais?: string[] }[];
  rubrica?: { criterio: string; niveis: { nivel: string; descricao: string }[] }[];
  observacoes?: string;
};

export default function MainView({ onLogout }: { onLogout: () => void }) {
  // form
  const [tema, setTema] = useState("");
  const [etapa, setEtapa] = useState("");
  const [comp, setComp] = useState("");
  const [tempo, setTempo] = useState(50);
  const [recursos, setRecursos] = useState("cartolina, lápis, papel");
  const [nivel, setNivel] = useState("iniciante");
  const [tom, setTom] = useState("lúdico");
  const [bncc, setBncc] = useState("");

  // ui
  const [loading, setLoading] = useState(false);
  const [out, setOut] = useState<PlanoIA | null>(null);
  const [err, setErr] = useState("");
  const [plans, setPlans] = useState<any[]>([]);

  // sua Edge Function
  const FUNC_URL =
    "https://iudxizrfhqbztnfemhuq.functions.supabase.co/generate-lesson-plan";

  useEffect(() => {
    loadPlans();
  }, []);

  async function loadPlans() {
    setErr("");
    const { data, error } = await supabase
      .from("lesson_plans")
      .select("id, tema, etapa_ano, componente_curricular, created_at")
      .order("created_at", { ascending: false });
    if (error) setErr(error.message);
    else setPlans(data || []);
  }

  async function handleGenerate() {
    setErr("");

    if (!tema || !etapa || !comp) {
      setErr("Preencha tema, etapa/ano e componente curricular.");
      return;
    }

    setLoading(true);
    try {
      const inputs = {
        tema,
        etapa_ano: etapa,
        componente_curricular: comp,
        tempo_estimado_minutes: tempo,
        recursos: recursos.split(",").map((r) => r.trim()).filter(Boolean),
        nivel_turma: nivel,
        tom_estilo: tom,
        habilidades_bncc_sugeridas: bncc,
      };

      // 1) pegar o token da sessão (verify_jwt = true na função)
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) throw sessionErr;
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sessão inválida. Faça login novamente.");

      // 2) chamar a função com Authorization (JWT) + apikey (anon)
      const resp = await fetch(FUNC_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
        },
        body: JSON.stringify(inputs),
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        if (resp.status === 401) throw new Error("Não autorizado (401). Verifique login e headers.");
        if (resp.status === 404) throw new Error("Função não encontrada (404). Confira a URL do deploy.");
        if (resp.status === 422) throw new Error("A IA não retornou JSON válido. Tente novamente.");
        throw new Error(data?.error || "Falha ao gerar plano.");
      }

      // 3) pegar user logado para salvar
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const user = userData?.user;
      if (!user) throw new Error("Usuário não autenticado.");

      // A função retorna { plan: "..." } (markdown). Mapeamos para seu tipo.
      const planoConvertido: PlanoIA = { introducao_ludica: data.plan ?? "" };

      // 4) salvar no banco
      const { error: insertErr } = await supabase.from("lesson_plans").insert({
        user_id: user.id,
        tema,
        etapa_ano: etapa,
        componente_curricular: comp,
        tempo_estimado_minutes: tempo,
        recursos: inputs.recursos,
        nivel_turma: nivel,
        tom_estilo: tom,
        inputs_json: inputs,
        output_json: data, // guarda bruto também
      });
      if (insertErr) throw insertErr;

      setOut(planoConvertido);
      loadPlans();
    } catch (e: any) {
      setErr(e.message || "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="row" style={{ alignItems: "flex-start" }}>
      {/* FORM */}
      <div className="card" style={{ flex: "1 1 560px", minWidth: 320 }}>
        <div className="section justify">
          <h3>Gerar novo plano</h3>
          <button className="btn ghost" onClick={onLogout}>Sair</button>
        </div>

        <div className="section grid-2">
          <div className="field">
            <label className="label">Tema</label>
            <input className="input" value={tema} onChange={(e) => setTema(e.target.value)} placeholder="Frações com pizza" />
          </div>
          <div className="field">
            <label className="label">Etapa/Ano</label>
            <input className="input" value={etapa} onChange={(e) => setEtapa(e.target.value)} placeholder="3º ano EF" />
          </div>
          <div className="field">
            <label className="label">Componente</label>
            <input className="input" value={comp} onChange={(e) => setComp(e.target.value)} placeholder="Matemática" />
          </div>
          <div className="field">
            <label className="label">Tempo (min)</label>
            <input className="input" type="number" value={tempo} onChange={(e) => setTempo(Number(e.target.value || "0"))} />
          </div>
          <div className="field">
            <label className="label">Recursos (vírgula)</label>
            <input className="input" value={recursos} onChange={(e) => setRecursos(e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Nível</label>
            <select className="select" value={nivel} onChange={(e) => setNivel(e.target.value)}>
              <option>iniciante</option>
              <option>intermediário</option>
              <option>avançado</option>
            </select>
          </div>
          <div className="field">
            <label className="label">Tom/Estilo</label>
            <select className="select" value={tom} onChange={(e) => setTom(e.target.value)}>
              <option>lúdico</option>
              <option>investigativo</option>
              <option>mão-na-massa</option>
            </select>
          </div>
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label className="label">Habilidades BNCC sugeridas (opcional)</label>
            <input className="input" value={bncc} onChange={(e) => setBncc(e.target.value)} placeholder="EF03MA07, EF01LP01..." />
          </div>
        </div>

        <div className="section">
          <div className="row">
            <button className="btn primary" onClick={handleGenerate} disabled={loading}>
              {loading ? "Gerando..." : "Gerar Plano"}
            </button>
            {err && <div className="alert err">{err}</div>}
          </div>
        </div>
      </div>

      {/* SAÍDA */}
      <div className="card" style={{ flex: "1 1 420px", minWidth: 320 }}>
        <div className="section">
          <h3>Plano gerado</h3>
          {!out ? (
            <div className="alert">Preencha o formulário ao lado e gere um plano para visualizar aqui.</div>
          ) : (
            <div className="prose">
              {/* O texto vem em markdown; mostramos como texto pré-formatado */}
              {out.introducao_ludica && (
                <>
                  <h4>Conteúdo gerado</h4>
                  <pre style={{ whiteSpace: "pre-wrap" }}>{out.introducao_ludica}</pre>
                </>
              )}

              {out.objetivos_bncc?.length ? (
                <>
                  <h4>Objetivos BNCC</h4>
                  <ul>
                    {out.objetivos_bncc.map((o, i) => (
                      <li key={i}><span className="badge">{o.codigo}</span> — {o.descricao}</li>
                    ))}
                  </ul>
                </>
              ) : null}

              {out.passo_a_passo?.length ? (
                <>
                  <h4>Passo a passo</h4>
                  <ol>
                    {out.passo_a_passo.map((p, i) => (
                      <li key={i}>{p.descricao} <span className="kbd">{p.tempo_minutos} min</span></li>
                    ))}
                  </ol>
                </>
              ) : null}

              {out.rubrica?.length ? (
                <>
                  <h4>Rubrica</h4>
                  {out.rubrica.map((r, i) => (
                    <div key={i} style={{ marginBottom: 10 }}>
                      <strong>{r.criterio}</strong>
                      <ul>
                        {r.niveis.map((n, j) => (
                          <li key={j}><span className="badge">{n.nivel}</span> — {n.descricao}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </>
              ) : null}

              {out.observacoes && <p><strong>Observações:</strong> {out.observacoes}</p>}
            </div>
          )}
        </div>

        <div className="section">
          <h3>Meus planos</h3>
          {!plans.length ? (
            <div className="alert">Nenhum plano salvo ainda.</div>
          ) : (
            <ul className="list">
              {plans.map((p) => (
                <li key={p.id}>
                  <span className="badge">{new Date(p.created_at).toLocaleDateString()}</span>
                  <div style={{ flex: 1 }}>
                    <div><strong>{p.tema}</strong></div>
                    <div className="label">{p.componente_curricular} — {p.etapa_ano}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
