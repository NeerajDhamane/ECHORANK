import { FlaskConical } from "lucide-react";
import { ResearchChart } from "@/components/research-chart";
import type { ResearchResults } from "@/lib/research-page";

const VERSION_LABELS = { plain: "Plain", faq: "FAQ", stats: "Statistics-dense" } as const;
const PUBLISHED = [
  { version: "FAQ", rate: "83.4%" },
  { version: "Plain", rate: "81.1%" },
  { version: "Statistics-dense", rate: "59.3%" },
];

export function ResearchResultsView({ results }: { results: ResearchResults | null }) {
  return (
    <main className="research-page">
      <header className="page-heading">
        <p className="eyebrow"><FlaskConical size={13} /> RESEARCH · PILOT 01</p>
        <h1>Source form &amp; citations</h1>
        <p className="research-intro">An in-context pilot measuring which source forms are cited in model answers.</p>
      </header>

      {!results || results.models.length === 0 ? (
        <section className="ui-empty research-empty">
          <span className="empty-icon"><FlaskConical size={18} /></span>
          <h2>No analyzed results yet</h2>
          <p>After reviewing the generated sources and running the experiment, use <code>npm run experiment1:analyze</code>. The resulting research/results.json will appear here.</p>
        </section>
      ) : (
        <>
          <p className="ui-banner banner-info research-summary">Showing {results.trials} recorded trial{results.trials === 1 ? "" : "s"} across {results.models.length} model{results.models.length === 1 ? "" : "s"}. Analysis generated {new Date(results.analyzedAt).toLocaleDateString("en", { dateStyle: "medium", timeZone: "UTC" })}.</p>
          <section className="research-models" aria-label="Results by model">
            {results.models.map((model) => (
              <article className="ui-card research-model" key={model.model}>
                <header className="ui-card-header"><div><h2 className="ui-card-title">{model.model}</h2><p>{model.successfulTrials} successful trials · {model.failedTrials} failed</p></div><span className="ui-badge badge-neutral">PER MODEL</span></header>
                <div className="ui-card-content">
                  <div className="research-chart-wrap"><ResearchChart model={model} /></div>
                  <div className="research-table-wrap">
                    <table className="research-table">
                      <caption className="sr-only">Citation rates and Wilson 95% confidence intervals for {model.model}</caption>
                      <thead><tr><th scope="col">Source form</th><th scope="col">Citation rate</th><th scope="col">Wilson 95% CI</th></tr></thead>
                      <tbody>{model.versions.map((item) => (
                        <tr key={item.version}>
                          <th scope="row">{VERSION_LABELS[item.version]}</th>
                          <td>{item.rate === null ? "n/a" : <>{(item.rate * 100).toFixed(1)}% <small>(n={item.citedTrials}/{item.trials})</small></>}</td>
                          <td>{item.ci95 ? <>{(item.ci95.low * 100).toFixed(1)}–{(item.ci95.high * 100).toFixed(1)}% <small>(n={item.trials})</small></> : "n/a"}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              </article>
            ))}
          </section>
        </>
      )}

      <section className="ui-card research-reference">
        <header className="ui-card-header"><div><h2 className="ui-card-title">Published comparison</h2><p>Context only · GPT-4o in-context figures</p></div></header>
        <div className="research-table-wrap"><table className="research-table">
          <caption className="sr-only">Published comparison values from the project specification</caption>
          <thead><tr><th scope="col">Source form</th><th scope="col">Published citation rate</th><th scope="col">Sample size</th></tr></thead>
          <tbody>{PUBLISHED.map((item) => <tr key={item.version}><th scope="row">{item.version}</th><td>{item.rate}</td><td>Not stated in project spec</td></tr>)}</tbody>
        </table></div>
      </section>

      <section className="research-limitations" aria-labelledby="research-limitations-title">
        <h2 id="research-limitations-title">Limitations</h2>
        <ul>
          <li>This is a small pilot with five synthetic topics and in-context source selection; it is not live web retrieval.</li>
          <li>Results describe associations in this sample and do not establish that a source form causes citations or generalize to other models, topics, or real product information.</li>
          <li>Repeated questions may be dependent. Wilson intervals and the uniform chi-square test are exploratory and treat observations as independent.</li>
          <li>Published values are context, not a target; the reference sample size is not stated in the project specification.</li>
        </ul>
      </section>
    </main>
  );
}
