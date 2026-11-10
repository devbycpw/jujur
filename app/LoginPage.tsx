"use client";
import { FormEvent, useState } from "react";
import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, UserRound, X } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/browser";

export default function LoginPage({
  mode,
  onModeChange,
  onLogin,
  onBack,
}: {
  mode: "signin" | "signup";
  onModeChange: (mode: "signin" | "signup") => void;
  onLogin: (name: string, email: string, role: "warga" | "admin") => void;
  onBack: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    const supabase = getSupabaseClient();

    if (!supabase) {
      setError("Konfigurasi Supabase belum tersedia di browser.");
      return;
    }

    setLoading(true);

    try {
      if (mode === "signin") {
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (authError) {
          setError(
            authError.message === "Invalid login credentials"
              ? "Email atau kata sandi belum cocok. Gunakan akun demo di bawah."
              : authError.message
          );
          return;
        }

        if (data.user) {
          // Ambil profil resmi dan role dari database
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, role")
            .eq("id", data.user.id)
            .maybeSingle();

          const resolvedName =
            profile?.full_name ||
            data.user.user_metadata?.full_name ||
            data.user.email?.split("@")[0] ||
            "Warga";
          const resolvedRole = (profile?.role === "admin" ? "admin" : "warga") as "warga" | "admin";

          onLogin(resolvedName, data.user.email || email.trim(), resolvedRole);
        }
      } else {
        if (name.trim().length < 3 || password.length < 6) {
          setError("Nama minimal 3 karakter dan kata sandi minimal 6 karakter.");
          return;
        }

        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: name.trim() },
          },
        });

        if (signUpError) {
          setError(signUpError.message);
          return;
        }

        if (data.session && data.user) {
          // Login otomatis jika konfirmasi email dimatikan
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, role")
            .eq("id", data.user.id)
            .maybeSingle();

          const resolvedName = profile?.full_name || name.trim();
          onLogin(resolvedName, email.trim(), "warga");
        } else {
          setInfo("Akun berhasil didaftarkan! Silakan masuk dengan email dan kata sandi Anda.");
          onModeChange("signin");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan saat memproses akun.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-backdrop" onClick={onBack}>
      <section className="login-card auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onBack}>
          <X size={18} />
        </button>
        <button className="login-logo">
          <b>APERTIO</b>
          <i>.</i>
        </button>
        <div className="login-icon">
          <ShieldCheck size={23} />
        </div>
        <h1>{mode === "signin" ? "Selamat datang" : "Buat akun warga"}</h1>
        <p>
          {mode === "signin"
            ? "Masuk untuk ikut menjaga pembangunan tetap transparan."
            : "Daftar untuk ikut berkontribusi pada pembangunan kota."}
        </p>
        <div className="auth-tabs">
          <button
            className={mode === "signin" ? "active" : ""}
            onClick={() => {
              onModeChange("signin");
              setError("");
              setInfo("");
            }}
          >
            Sign in
          </button>
          <button
            className={mode === "signup" ? "active" : ""}
            onClick={() => {
              onModeChange("signup");
              setError("");
              setInfo("");
            }}
          >
            Sign up
          </button>
        </div>
        <form onSubmit={submit}>
          {mode === "signup" && (
            <label>
              Nama
              <div>
                <UserRound size={17} />
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nama lengkap"
                />
              </div>
            </label>
          )}
          <label>
            Email
            <div>
              <Mail size={17} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
              />
            </div>
          </label>
          <label>
            Kata sandi
            <div>
              <LockKeyhole size={17} />
              <input
                required
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "signup" ? "Minimal 6 karakter" : "Masukkan kata sandi"}
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                aria-label="Tampilkan kata sandi"
              >
                {show ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </label>
          {error && <small className="login-error">{error}</small>}
          {info && <small className="login-info" style={{ color: "var(--accent, #16a34a)", marginTop: "0.25rem", display: "block" }}>{info}</small>}
          <button className="login-submit" type="submit" disabled={loading}>
            {loading ? "Memproses…" : mode === "signin" ? "Masuk ke APERTIO" : "Buat akun"}
          </button>
        </form>
        {mode === "signin" && (
          <div className="demo-credentials">
            <b>Akun demo warga</b>
            <span>
              Email <strong>demo@apertio.id</strong>
            </span>
            <span>
              Kata sandi <strong>warga123</strong>
            </span>
            <button
              type="button"
              onClick={() => {
                setEmail("demo@apertio.id");
                setPassword("warga123");
                setError("");
                setInfo("");
              }}
            >
              Isi akun demo warga
            </button>
            <span>
              Email admin <strong>admin@apertio.id</strong>
            </span>
            <span>
              Kata sandi admin <strong>admin123</strong>
            </span>
            <button
              type="button"
              onClick={() => {
                setEmail("admin@apertio.id");
                setPassword("admin123");
                setError("");
                setInfo("");
              }}
            >
              Isi akun demo admin
            </button>
          </div>
        )}
        <small className="login-privacy">
          Akses lihat tetap tersedia tanpa login. Autentikasi terhubung ke Supabase Auth.
        </small>
      </section>
    </div>
  );
}
