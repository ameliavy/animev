import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createConversation } from "@/lib/localChatStore";

const Character = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, loading } = useAuth();
  const anime = params.get("anime") ?? "";
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/", { replace: true });
    if (!anime) navigate("/select", { replace: true });
  }, [user, loading, navigate, anime]);

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !user) return;
    setBusy(true);
    try {
      const convo = createConversation(user.id, anime, name.trim());
      navigate(`/chat/${convo.id}`);
    } catch (err) {
      toast.error("Failed to start chat");
      setBusy(false);
    }
  };

  return (
    <div className="stars relative min-h-screen flex items-center justify-center p-4">
      <div className="relative z-10 w-full max-w-xl">
        <button onClick={() => navigate("/select")} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-cosmic mb-6">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="glass rounded-3xl p-8 shadow-cosmic animate-fade-in">
          <Sparkles className="w-10 h-10 text-primary mx-auto mb-3 animate-float" />
          <h1 className="text-3xl font-bold text-center text-aurora mb-2">{anime}</h1>
          <p className="text-center text-muted-foreground mb-8">
            Please enter a character of your choice to chat with.
          </p>

          <form onSubmit={handleStart} className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-foreground">Character Name:</span>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Tanjiro, Gojo, Luffy..."
                required
                className="mt-2 bg-input/60 text-lg"
                autoFocus
              />
            </label>
            <Button type="submit" variant="hero" className="w-full" disabled={busy || !name.trim()}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Begin chat"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Character;
