import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { phoneToEmail, phoneToPassword } from "@/lib/palama";
import { useAuth } from "@/hooks/useAuth";
import { Car, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Palama" },
      {
        name: "description",
        content: "Sign in or create your Palama account with your phone number.",
      },
    ],
  }),
  component: AuthPage,
});

type Step = "phone" | "otp";

function AuthPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"passenger" | "driver">("passenger");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) nav({ to: "/", replace: true });
  }, [loading, user, nav]);

  const cleanPhone = phone.replace(/\D/g, "");

  async function sendOtp() {
    if (cleanPhone.length < 8) return toast.error("Enter a valid phone number");
    if (mode === "signup" && fullName.trim().length < 2) return toast.error("Enter your name");
    setStep("otp");
    // Mock SMS: print code to a toast
    toast.success("Verification code sent", {
      description: "For demo: any 6 digits work (e.g. 123456)",
    });
  }

  async function verifyOtp() {
    if (otp.length !== 6) return toast.error("Enter the 6-digit code");
    setBusy(true);
    try {
      const email = phoneToEmail(phone);
      const password = phoneToPassword(phone);
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { phone, full_name: fullName, role },
          },
        });
        if (error && !error.message.toLowerCase().includes("already")) throw error;
        // immediately sign in
        const { error: e2 } = await supabase.auth.signInWithPassword({ email, password });
        if (e2) throw e2;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      toast.success("Welcome to Palama");
      nav({ to: "/", replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
      <div className="palama-gradient px-6 pt-16 pb-10 safe-top">
        <div className="flex items-center gap-2">
          <div className="grid size-11 place-items-center rounded-2xl bg-primary glow-primary">
            <Car className="size-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold leading-none">Palama</h1>
            <p className="text-xs text-muted-foreground">Rides in Lesotho</p>
          </div>
        </div>
        <h2 className="mt-10 text-3xl font-bold leading-tight">
          {step === "phone" ? "Enter your phone" : "Verify your number"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {step === "phone"
            ? "We'll send a 6-digit code to confirm it's you."
            : `Code sent to ${phone}. Demo mode: any 6 digits.`}
        </p>
      </div>

      <div className="-mt-6 flex-1 rounded-t-3xl bg-card px-6 pt-6 pb-10">
        {step === "phone" ? (
          <>
            <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Create account</TabsTrigger>
              </TabsList>
              <TabsContent value="signup" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full name</Label>
                  <Input
                    id="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Thabo Mokoena"
                  />
                </div>
                <div className="space-y-2">
                  <Label>I'm signing up as</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["passenger", "driver"] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRole(r)}
                        className={`rounded-xl border p-3 text-left text-sm capitalize transition ${
                          role === r
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-surface-2"
                        }`}
                      >
                        <div className="font-semibold">{r}</div>
                        <div className="text-xs text-muted-foreground">
                          {r === "passenger" ? "Book rides" : "Earn driving"}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="mt-4 space-y-2">
              <Label htmlFor="phone">Phone number</Label>
              <div className="flex items-center gap-2">
                <div className="rounded-md border border-input bg-surface-2 px-3 py-2 text-sm">
                  +266
                </div>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  placeholder="5012 3456"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">We never share your number.</p>
            </div>

            <Button className="mt-6 w-full" size="lg" onClick={sendOtp}>
              Send verification code
            </Button>

            <div className="mt-6 flex items-center gap-2 rounded-xl bg-surface-2 p-3 text-xs text-muted-foreground">
              <ShieldCheck className="size-4 text-success" />
              Demo mode — no real SMS is sent.
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-center pt-2">
              <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button
              className="mt-8 w-full"
              size="lg"
              disabled={busy || otp.length !== 6}
              onClick={verifyOtp}
            >
              {busy ? "Verifying…" : mode === "signup" ? "Create account" : "Verify & sign in"}
            </Button>
            <Button variant="ghost" className="mt-2 w-full" onClick={() => setStep("phone")}>
              Use a different number
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
