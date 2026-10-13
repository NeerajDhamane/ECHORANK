import Link from "next/link";
import { PublicChecker } from "@/components/public-checker";

export default function CheckPage() {
  return <main className="public-check-page">
    <header className="public-check-header"><Link className="brand-lockup" href="/"><span className="echo-mark" aria-hidden="true"><i /></span><span>EchoRank</span></Link><Link href="/signup">Create a workspace →</Link></header>
    <section className="public-check-card"><p className="eyebrow">A quick visibility snapshot</p><h1>Does AI mention your brand?</h1><p>Ask one question and inspect three answers from one AI provider.</p><PublicChecker /></section>
    <footer className="public-check-footer">AI answers vary — this is a small sample. The abuse-limit log stores only your IP and request time.</footer>
  </main>;
}
