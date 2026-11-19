import { useState } from "react";
import { X, ShieldCheck, Loader2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "./ui/button";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

export function AuthModal({ open, onClose }: AuthModalProps) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [gradeNumber, setGradeNumber] = useState(9);
  const [schoolName, setSchoolName] = useState("Toshkent sh. 110-umumta'lim maktabi");
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, password);
        onClose();
      } else {
        const result = await register({ fullName, email, password, gradeNumber, schoolName, role });
        if (result.user) {
          onClose();
        } else {
          setInfo(result.message || "Arizangiz yuborildi. Administrator tasdiqlashini kuting.");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik yuz berdi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 no-print">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-bold text-foreground">
              {mode === "login" ? "HUQUQ OLAMIga kirish" : "Ro'yxatdan o'tish"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-lg bg-secondary p-1">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError(null);
              setInfo(null);
            }}
            className={`rounded-md py-1.5 text-xs font-semibold cursor-pointer ${
              mode === "login" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            Kirish
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError(null);
              setInfo(null);
            }}
            className={`rounded-md py-1.5 text-xs font-semibold cursor-pointer ${
              mode === "register" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            Ro&apos;yxatdan o&apos;tish
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs sm:text-sm">
          {mode === "register" && (
            <>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">To&apos;liq ism-familiya</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Masalan: Madina Karimova"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Rolingiz</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 rounded-lg bg-secondary p-1">
                  <button
                    type="button"
                    onClick={() => setRole("student")}
                    className={`rounded-md py-1.5 text-[11px] sm:text-xs font-semibold cursor-pointer ${
                      role === "student" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                    }`}
                  >
                    O&apos;quvchi
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("teacher")}
                    className={`rounded-md py-1.5 text-[11px] sm:text-xs font-semibold cursor-pointer ${
                      role === "teacher" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                    }`}
                  >
                    O&apos;qituvchi (ruxsat so&apos;rash bilan)
                  </button>
                </div>
                {role === "teacher" && (
                  <p className="mt-2 text-[11px] leading-snug text-amber-300/90">
                    O&apos;qituvchi akkaunti administrator tasdiqlashi kerak. Tasdiqlanmaguningizcha tizimga kira olmaysiz.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Sinf</label>
                  <select
                    value={gradeNumber}
                    onChange={(e) => setGradeNumber(Number(e.target.value))}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground"
                  >
                    {[8, 9, 10, 11].map((g) => (
                      <option key={g} value={g}>
                        {g}-sinf
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Maktab nomi</label>
                  <input
                    type="text"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs text-muted-foreground mb-1">Login</label>
            <input
              type="text"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Loginingizni kiriting"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Parol</label>
            <input
              type="password"
              required
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Parolingizni kiriting"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground"
            />
          </div>

          {error && <div className="text-xs text-red-400">{error}</div>}
          {info && (
            <div className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-[11px] leading-snug text-primary">
              {info}
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === "login" ? "Kirish" : "Ro'yxatdan o'tish"}
          </Button>
        </form>
      </div>
    </div>
  );
}
