import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Play, Clock, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface RunRow {
  id: string;
  status: string;
  cost_tokens: number | null;
  cost_usd: number | null;
  started_at: string;
  completed_at: string | null;
}

interface VideoRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
}

export default function VideoDetail() {
  const { videoId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [video, setVideo] = useState<VideoRow | null>(null);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [artifactCounts, setArtifactCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!videoId) return;
    const [{ data: v }, { data: r }] = await Promise.all([
      supabase.from("videos").select("*").eq("id", videoId).single(),
      supabase.from("runs").select("*").eq("video_id", videoId).order("started_at", { ascending: false }),
    ]);
    setVideo(v);
    setRuns(r || []);

    if (r && r.length > 0) {
      const { data: arts } = await supabase.from("artifacts").select("run_id").in("run_id", r.map((x: any) => x.id));
      const counts: Record<string, number> = {};
      (arts || []).forEach((a: any) => { counts[a.run_id] = (counts[a.run_id] || 0) + 1; });
      setArtifactCounts(counts);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [videoId]);

  const triggerRun = async () => {
    if (!videoId || !user) return;
    const { error } = await supabase.from("runs").insert({
      video_id: videoId,
      user_id: user.id,
      status: "completed",
      cost_tokens: Math.floor(Math.random() * 5000) + 1000,
      cost_usd: parseFloat((Math.random() * 0.5 + 0.05).toFixed(4)),
      completed_at: new Date().toISOString(),
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      fetchData();
    }
  };

  const statusIcon = (status: string) => {
    if (status === "completed") return <CheckCircle className="h-4 w-4 text-success" />;
    if (status === "failed") return <XCircle className="h-4 w-4 text-destructive" />;
    return <Clock className="h-4 w-4 text-warning" />;
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!video) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Video not found</p>
          <Link to="/dashboard"><Button variant="link">Back to Dashboard</Button></Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <Link to="/dashboard" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" />Back to Dashboard
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">{video.title}</h1>
            {video.description && <p className="text-muted-foreground mt-2">{video.description}</p>}
            <div className="flex items-center gap-3 mt-3">
              <Badge variant={video.status === "draft" ? "secondary" : "default"}>{video.status}</Badge>
              <span className="text-sm text-muted-foreground">Created {format(new Date(video.created_at), "MMM d, yyyy")}</span>
            </div>
          </div>
          <Button onClick={triggerRun}><Play className="mr-2 h-4 w-4" />New Run</Button>
        </div>

        <div>
          <h2 className="text-xl font-display font-semibold mb-4">Run History</h2>
          {runs.length === 0 ? (
            <Card className="text-center py-8">
              <CardContent>
                <p className="text-muted-foreground mb-4">No runs yet. Trigger your first AI pipeline run.</p>
                <Button onClick={triggerRun}><Play className="mr-2 h-4 w-4" />Run Pipeline</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {runs.map((run) => (
                <Link key={run.id} to={`/run/${run.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="py-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {statusIcon(run.status)}
                        <div>
                          <p className="font-medium text-sm">Run #{run.id.slice(0, 8)}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(run.started_at), "MMM d, yyyy · h:mm a")}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{artifactCounts[run.id] || 0} artifacts</span>
                        <Badge variant={run.status === "completed" ? "default" : run.status === "failed" ? "destructive" : "secondary"}>
                          {run.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
