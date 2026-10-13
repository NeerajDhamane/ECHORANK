import Link from "next/link";
import { ArrowRight, Check, Eye, Search, ShieldCheck } from "lucide-react";

const steps = [
  { icon: Search, number: "01", title: "Ask the questions people ask", text: "Choose the prompts your customers use when they are looking for a product like yours." },
  { icon: Eye, number: "02", title: "See what AI says", text: "We ask AI repeatedly and log the answers, so you can see when your brand appears and how it is described." },
  { icon: ShieldCheck, number: "03", title: "Follow the evidence", text: "Review cited sources and changes over time. Every insight stays connected to the answer behind it." },
];

export default function Home() {
  return (
    <main className="landing-page">
      <header className="landing-header">
        <Link className="brand-lockup" href="/" aria-label="EchoRank home"><span className="echo-mark" aria-hidden="true"><i /></span><span>EchoRank</span></Link>
        <nav aria-label="Main navigation" className="landing-nav"><Link href="#how-it-works">How it works</Link><Link href="/check">Public checker</Link><Link href="/login">Log in</Link><Link className="button button-primary button-sm" href="/signup">Get started <ArrowRight size={15} /></Link></nav>
      </header>

      <section className="landing-hero">
        <div className="hero-copy">
          <p className="eyebrow"><span className="live-dot" /> Evidence-first AI visibility</p>
          <h1>Does AI recommend <span>your brand?</span></h1>
          <p className="hero-description">See how AI platforms describe your brand, what sources shape their answers, and how your visibility changes over time.</p>
          <div className="hero-actions"><Link className="button button-primary" href="/signup">Start tracking <ArrowRight size={17} /></Link><Link className="button button-secondary" href="/check">Try the public checker</Link></div>
          <p className="hero-note"><Check size={15} /> Built around repeatable answers and traceable sources</p>
        </div>
        <div className="evidence-card" aria-label="Illustration of an AI answer with cited sources">
          <div className="evidence-top"><span className="eyebrow">ANSWER SNAPSHOT</span><span className="status-pill"><i /> Recorded</span></div>
          <p className="evidence-prompt">“What are reliable tools for a growing team?”</p>
          <div className="answer-lines"><i /><i /><i /><i /></div>
          <div className="answer-highlight"><span className="highlight-dot" /> Your brand appears in this answer</div>
          <div className="evidence-divider" />
          <div className="source-heading"><span>Sources behind the answer</span><span>3 found</span></div>
          <div className="source-row"><span className="source-icon">1</span><span><b>Independent review</b><small>example.org · editorial</small></span><span className="source-tag">CITED</span></div>
          <div className="source-row"><span className="source-icon">2</span><span><b>Product documentation</b><small>example.com · owned</small></span><span className="source-tag">CITED</span></div>
          <p className="sample-caption">Illustrative preview · no live results</p>
        </div>
        <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" />
      </section>

      <section className="trust-strip"><span>Know what was asked</span><i /><span>Keep the answer</span><i /><span>Trace every source</span></section>

      <section className="how-section" id="how-it-works">
        <div className="section-heading"><p className="eyebrow">A clear signal, with its receipts</p><h2>Understand the answer.<br /><span>Not just the score.</span></h2><p>EchoRank gives you a repeatable way to observe AI recommendations and inspect the evidence behind them.</p></div>
        <div className="steps-grid">{steps.map(({ icon: Icon, number, title, text }) => <article className="step-card" key={number}><div className="step-top"><span>{number}</span><Icon size={19} /></div><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>

      <section className="landing-cta"><div><p className="eyebrow">Start with a question</p><h2>Make your AI presence<br />easier to understand.</h2></div><Link className="button button-primary" href="/signup">Create your workspace <ArrowRight size={17} /></Link></section>
      <footer className="landing-footer"><Link className="brand-lockup" href="/"><span className="echo-mark" aria-hidden="true"><i /></span><span>EchoRank</span></Link><span>Student project · not affiliated with any commercial vendor.</span><nav aria-label="Footer navigation"><Link href="/check">Public checker</Link><Link href="/login">Log in</Link></nav></footer>
    </main>
  );
}
