import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Play, Clock, CheckCircle, XCircle, Trash2, Wand2, Pencil } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

interface ApprovedOutputRow {
  id: string;
  run_id: string;
  version: number;
  json_storage_path: string;
  pdf_storage_path: string;
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
  const [editingMeta, setEditingMeta] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [metaSaving, setMetaSaving] = useState(false);
  const [titleSuggestion, setTitleSuggestion] = useState("");
  const [descriptionSuggestion, setDescriptionSuggestion] = useState("");
  const [suggestingTarget, setSuggestingTarget] = useState<"title" | "description" | null>(null);
  const [approvedOutputs, setApprovedOutputs] = useState<ApprovedOutputRow[]>([]);
  const [applyingBaseline, setApplyingBaseline] = useState<string | null>(null);

  const fetchData = async () => {
    if (!videoId) return;
    const [{ data: v }, { data: r }, { data: outputs }] = await Promise.all([
      supabase.from("videos").select("*").eq("id", videoId).single(),
      supabase.from("runs").select("*").eq("video_id", videoId).order("started_at", { ascending: false }),
      supabase.from("approved_outputs").select("*").eq("video_id", videoId).order("created_at", { ascending: false }),
    ]);
    setVideo(v);
    setDraftTitle(v?.title || "");
    setDraftDescription(v?.description || "");
    setRuns(r || []);
    setApprovedOutputs((outputs || []) as ApprovedOutputRow[]);

    if (r && r.length > 0) {
      const { data: arts } = await supabase.from("artifacts").select("run_id").in("run_id", r.map((x: any) => x.id));
      const counts: Record<string, number> = {};
      (arts || []).forEach((a: any) => { counts[a.run_id] = (counts[a.run_id] || 0) + 1; });
      setArtifactCounts(counts);
    }
    setLoading(false);
  };

  const downloadApprovedFile = async (path: string) => {
    const { data, error } = await supabase.storage.from("approved-outputs").createSignedUrl(path, 60 * 10);
    if (error || !data?.signedUrl) {
      toast({ title: "Download failed", description: error?.message || "No URL generated", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const useApprovedAsBaseline = async (output: ApprovedOutputRow) => {
    if (!user || !videoId) return;
    setApplyingBaseline(output.id);

    const { data: artifacts, error: artifactError } = await supabase
      .from("artifacts")
      .select("type, content")
      .eq("run_id", output.run_id)
      .eq("approval_status", "approved");

    if (artifactError || !artifacts || artifacts.length === 0) {
      toast({ title: "Baseline failed", description: artifactError?.message || "No approved artifacts found", variant: "destructive" });
      setApplyingBaseline(null);
      return;
    }

    const baselineText = artifacts
      .map((artifact) => `${artifact.type.toUpperCase()}: ${(artifact.content || "").replace(/\\s+/g, " ").slice(0, 280)}`)
      .join("\\n");

    const { error: memoryError } = await supabase.from("agent_memory").insert({
      user_id: user.id,
      video_id: videoId,
      key: "approved_output_baseline_manual",
      value: {
        run_id: output.run_id,
        version: output.version,
        text: baselineText,
        set_at: new Date().toISOString(),
      },
      source: "manual_pref_edit",
      agent_name: null,
      priority: 5,
    });

    if (memoryError) {
      toast({ title: "Baseline failed", description: memoryError.message, variant: "destructive" });
      setApplyingBaseline(null);
      return;
    }

    await supabase.from("agent_modification_log").insert({
      user_id: user.id,
      video_id: videoId,
      run_id: output.run_id,
      source: "manual_pref_edit",
      change_summary: `Applied approved output v${output.version} as generation baseline`,
      metadata: { approved_output_id: output.id },
    });

    toast({ title: "Baseline applied", description: "Next runs will use this approved package context." });
    setApplyingBaseline(null);
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

  const saveVideoMeta = async () => {
    if (!videoId) return;
    setMetaSaving(true);
    const { error } = await supabase
      .from("videos")
      .update({ title: draftTitle.trim(), description: draftDescription.trim() || null })
      .eq("id", videoId);

    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      setMetaSaving(false);
      return;
    }

    toast({ title: "Saved", description: "Video details updated." });
    setEditingMeta(false);
    setTitleSuggestion("");
    setDescriptionSuggestion("");
    await fetchData();
    setMetaSaving(false);
  };

  const suggestCopy = async (target: "title" | "description") => {
    if (!videoId) return;
    setSuggestingTarget(target);
    const { data, error } = await supabase.functions.invoke("suggest-video-copy", {
      body: {
        videoId,
        target,
        currentText: target === "title" ? draftTitle : draftDescription,
        contextText: target === "title" ? draftDescription : draftTitle,
      },
    });

    if (error || (data as { error?: string } | null)?.error) {
      const description = error ? await readFunctionErrorMessage(error) : (data as { error?: string } | null)?.error || "Unknown error";
      toast({ title: "Suggestion failed", description, variant: "destructive" });
      setSuggestingTarget(null);
      return;
    }

    const suggestion = ((data as { suggestion?: string } | null)?.suggestion || "").trim();
    if (!suggestion) {
      toast({ title: "Suggestion failed", description: "No suggestion returned", variant: "destructive" });
      setSuggestingTarget(null);
      return;
    }

    if (target === "title") setTitleSuggestion(suggestion);
    else setDescriptionSuggestion(suggestion);
    setSuggestingTarget(null);
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
          <div className="flex-1">
            {!editingMeta ? (
              <>
                <h1 className="text-3xl font-display font-bold">{video.title}</h1>
                {video.description && <p className="text-muted-foreground mt-2">{video.description}</p>}
              </>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Title</Label>
                    <Button size="sm" variant="outline" onClick={() => suggestCopy("title")} disabled={suggestingTarget !== null}>
                      <Wand2 className="mr-2 h-3.5 w-3.5" />
                      {suggestingTarget === "title" ? "Suggesting..." : "Suggest Title"}
                    </Button>
                  </div>
                  <Input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} />
                  {titleSuggestion && (
                    <div className="rounded-md border p-3 bg-muted/30">
                      <p className="text-xs text-muted-foreground mb-1">Suggested Title</p>
                      <p className="text-sm">{titleSuggestion}</p>
                      <Button size="sm" variant="secondary" className="mt-2" onClick={() => setDraftTitle(titleSuggestion)}>Apply</Button>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Description</Label>
                    <Button size="sm" variant="outline" onClick={() => suggestCopy("description")} disabled={suggestingTarget !== null}>
                      <Wand2 className="mr-2 h-3.5 w-3.5" />
                      {suggestingTarget === "description" ? "Suggesting..." : "Suggest Description"}
                    </Button>
                  </div>
                  <Textarea value={draftDescription} onChange={(event) => setDraftDescription(event.target.value)} />
                  {descriptionSuggestion && (
                    <div className="rounded-md border p-3 bg-muted/30">
                      <p className="text-xs text-muted-foreground mb-1">Suggested Description</p>
                      <p className="text-sm whitespace-pre-wrap">{descriptionSuggestion}</p>
                      <Button size="sm" variant="secondary" className="mt-2" onClick={() => setDraftDescription(descriptionSuggestion)}>Apply</Button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={saveVideoMeta} disabled={metaSaving}>
                    {metaSaving ? "Saving..." : "Save"}
                  </Button>
                  <Button variant="outline" onClick={() => { setEditingMeta(false); setDraftTitle(video.title); setDraftDescription(video.description || ""); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
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
            {!editingMeta && (
              <Button variant="outline" onClick={() => setEditingMeta(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit Title/Description
              </Button>
            )}
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

        <div>
          <h2 className="text-xl font-display font-semibold mb-4">Approved Outputs</h2>
          {approvedOutputs.length === 0 ? (
            <Card>
              <CardContent className="py-6">
                <p className="text-sm text-muted-foreground">No finalized outputs yet. Finalize from Run Detail after approvals.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {approvedOutputs.map((output) => (
                <Card key={output.id}>
                  <CardContent className="py-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-sm">Approved Package v{output.version}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(output.created_at), "MMM d, yyyy · h:mm a")}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => downloadApprovedFile(output.json_storage_path)}>JSON</Button>
                      <Button size="sm" variant="outline" onClick={() => downloadApprovedFile(output.pdf_storage_path)}>PDF</Button>
                      <Button size="sm" onClick={() => useApprovedAsBaseline(output)} disabled={applyingBaseline === output.id}>
                        {applyingBaseline === output.id ? "Applying..." : "Use As Baseline"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
