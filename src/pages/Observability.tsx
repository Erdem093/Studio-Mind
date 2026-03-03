import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface AgentMetric {
  agent_name: string;
  artifact_type: string;
  latency_ms: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
  status: "completed" | "failed";
  error_message: string | null;
  prompt_text?: string;
}

interface RunRow {
  id: string;
  video_id: string;
  status: string;
  cost_tokens: number | null;
  cost_usd: number | null;
  started_at: string;
  trace_id: string | null;
  trace_url: string | null;
  model: string | null;
  error_message: string | null;
  agent_metrics: AgentMetric[] | null;
  memory_applied: Array<{
    agent: string;
    memory_rows: Array<{ id: string; key: string; priority: number }>;
    feedback_rows: Array<{ id: string; reason_code: string; feedback_weight: number }>;
  }> | null;
  quality_delta: {
    previous_score: number | null;
    current_score: number | null;
    delta_score: number | null;
  } | null;
}

export default function Observability() {
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("runs").select("*").order("started_at", { ascending: false }).limit(50).then(({ data }) => {
      setRuns((data || []) as RunRow[]);
      setLoading(false);
    });
  }, []);

  const totalCost = runs.reduce((sum, run) => sum + (Number(run.cost_usd) || 0), 0);
  const totalTokens = runs.reduce((sum, run) => sum + (run.cost_tokens || 0), 0);

  const chartData = useMemo(() => {
    return runs
      .reduce((acc, run) => {
        const day = format(new Date(run.started_at), "MMM d");
        const existing = acc.find((item) => item.date === day);

        if (existing) {
          existing.cost += Number(run.cost_usd) || 0;
          existing.runs += 1;
        } else {
          acc.push({ date: day, cost: Number(run.cost_usd) || 0, runs: 1 });
        }

        return acc;
      }, [] as { date: string; cost: number; runs: number }[])
      .reverse();
  }, [runs]);

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-display font-bold">Observability</h1>
          <p className="text-muted-foreground mt-1">Pipeline traces, per-agent metrics, and run cost diagnostics</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Spend</p>
              <p className="text-3xl font-bold font-display">${totalCost.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Tokens</p>
              <p className="text-3xl font-bold font-display">{totalTokens.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Runs</p>
              <p className="text-3xl font-bold font-display">{runs.length}</p>
            </CardContent>
          </Card>
        </div>

        {chartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="font-display">Usage Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip />
                  <Bar dataKey="runs" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="font-display">Recent Runs</CardTitle>
            <CardDescription>Per-agent execution metrics and traces</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              </div>
            ) : runs.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No runs yet</p>
            ) : (
              <div className="space-y-4">
                {runs.map((run) => {
                  const metrics = run.agent_metrics || [];
                  const failedCount = metrics.filter((metric) => metric.status === "failed").length;
                  const totalLatency = metrics.reduce((sum, metric) => sum + (metric.latency_ms || 0), 0);

                  return (
                    <div key={run.id} className="py-3 border-b last:border-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium">Run #{run.id.slice(0, 8)}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(run.started_at), "MMM d · h:mm a")}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {run.trace_url && (
                              <a href={run.trace_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                                Trace
                              </a>
                            )}
                            {run.model && <span className="text-xs text-muted-foreground">{run.model}</span>}
                            <span className="text-xs text-muted-foreground">
                              {metrics.length} agents · {(totalLatency / 1000).toFixed(2)}s
                            </span>
                            {Array.isArray(run.memory_applied) && (
                              <span className="text-xs text-muted-foreground">
                                Memory refs:{" "}
                                {run.memory_applied.reduce(
                                  (sum, item) => sum + item.memory_rows.length + item.feedback_rows.length,
                                  0,
                                )}
                              </span>
                            )}
                            {failedCount > 0 && <span className="text-xs text-destructive">{failedCount} failed</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-muted-foreground">{(run.cost_tokens || 0).toLocaleString()} tokens</span>
                          <span className="font-medium">${(Number(run.cost_usd) || 0).toFixed(4)}</span>
                          <Badge variant={run.status === "completed" ? "default" : run.status === "failed" ? "destructive" : "secondary"}>
                            {run.status}
                          </Badge>
                        </div>
                      </div>

                      {metrics.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
                          {metrics.map((metric, index) => (
                            <div key={`${run.id}-${metric.agent_name}-${index}`} className="rounded-md border p-2 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{metric.agent_name}</span>
                                <Badge variant={metric.status === "completed" ? "outline" : "destructive"}>{metric.status}</Badge>
                              </div>
                              <p className="text-muted-foreground mt-1">
                                {metric.artifact_type} · {(metric.latency_ms / 1000).toFixed(2)}s · {metric.total_tokens.toLocaleString()} tokens ·
                                ${metric.cost_usd.toFixed(4)}
                              </p>
                              {metric.error_message && <p className="text-destructive mt-1">{metric.error_message}</p>}
                              {metric.prompt_text && (
                                <details className="mt-2">
                                  <summary className="cursor-pointer text-muted-foreground">Prompt</summary>
                                  <pre className="mt-1 whitespace-pre-wrap rounded border bg-muted/30 p-2 text-[11px] leading-4">{metric.prompt_text}</pre>
                                </details>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {run.error_message && <p className="text-xs text-destructive mt-2">{run.error_message}</p>}
                      {run.quality_delta?.current_score !== null && run.quality_delta?.current_score !== undefined && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Quality score: {run.quality_delta.current_score}
                          {run.quality_delta.delta_score !== null && run.quality_delta.delta_score !== undefined
                            ? ` (${run.quality_delta.delta_score >= 0 ? "+" : ""}${run.quality_delta.delta_score} vs previous)`
                            : ""}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
