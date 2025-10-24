import { useState } from "react";
import { supabase } from "./lib/supabaseClient";

export default function AuthView() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [msg, setMsg] = useState("");

  const onSignIn = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    setMsg(error ? error.message : "Login realizado.");
  };
  const onSignUp = async () => {
    const { error } = await supabase.auth.signUp({ email, password: pass });
    setMsg(error ? error.message : "Conta criada! Verifique seu e-mail se solicitado e entre.");
  };

  return (
    <div className="card" style={{ maxWidth: 460, margin: "24px auto" }}>
      <div className="section">
        <h3>Acesso</h3>
        <div className="field">
          <label className="label">E-mail</label>
          <input className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@email.com" />
        </div>
        <div className="field">
          <label className="label">Senha</label>
          <input className="input" type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••" />
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn primary" onClick={onSignIn}>Entrar</button>
          <button className="btn ghost" onClick={onSignUp}>Criar conta</button>
        </div>
        {msg && <div className="alert" style={{ marginTop: 10 }}>{msg}</div>}
      </div>
      <div className="section">
        <div className="label">Dica</div>
        <div className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
          Seus dados ficam salvos por usuário. Habilitamos RLS no Supabase.
        </div>
      </div>
    </div>
  );
}
