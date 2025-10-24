import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import AuthView from "./AuthView";   // ou "./views/AuthView" se você moveu
import MainView from "./MainView";   // idem
import "./index.css";

export default function App() {
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <>
      <header className="nav">
        <div className="brand">Gerador de <b>Planos de Aula</b></div>
        <div className="actions">
          <span className="kbd">Vite</span>
          <span className="kbd">Supabase</span>
          <span className="kbd">Gemini</span>
        </div>
      </header>
      <main className="container">
        {session ? <MainView onLogout={() => supabase.auth.signOut()} /> : <AuthView />}
      </main>
    </>
  );
}
