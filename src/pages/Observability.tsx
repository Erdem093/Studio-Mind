import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

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
}

export default function Observability() {
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("runs").select("*").order("started_at", { ascending: false }).limit(50).then(({ data }) => {
      setRuns(data || []);
      setLoading(false);
    });
  }, []);

  const totalCost = runs.reduce((s, r) => s + (Number(r.cost_usd) || 0), 0);
  const totalTokens = runs.reduce((s, r) => s + (r.cost_tokens || 0), 0);

  // Group runs by date for chart
  const chartData = runs.reduce((acc, run) => {
    const day = format(new Date(run.started_at), "MMM d");
    const existing = acc.find((d) => d.date === day);
    if (existing) {
      existing.cost += Number(run.cost_usd) || 0;
      existing.runs += 1;
    } else {
      acc.push({ date: day, cost: Number(run.cost_usd) || 0, runs: 1 });
    }
    return acc;
  }, [] as { date: string; cost: number; runs: number }[]).reverse();

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-display font-bold">Observability</h1>
          <p className="text-muted-foreground mt-1">Track usage and costs across your pipeline runs</p>
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
            <CardDescription>Cost breakdown per pipeline run</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
            ) : runs.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No runs yet</p>
            ) : (
              <div className="space-y-2">
                {runs.map((run) => (
                  <div key={run.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium">Run #{run.id.slice(0, 8)}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(run.started_at), "MMM d · h:mm a")}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {run.trace_url && (
                          <a
                            href={run.trace_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-primary hover:underline"
                          >
                            Trace
                          </a>
                        )}
                        {run.model && <span className="text-xs text-muted-foreground">{run.model}</span>}
                        {run.error_message && (
                          <span className="text-xs text-destructive truncate max-w-80">{run.error_message}</span>
                        )}
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
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
