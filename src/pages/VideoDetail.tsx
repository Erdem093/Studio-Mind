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
    const { data: runData, error } = await supabase.from("runs").insert({
      video_id: videoId,
      user_id: user.id,
      status: "completed",
      cost_tokens: Math.floor(Math.random() * 5000) + 1000,
      cost_usd: parseFloat((Math.random() * 0.5 + 0.05).toFixed(4)),
      completed_at: new Date().toISOString(),
    }).select().single();
    if (error || !runData) {
      toast({ title: "Error", description: error?.message || "Failed to create run", variant: "destructive" });
      return;
    }
    // Generate mock artifacts
    const mockArtifacts = [
      { run_id: runData.id, user_id: user.id, type: "story", content: "ACT 1 — THE SETUP\nIntroduce the challenge: learning guitar from zero in just 24 hours. Show the stakes, the doubts, and the first awkward chord.\n\nACT 2 — THE STRUGGLE\nMontage of practice sessions, sore fingers, failed attempts. Interview a guitar teacher who gives a crash-course.\n\nACT 3 — THE PAYOFF\nPerform a simple song in front of friends. Reveal whether 24 hours was enough." },
      { run_id: runData.id, user_id: user.id, type: "script", content: "[COLD OPEN]\n\"I've never touched a guitar in my life. In 24 hours, I'm going to perform a song in front of a live audience. Let's see if that's even possible.\"\n\n[SEGMENT 1 — Hour 0-4]\nPick up guitar, learn basic chords (G, C, D). Show the frustration. Quick cuts of failed strums.\n\n[SEGMENT 2 — Hour 4-12]\nMeet a teacher. Learn a simple song structure. Practice until fingers hurt.\n\n[SEGMENT 3 — Hour 12-24]\nFinal rehearsal. Build tension. Cut to the performance.\n\n[OUTRO]\nReflect on what was learned. Tease the next challenge." },
      { run_id: runData.id, user_id: user.id, type: "hook", content: "Hook Option A: \"They said it takes 10,000 hours to master guitar. I had 24.\"\n\nHook Option B: \"I bet my friend $500 I could learn guitar in a single day.\"\n\nHook Option C: \"What if you only had 24 hours to learn an instrument from scratch?\"" },
      { run_id: runData.id, user_id: user.id, type: "title", content: "Title Option A: \"I Learned Guitar in 24 Hours (It Didn't Go Well)\"\nTitle Option B: \"24 Hour Guitar Challenge — Zero to Performance\"\nTitle Option C: \"Can You ACTUALLY Learn Guitar in One Day?\"\n\nThumbnail idea: Split frame — left side shows confused face holding guitar wrong, right side shows confident performance pose. Big bold text: \"24 HRS\"" },
    ];
    const { error: artError } = await supabase.from("artifacts").insert(mockArtifacts);
    if (artError) {
      toast({ title: "Warning", description: "Run created but artifacts failed: " + artError.message, variant: "destructive" });
    }
    fetchData();
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
