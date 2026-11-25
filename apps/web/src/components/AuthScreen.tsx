import { useState, type SyntheticEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { loginUser, registerUser, setToken } from "../api";

export function AuthScreen({ onAuthenticated }: { onAuthenticated: () => void }) {
    const [mode, setMode] = useState<"login" | "register">("login");
    const [username, setUsername] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [validationError, setValidationError] = useState<string | null>(null);
    const queryClient = useQueryClient();

    const mutation = useMutation({
          mutationFn: async () => {
              if (mode === "login") {
                  return loginUser({ username, password });
              }

              return registerUser({ username, displayName, password, confirmPassword });
        },
        onSuccess: async (data) => {
            setToken(data.token);
            await queryClient.invalidateQueries({ queryKey: ["me"] });
            await queryClient.invalidateQueries({ queryKey: ["threads"] });
            await queryClient.invalidateQueries({ queryKey: ["rooms"]});
            onAuthenticated();
        }
    });

    function handleSubmit(event: SyntheticEvent) {
        event.preventDefault();

        if (mode === "login") {
            if (username.trim().length < 3 || !password) {
                setValidationError("Preencha usuário e senha corretamente.");
                return;
            }

            if (password.length < 8) {
                setValidationError("A senha deve ter pelo menos 8 caracteres.");
                return;
            }


        } else {
            if (!/^[a-zA-Z0-9_]{3,20}$/.test(username.trim())) {
                setValidationError("Use apenas letras, números e sublinhado no nome de usuário.");
                return;
            }

            if (displayName.trim().length < 2 || displayName.trim().length > 40) {
                setValidationError("O nome de exibição deve ter entre 2 e 40 caracteres.");
                return;
            }

            if (password.length < 8 || password.length > 128) {
                setValidationError("A senha deve ter entre 8 e 128 caracteres.");
                return;
            }

            if (password !== confirmPassword) {
                setValidationError("As senhas não coincidem. Por favor, tente novamente.");
                return;
            }
        }

        setValidationError(null);
        mutation.mutate();
    }

    function clearAuthError() {
        setValidationError(null);
        mutation.reset();
    }

    return (
        <div className="centered">
            <div className="auth-card">
                <div className="brand-lockup">
                    <img src="/sb_logo.svg" alt="" className="brand-logo" />
                    <div>
                        <h1>star_byte</h1>
                        <p className="muted">Private IRC-based community thread</p>
                    </div>
                </div>

                <div className="mode-toggle">
                  <button
                      type="button"
                      className={`button ${mode === "login" ? "button-primary" : ""}`}
                      onClick={() => {
                          setMode("login");
                          clearAuthError();
                      }}
                  >
                    Login
                  </button>
                  <button
                      type="button"
                      className={`button ${mode === "register" ? "button-primary" : ""}`}
                      onClick={() => {
                          setMode("register");
                          clearAuthError();
                      }}
                  >
                    Register
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="stack">
                    <label className="stack">
                        <span>Username</span>
                        <input value={username} onChange={(event) => {
                            setUsername(event.target.value);
                            clearAuthError();
                        }} required />
                        {mode === "register" && <span className="muted">3-20 caracteres: letras, números ou sublinhado.</span>}
                </label>

                {mode === "register" && (
                    <label className="stack">
                        <span>Display name</span>
                        <input value={displayName} onChange={(event) => {
                            setDisplayName(event.target.value);
                            clearAuthError();
                        }} required />
                        <span className="muted">Entre 2 e 40 caracteres.</span>
                    </label>
                )}

                <label className="stack">
                    <span>Password</span>
                    <input type="password" value={password} onChange={(event) => {
                        setPassword(event.target.value);
                        clearAuthError();
                    }} required />
                    {mode === "register" && <span className="muted">Entre 8 e 128 caracteres.</span>}
                </label>

                    {mode === "register" && (
                        <label className="stack">
                            <span>Confirm Password</span>
                            <input type="password" value={confirmPassword} onChange={(event) => {
                                setConfirmPassword(event.target.value);
                                clearAuthError();
                            }} required />
                        </label>
                    )}
                {(validationError || mutation.error) && (
                    <p className="error">{validationError ?? (mutation.error as Error).message}</p>
                )}

                <button
                    className="button button-primary"
                    disabled={mutation.isPending || !username.trim() || !password || (mode === "register" && !displayName.trim())}
                >
                    {mutation.isPending ? "Working..." : mode === "login" ? "Sign in" : "Create account"}
                </button>
              </form>
            </div>
        </div>
    );
}

