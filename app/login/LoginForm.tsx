"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";

export default function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, null);

  return (
    <form action={formAction} className="login-form">
      <div className="form-group">
        <label htmlFor="email">Email Address</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="admin@smbfittingindustry.com"
          className="login-input"
        />
      </div>

      <div className="form-group">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          className="login-input"
        />
      </div>

      {state?.error && (
        <div className="login-error" role="alert">
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="login-submit-button"
      >
        {isPending ? (
          <span className="button-loader">
            <span className="library-spinner" /> Signing in…
          </span>
        ) : (
          "Sign In"
        )}
      </button>
    </form>
  );
}
