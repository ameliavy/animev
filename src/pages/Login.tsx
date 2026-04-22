import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";

const Login = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (!loading && user) navigate("/select", { replace: true });
  }, [user, loading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setAttempts(a => a + 1);
      toast.error(`Try again — ${error.message}`);
      return;
    }
    toast.success("Welcome back ✨");
    navigate("/select");
  };

  const handleGoogle = async () => {
    setBusy(true);
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/select`,
    });
    if (error) {
      setBusy(false);
      toast.error(error.message ?? "Google sign-in failed");
    }
  };

  return (
    <div className="stars relative min-h-screen flex items-center justify-center p-4">
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center gap-2 mb-3">
            <Sparkles className="w-8 h-8 text-primary animate-float" />
            <h1 className="text-4xl font-bold text-aurora">AnimeVerse</h1>
          </div>
          <p className="text-muted-foreground">Step into the cosmos. Chat with your favorites.</p>
        </div>

        <div className="glass rounded-3xl p-8 shadow-cosmic animate-fade-in">
          <h2 className="text-2xl font-semibold mb-6 text-foreground">Sign in</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Username / Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@galaxy.com"
                required
                className="bg-input/60 border-border/60"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="bg-input/60 border-border/60"
              />
            </div>
            {attempts > 0 && (
              <p className="text-destructive text-sm font-medium animate-fade-in">
                Try again — attempt {attempts + 1}
              </p>
            )}
            <Button type="submit" disabled={busy} variant="hero" className="w-full">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enter the Verse"}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px bg-border flex-1" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">or</span>
            <div className="h-px bg-border flex-1" />
          </div>

          <Button onClick={handleGoogle} disabled={busy} variant="cosmic-outline" className="w-full">
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </Button>

          <div className="mt-6 flex items-center justify-between text-sm">
            <Link to="/forgot-password" className="text-secondary hover:text-secondary/80 transition-cosmic">
              Forgot password?
            </Link>
            <Link to="/signup" className="text-primary hover:text-primary-glow transition-cosmic font-medium">
              Create account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
