"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { logout } from "@/app/login/actions";
import { refreshRegister } from "@/app/(workspace)/actions";
import type { RegisterState } from "@/lib/proposals";
import { Icon } from "./icon";

const Context = createContext<{
  state: RegisterState;
  refresh: () => Promise<boolean>;
  notice: string;
  notify: (message: string) => void;
} | null>(null);

export function useRegister() {
  const context = useContext(Context);
  if (!context) throw new Error("Register provider missing");
  return context;
}

const navigation = [
  ["/", "dashboard", "Overview"],
  ["/register", "register", "Proposal register"],
  ["/new", "plus", "New proposal"],
  ["/settings", "settings", "Settings & backup"],
];

export function Workspace({ children, initialState, username }: {
  children: React.ReactNode; initialState: RegisterState; username: string;
}) {
  const pathname = usePathname();
  const [state, setState] = useState(initialState);
  const [notice, notify] = useState("");
  const readVersion = useRef(0);
  const refresh = useCallback(async () => {
    const version = ++readVersion.current;
    try {
      const next = await refreshRegister();
      if (version === readVersion.current) setState(next);
      return true;
    } catch {
      if (version === readVersion.current) notify("Could not refresh Supabase records. Showing the last loaded data; check your connection and refresh.");
      return false;
    }
  }, []);

  useEffect(() => {
    // Shared layouts persist across navigation; refresh on route changes too.
    const initialRefresh = window.setTimeout(() => { void refresh(); }, 0);
    function onFocus() { void refresh(); }
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 30000);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(initialRefresh);
      window.removeEventListener("focus", onFocus);
    };
  }, [pathname, refresh]);

  return <Context.Provider value={{ state, refresh, notice, notify }}>
    <div className="workspace">
      <aside className="sidebar">
        <Link href="/" className="brand"><span className="brand-mark"><Icon name="drop" size={25} /></span>flowdesk<span className="brand-period">.</span></Link>
        <div className="workspace-label">PROPOSAL WORKSPACE</div>
        <nav aria-label="Main navigation">
          {navigation.map(([href, icon, label]) => <Link key={href} href={href} className={pathname === href ? "nav-link active" : "nav-link"} aria-current={pathname === href ? "page" : undefined}>
            <Icon name={icon} />{label}{pathname === href && <span className="nav-dot" />}
          </Link>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-card"><span className="status-dot" />Supabase workspace
            <p>Shared proposals and settings, saved to your database.</p>
            <Link href="/settings">Manage backups <Icon name="arrow" size={15} /></Link>
          </div>
          <div className="profile">
            <span className="avatar">{username.slice(0, 2).toUpperCase()}</span>
            <div><strong>{username}</strong><small>Workspace member</small></div>
            <form action={logout}><button className="icon-button" aria-label="Sign out" title="Sign out"><Icon name="logout" size={18} /></button></form>
          </div>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <div><span className="breadcrumb">Workspace</span><span className="breadcrumb-slash">/</span>{navigation.find(n => n[0] === pathname)?.[2] || "Proposals"}</div>
          <span className="year-tag"><span className="status-dot" />Financial year {state.fy}</span>
        </header>
        <main className="page-content">
          {notice && <div className="message" role="status">{notice}<button onClick={() => notify("")} aria-label="Dismiss notification">×</button></div>}
          {children}
          <footer className="page-footer"><span>Flowdesk <span> / </span> Treatment Proposal Register</span><span>Supabase database · Shared workspace</span></footer>
        </main>
      </div>
    </div>
  </Context.Provider>;
}
