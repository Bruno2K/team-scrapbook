import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { login } from "@/api/auth";

export default function Login() {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = nickname.trim();
    const p = password;
    if (!n || !p) {
      toast.error("Preencha nickname e senha.");
      return;
    }
    setIsLoading(true);
    login({ nickname: n, password: p })
      .then(() => {
        toast.success("Acesso autorizado. Bem-vindo ao campo!");
        navigate("/", { replace: true });
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Nickname ou senha inválidos.";
        toast.error(message);
      })
      .finally(() => setIsLoading(false));
  };

  return (
    <div className="min-h-screen tf-texture flex flex-col">
      {/* Same header as MainLayout */}
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
            to="/"
            className="px-3 py-1.5 rounded font-heading text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          >
            ← Voltar ao Feed
          </Link>
        </div>
      </header>

      {/* Centered login card */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="tf-card border-l-4 border-l-accent p-6 space-y-6">
            <div>
              <h2 className="font-heading text-sm text-muted-foreground uppercase tracking-widest">
                🔐 Acesso ao Campo
              </h2>
              <p className="mt-1 text-sm text-foreground">
                Informe suas credenciais para entrar no sistema.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="login-nickname"
                  className="block font-heading text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5"
                >
                  Nickname
                </label>
                <input
                  id="login-nickname"
                  type="text"
                  autoComplete="username"
                  placeholder="Seu nickname"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full bg-muted border-2 border-border rounded px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
                  disabled={isLoading}
                />
              </div>
              <div>
                <label
                  htmlFor="login-password"
                  className="block font-heading text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5"
                >
                  Senha
                </label>
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-muted border-2 border-border rounded px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
                  disabled={isLoading}
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-4 py-2.5 bg-accent text-accent-foreground font-heading text-xs uppercase tracking-wider rounded tf-shadow-sm hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Entrando..." : "🔥 Entrar"}
              </button>
            </form>

            <p className="text-[10px] text-muted-foreground text-center">
              Ainda não tem conta?{" "}
              <Link to="/register" className="text-accent font-bold hover:text-tf-yellow-light transition-colors">
                Registrar
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
