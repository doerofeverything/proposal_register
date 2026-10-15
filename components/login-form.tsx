"use client";
import { useActionState, useState } from "react";
import { login } from "@/app/login/actions";
import { Icon } from "./icon";
export function LoginForm() {
  const [state, action, pending] = useActionState(login, { error: "" });
  const [visible, setVisible] = useState(false);
  return <form action={action} className="login-form">
    <label>Username or email<input name="username" autoComplete="username" placeholder="Enter your username or email" required maxLength={254} /></label>
    <label>Password<span className="password-field"><input name="password" type={visible ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" required maxLength={256} /><button type="button" aria-label={visible ? "Hide password" : "Show password"} onClick={() => setVisible(!visible)}><Icon name="eye" /></button></span></label>
    {state.error && <p className="message error" role="alert">{state.error}</p>}
    <button className="button primary" disabled={pending}>{pending ? "Signing in…" : "Sign in to workspace"}<Icon name="arrow" /></button>
    <p className="login-footnote"><Icon name="shield" size={15} /> Protected by Supabase Auth</p>
  </form>;
}
