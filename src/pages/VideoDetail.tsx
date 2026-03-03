import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Play, Clock, CheckCircle, XCircle, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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

async function readFunctionErrorMessage(error: unknown): Promise<string> {
  const fallback = error instanceof Error ? error.message : "Unknown error";
  const maybe = error as { context?: { json?: () => Promise<{ error?: string }> } };
  if (!maybe.context?.json) return fallback;
  const payload = await maybe.context.json().catch(() => null);
  return payload?.error || fallback;
}

export default function VideoDetail() {
  const { videoId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [video, setVideo] = useState<VideoRow | null>(null);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [artifactCounts, setArtifactCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
    setRunning(true);
    const { data, error } = await supabase.functions.invoke("run-pipeline", {
      body: { videoId },
    });

    if (error) {
      toast({ title: "Run failed", description: error.message, variant: "destructive" });
      await fetchData();
      setRunning(false);
      return;
    }

    if ((data as { error?: string } | null)?.error) {
      toast({
        title: "Run failed",
        description: (data as { error: string }).error,
        variant: "destructive",
      });
      await fetchData();
      setRunning(false);
      return;
    }

    toast({ title: "Run complete", description: "Artifacts were generated successfully." });
    await fetchData();
    setRunning(false);
  };

  const statusIcon = (status: string) => {
    if (status === "completed") return <CheckCircle className="h-4 w-4 text-success" />;
    if (status === "failed") return <XCircle className="h-4 w-4 text-destructive" />;
    return <Clock className="h-4 w-4 text-warning" />;
  };

  const deleteProject = async () => {
    if (!videoId) return;
    setDeleting(true);

    const { data, error } = await supabase.functions.invoke("delete-project", {
      body: { videoId },
    });

    if (error || (data as { error?: string } | null)?.error) {
      const description = error ? await readFunctionErrorMessage(error) : (data as { error?: string } | null)?.error || "Unknown error";
      toast({
        title: "Delete failed",
        description,
        variant: "destructive",
      });
      setDeleting(false);
      return;
    }

    toast({ title: "Project deleted", description: "Video and related runs were removed." });
    navigate("/dashboard");
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
          <div className="flex items-center gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-destructive border-destructive hover:bg-destructive/10">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Project
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this project?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this video, all runs, artifacts, feedback, and related insights.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={deleteProject} disabled={deleting}>
                    {deleting ? "Deleting..." : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button onClick={triggerRun} disabled={running || deleting}>
              <Play className="mr-2 h-4 w-4" />
              {running ? "Running..." : "New Run"}
            </Button>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-display font-semibold mb-4">Run History</h2>
          {runs.length === 0 ? (
            <Card className="text-center py-8">
              <CardContent>
                <p className="text-muted-foreground mb-4">No runs yet. Trigger your first AI pipeline run.</p>
                <Button onClick={triggerRun} disabled={running}>
                  <Play className="mr-2 h-4 w-4" />
                  {running ? "Running..." : "Run Pipeline"}
                </Button>
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
