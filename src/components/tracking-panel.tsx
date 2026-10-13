"use client";

import { useEffect, useState } from "react";
import { Activity, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";

type RunStatus = {
  runId: string;
  status: "running" | "completed" | "failed";
  startedAt: string | null;
  finishedAt: string | null;
  totalExpected: number;
  completed: number;
  simulatedCount: number;
  hasSimulated?: boolean;
};

async function readError(response: Response): Promise<string> {
  try {
    const payload: unknown = await response.json();
    if (typeof payload === "object" && payload !== null && "error" in payload) return String(payload.error);
  } catch { /* show the generic fallback */ }
  return "Unable to load tracking status.";
}

export function TrackingPanel({ brandId }: { brandId: string }) {
  const [run, setRun] = useState<RunStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;
    void fetch(`/api/brands/${brandId}/runs?limit=1`).then(async (response) => {
      if (!response.ok) throw new Error(await readError(response));
      const payload = await response.json() as { runs: RunStatus[] };
      if (active) setRun(payload.runs[0] ?? null);
    }).catch((cause: unknown) => {
      if (active) setErrorMessage(cause instanceof Error ? cause.message : "Unable to load recent run.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [brandId]);

  useEffect(() => {
    if (!run || run.status !== "running") return;
    let active = true;
    const timer = window.setTimeout(() => {
      void fetch(`/api/runs/${run.runId}`).then(async (response) => {
        if (!response.ok) throw new Error(await readError(response));
        const status = await response.json() as RunStatus;
        if (active) setRun((current) => current?.runId === status.runId ? { ...current, ...status } : current);
      }).catch((cause: unknown) => {
        if (active) setErrorMessage(cause instanceof Error ? cause.message : "Unable to refresh tracking status.");
      });
    }, 2_000);
    return () => { active = false; window.clearTimeout(timer); };
  }, [run]);

  async function startTracking() {
    setStarting(true);
    setErrorMessage("");
    try {
      const response = await fetch(`/api/brands/${brandId}/track`, { method: "POST" });
      if (!response.ok) throw new Error(await readError(response));
      const created = await response.json() as { runId: string; status: RunStatus["status"]; totalExpected: number; hasSimulated: boolean };
      setRun({
        runId: created.runId, status: created.status, startedAt: new Date().toISOString(), finishedAt: null,
        totalExpected: created.totalExpected, completed: 0, simulatedCount: 0, hasSimulated: created.hasSimulated,
      });
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : "Unable to start tracking.");
    } finally {
      setStarting(false);
    }
  }

  const percent = run ? run.totalExpected === 0 ? 100 : Math.min(100, Math.round((run.completed / run.totalExpected) * 100)) : 0;
  const isSimulated = (run?.simulatedCount ?? 0) > 0 || run?.hasSimulated === true;

  return <section className="tracking-panel" aria-labelledby="tracking-heading">
    <div className="tracking-panel-copy">
      <p className="eyebrow"><Activity size={13} /> TRACKING RUN</p>
      <h2 id="tracking-heading">Collect a fresh set of answers</h2>
      <p>Run active prompts across the configured AI platforms. Results are stored as a new historical run.</p>
    </div>
    <div className="tracking-panel-action">
      <Button variant="primary" onClick={() => void startTracking()} loading={starting || run?.status === "running"}>
        <Radio size={16} /> {run?.status === "running" ? "Tracking in progress" : "Run tracking"}
      </Button>
      {run && <div className="tracking-status" aria-live="polite">
        <span className={`tracking-signal${run.status === "running" ? " tracking-signal-active" : ""}`} aria-hidden="true" />
        <span>{run.status === "running" ? "Collecting answers" : run.status === "failed" ? "Run failed" : "Latest run completed"}</span>
        {isSimulated && <span className="simulated-badge">simulated</span>}
      </div>}
    </div>
    {run && <div className="tracking-progress" aria-label="Tracking progress">
      <div className="tracking-progress-label"><span>{run.completed} of {run.totalExpected} answers processed</span><span>{percent}%</span></div>
      <div className="tracking-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={run.totalExpected || 1} aria-valuenow={run.completed} aria-valuetext={`${percent}% complete`}>
        <span style={{ width: `${percent}%` }} />
      </div>
      {run.status === "failed" && <p className="tracking-error">The run could not finish. Start another run to try again.</p>}
    </div>}
    {loading && <p className="tracking-muted" role="status">Loading recent run…</p>}
    {errorMessage && <p className="tracking-error" role="alert">{errorMessage}</p>}
  </section>;
}
