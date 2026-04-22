import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, KeyRound } from "lucide-react";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase parses recovery hash automatically; just confirm session
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      else setReady(true); // still allow attempt
    });
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated ✨");
    navigate("/select");
  };

  return (
    <div className="stars relative min-h-screen flex items-center justify-center p-4">
      <div className="relative z-10 w-full max-w-md">
        <div className="glass rounded-3xl p-8 shadow-cosmic animate-fade-in">
          <KeyRound className="w-10 h-10 text-primary mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-center mb-6 text-aurora">Set new password</h1>
          {ready && (
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="bg-input/60" />
              </div>
              <Button type="submit" disabled={busy} variant="hero" className="w-full">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update password"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
