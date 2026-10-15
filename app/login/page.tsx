import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";
import { Icon } from "@/components/icon";
export const instant = false;
export default async function LoginPage() {
  if (await currentUser()) redirect("/");
  return <main className="login-page"><section className="login-story"><div className="brand"><span className="brand-mark"><Icon name="drop" size={25} /></span>flowdesk<span className="brand-period">.</span></div><div className="story-content"><span className="eyebrow">WATER & ENVIRONMENT</span><h1>Better water.<br />Clearer proposals.</h1><p>One considered workspace for your treatment projects, proposals, and every revision along the way.</p><div className="water-art"><div /><div /><div /><span><Icon name="drop" size={66} /></span></div><div className="story-tags"><span>Project visibility</span><span>Complete history</span><span>Built for your team</span></div></div><p className="story-footer">TREATMENT PROPOSAL MANAGEMENT</p></section><section className="login-panel"><div className="login-box"><span className="eyebrow">YOUR WORKSPACE, CONNECTED</span><h2>Welcome back</h2><p className="subtitle">Sign in to manage your proposal register.</p><LoginForm /></div><p className="login-bottom">Flowdesk · Treatment Proposal Register</p></section></main>;
}
