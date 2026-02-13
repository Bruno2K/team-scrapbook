import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { register } from "@/api/auth";
import type { TF2Class } from "@/lib/types";
import { SCRAPS_QUERY_KEY } from "@/hooks/useScraps";
import { FRIENDS_QUERY_KEY } from "@/hooks/useFriends";

const MAIN_CLASSES: TF2Class[] = [
  "Scout", "Soldier", "Pyro", "Demoman", "Heavy",
  "Engineer", "Medic", "Sniper", "Spy",
];

export default function Register() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [team, setTeam] = useState<"RED" | "BLU">("RED");
  const [mainClass, setMainClass] = useState<TF2Class>("Scout");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    const nick = nickname.trim();
    const p = password;
    if (!n || !nick) {
      toast.error("Preencha nome e nickname.");
      return;
    }
    if (p.length < 6) {
      toast.error("Senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setIsLoading(true);
    register({ name: n, nickname: nick, password: p, team, mainClass })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: SCRAPS_QUERY_KEY });
        queryClient.invalidateQueries({ queryKey: FRIENDS_QUERY_KEY });
        toast.success("Conta criada! Bem-vindo ao campo.");
        navigate("/", { replace: true });
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Erro ao registrar.";
        toast.error(message);
      })
      .finally(() => setIsLoading(false));
  };

  return (
    <div className="min-h-screen tf-texture flex flex-col">
      <header className="sticky top-0 z-50 border-b-[3px] border-border bg-card/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <h1 className="font-heading text-xl tracking-wider">
              <span className="text-team-red">FORT</span>
              <span className="text-tf-beige">KUT</span>
            </h1>
            <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest hidden sm:block">
              Social Warfare Network
            </span>
          </Link>
          <Link
            to="/login"
            className="px-3 py-1.5 rounded font-heading text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          >
            Já tem conta? Entrar
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="tf-card border-l-4 border-l-team-blu p-6 space-y-6">
            <div>
              <h2 className="font-heading text-sm text-muted-foreground uppercase tracking-widest">
                📋 Recrutamento
              </h2>
              <p className="mt-1 text-sm text-foreground">
                Crie sua conta para acessar o campo de batalha.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="reg-name" className="block font-heading text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                  Nome
                </label>
                <input
                  id="reg-name"
                  type="text"
                  autoComplete="name"
                  placeholder="Seu nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-muted border-2 border-border rounded px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
                  disabled={isLoading}
                />
              </div>
              <div>
                <label htmlFor="reg-nickname" className="block font-heading text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                  Nickname
                </label>
                <input
                  id="reg-nickname"
                  type="text"
                  autoComplete="username"
                  placeholder="Nickname único"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full bg-muted border-2 border-border rounded px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
                  disabled={isLoading}
                />
              </div>
              <div>
                <label htmlFor="reg-password" className="block font-heading text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                  Senha (mín. 6 caracteres)
                </label>
                <input
                  id="reg-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-muted border-2 border-border rounded px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
                  disabled={isLoading}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-heading text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                    Time
                  </label>
                  <select
                    value={team}
                    onChange={(e) => setTeam(e.target.value as "RED" | "BLU")}
                    className="w-full bg-muted border-2 border-border rounded px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
                    disabled={isLoading}
                  >
                    <option value="RED">RED</option>
                    <option value="BLU">BLU</option>
                  </select>
                </div>
                <div>
                  <label className="block font-heading text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                    Classe
                  </label>
                  <select
                    value={mainClass}
                    onChange={(e) => setMainClass(e.target.value as TF2Class)}
                    className="w-full bg-muted border-2 border-border rounded px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
                    disabled={isLoading}
                  >
                    {MAIN_CLASSES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-4 py-2.5 bg-accent text-accent-foreground font-heading text-xs uppercase tracking-wider rounded tf-shadow-sm hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Criando conta..." : "🔥 Cadastrar"}
              </button>
            </form>

            <p className="text-[10px] text-muted-foreground text-center">
              Já tem conta?{" "}
              <Link to="/login" className="text-accent font-bold hover:text-tf-yellow-light transition-colors">
                Fazer login
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
