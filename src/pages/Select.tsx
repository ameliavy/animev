import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ANIMES, type AnimeName } from "@/lib/animes";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { LogOut, History, Sparkles, Loader2 } from "lucide-react";

const Select = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [picked, setPicked] = useState<AnimeName | null>(null);
  const [hasHistory, setHasHistory] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate("/", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .then(({ count }) => {
        setHasHistory((count ?? 0) > 0);
        setChecking(false);
      });
  }, [user]);

  const handleContinue = () => {
    if (!picked) {
      toast.error("Pick an anime first");
      return;
    }
    navigate(`/character?anime=${encodeURIComponent(picked)}`);
  };

  const handleOldChat = () => {
    if (!hasHistory) {
      toast.error("No history yet — start a new chat first ✨");
      return;
    }
    navigate("/history");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading || checking) {
    return (
      <div className="stars min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary relative z-10" />
      </div>
    );
  }

  return (
    <div className="stars relative min-h-screen p-4 sm:p-8">
      <div className="relative z-10 max-w-5xl mx-auto">
        <header className="flex items-center justify-between mb-10 animate-fade-in">
          <div className="flex items-center gap-2">
            <Sparkles className="w-7 h-7 text-primary animate-float" />
            <h1 className="text-2xl sm:text-3xl font-bold text-aurora">Pick your universe</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
            <LogOut className="w-4 h-4 mr-2" /> Sign out
          </Button>
        </header>

        <p className="text-muted-foreground mb-6">Choose an anime to chat with a character — or jump back into an old chat.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {ANIMES.map((a) => {
            const active = picked === a.name;
            return (
              <button
                key={a.name}
                onClick={() => setPicked(a.name)}
                className={`group glass rounded-2xl p-5 text-left transition-cosmic hover:scale-[1.03] hover:glow-accent border-2 ${
                  active ? "border-primary glow-primary" : "border-transparent"
                }`}
              >
                <div className={`w-full h-24 rounded-xl mb-3 bg-gradient-to-br ${a.color} flex items-center justify-center text-5xl`}>
                  {a.emoji}
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox checked={active} className="pointer-events-none" />
                  <span className="font-semibold text-foreground">{a.name}</span>
                </div>
              </button>
            );
          })}

          <button
            onClick={handleOldChat}
            className="group glass rounded-2xl p-5 text-left transition-cosmic hover:scale-[1.03] hover:glow-secondary border-2 border-secondary/30"
          >
            <div className="w-full h-24 rounded-xl mb-3 bg-gradient-to-br from-secondary/30 to-accent/30 flex items-center justify-center">
              <History className="w-12 h-12 text-secondary" />
            </div>
            <div className="font-semibold text-foreground">Continue old chat</div>
            <div className="text-xs text-muted-foreground mt-1">
              {hasHistory ? "Resume your past adventures" : "No history yet"}
            </div>
          </button>
        </div>

        <div className="flex justify-center">
          <Button variant="hero" size="lg" onClick={handleContinue} disabled={!picked}>
            Continue with {picked ?? "..."}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Select;
