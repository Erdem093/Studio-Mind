import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Check, MessageSquareWarning, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

interface ArtifactRow {
  id: string;
  type: string;
  content: string | null;
  approval_status: string;
  created_at: string;
  agent_name: string | null;
  agent_version: string | null;
}

interface RunRow {
  id: string;
  video_id: string;
  status: string;
  cost_tokens: number | null;
  cost_usd: number | null;
  started_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  strategy: "Strategy Notes",
  script: "Script Draft",
  hook: "Hook Options",
  title: "Title & Thumbnail",
  story: "Story Structure",
};

const FEEDBACK_OPTIONS = [
  { value: "too_long", label: "Too long" },
  { value: "not_engaging", label: "Not engaging" },
  { value: "wrong_tone", label: "Wrong tone" },
  { value: "poor_hook", label: "Poor hook" },
  { value: "other", label: "Other" },
] as const;

export default function RunDetail() {
  const { runId } = useParams();
  const { toast } = useToast();
  const [run, setRun] = useState<RunRow | null>(null);
  const [artifacts, setArtifacts] = useState<ArtifactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [feedbackReason, setFeedbackReason] = useState<string>("not_engaging");
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [selectedArtifactId, setSelectedArtifactId] = useState<string>("run");
  const [appliesGlobally, setAppliesGlobally] = useState(true);
  const [rejectingArtifactId, setRejectingArtifactId] = useState<string | null>(null);

  const fetchData = async () => {
    if (!runId) return;
    const [{ data: runData }, { data: artifactData }] = await Promise.all([
      supabase.from("runs").select("*").eq("id", runId).single(),
      supabase.from("artifacts").select("*").eq("run_id", runId).order("created_at"),
    ]);
    setRun(runData);
    setArtifacts(artifactData || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [runId]);

  const updateApproval = async (artifactId: string, status: "approved" | "rejected") => {
    const { error } = await supabase
      .from("artifacts")
      .update({
        approval_status: status,
        approved_at: status === "approved" ? new Date().toISOString() : null,
      })
      .eq("id", artifactId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    fetchData();
  };

  const submitFeedback = async () => {
    if (!runId) return;

    setFeedbackSubmitting(true);
    const artifactId = selectedArtifactId === "run" ? undefined : selectedArtifactId;
    const { data, error } = await supabase.functions.invoke("submit-run-feedback", {
      body: {
        runId,
        artifactId,
        reasonCode: feedbackReason,
        freeText: feedbackText.trim() || undefined,
        appliesGlobally: appliesGlobally || !artifactId,
      },
    });

    if (error || (data as { error?: string } | null)?.error) {
      toast({
        title: "Feedback failed",
        description: error?.message || (data as { error?: string } | null)?.error || "Unknown error",
        variant: "destructive",
      });
      setFeedbackSubmitting(false);
      return;
    }

    toast({ title: "Feedback saved", description: "Future runs will use this memory." });

    if (rejectingArtifactId) {
      const { error: rejectError } = await supabase
        .from("artifacts")
        .update({
          approval_status: "rejected",
          approved_at: null,
        })
        .eq("id", rejectingArtifactId);

      if (rejectError) {
        toast({ title: "Reject failed", description: rejectError.message, variant: "destructive" });
      }
    }

    setFeedbackText("");
    setFeedbackReason("not_engaging");
    setSelectedArtifactId("run");
    setAppliesGlobally(true);
    setRejectingArtifactId(null);
    setFeedbackDialogOpen(false);
    setFeedbackSubmitting(false);
    await fetchData();
  };

  const openFeedbackDialog = (artifactId?: string, forReject = false) => {
    setSelectedArtifactId(artifactId ?? "run");
    setAppliesGlobally(!artifactId);
    setRejectingArtifactId(forReject && artifactId ? artifactId : null);
    setFeedbackDialogOpen(true);
  };

  const statusBadge = (status: string) => {
    if (status === "approved") return <Badge className="bg-success text-success-foreground">Approved</Badge>;
    if (status === "rejected") return <Badge variant="destructive">Rejected</Badge>;
    return <Badge className="bg-warning text-warning-foreground">Pending</Badge>;
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

  if (!run) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Run not found</p>
        </div>
      </AppLayout>
    );
  }

  const grouped = artifacts.reduce((acc, art) => {
    (acc[art.type] = acc[art.type] || []).push(art);
    return acc;
  }, {} as Record<string, ArtifactRow[]>);

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <Link to={`/video/${run.video_id}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" />Back to Video
        </Link>

        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">Run #{run.id.slice(0, 8)}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span>{format(new Date(run.started_at), "MMM d, yyyy · h:mm a")}</span>
              {run.cost_tokens && <span>{run.cost_tokens.toLocaleString()} tokens</span>}
              {run.cost_usd && <span>${Number(run.cost_usd).toFixed(4)}</span>}
            </div>
          </div>
          <Button variant="outline" onClick={() => openFeedbackDialog()}>
            <MessageSquareWarning className="mr-2 h-4 w-4" />Why I didn't like this
          </Button>
        </div>

        {Object.entries(grouped).map(([type, arts]) => (
          <div key={type}>
            <h2 className="text-lg font-display font-semibold mb-3">{TYPE_LABELS[type] || type}</h2>
            <div className="space-y-3">
              {arts.map((art) => (
                <Card key={art.id}>
                  <CardContent className="pt-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="space-y-2">
                        {statusBadge(art.approval_status)}
                        {art.agent_name && (
                          <p className="text-xs text-muted-foreground">
                            {art.agent_name}
                            {art.agent_version ? ` (${art.agent_version})` : ""}
                          </p>
                        )}
                      </div>
                      {art.approval_status === "pending" && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-success border-success hover:bg-success/10"
                            onClick={() => updateApproval(art.id, "approved")}
                          >
                            <Check className="mr-1 h-3 w-3" />Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive border-destructive hover:bg-destructive/10"
                            onClick={() => openFeedbackDialog(art.id, true)}
                          >
                            <X className="mr-1 h-3 w-3" />Reject
                          </Button>
                        </div>
                      )}
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{art.content || "No content"}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}

        {artifacts.length === 0 && (
          <Card className="text-center py-8">
            <CardContent>
              <p className="text-muted-foreground">No artifacts generated for this run.</p>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog
        open={feedbackDialogOpen}
        onOpenChange={(open) => {
          setFeedbackDialogOpen(open);
          if (!open) {
            setRejectingArtifactId(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Why didn&apos;t this run work for you?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              {rejectingArtifactId ? (
                <>
                  <Label>Feedback target</Label>
                  <p className="text-sm text-muted-foreground">This rejection feedback will be attached to the selected artifact.</p>
                </>
              ) : (
                <>
                  <Label>Feedback target</Label>
                  <Select
                    value={selectedArtifactId}
                    onValueChange={(value) => {
                      setSelectedArtifactId(value);
                      if (value === "run") setAppliesGlobally(true);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose target" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="run">Entire run (global preference)</SelectItem>
                      {artifacts.map((artifact) => (
                        <SelectItem key={artifact.id} value={artifact.id}>
                          {(TYPE_LABELS[artifact.type] || artifact.type) + (artifact.agent_name ? ` - ${artifact.agent_name}` : "")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>
            <div className="space-y-2">
              <Label>Feedback reason</Label>
              <Select value={feedbackReason} onValueChange={setFeedbackReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a reason" />
                </SelectTrigger>
                <SelectContent>
                  {FEEDBACK_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Details (optional)</Label>
              <Textarea
                placeholder="Example: Keep hooks below 10 words and avoid clickbait phrasing."
                value={feedbackText}
                onChange={(event) => setFeedbackText(event.target.value)}
              />
            </div>
            {!rejectingArtifactId && (
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Apply globally across future runs</p>
                  <p className="text-xs text-muted-foreground">When off, memory is targeted to the selected artifact agent.</p>
                </div>
                <Switch
                  checked={appliesGlobally}
                  onCheckedChange={(checked) => {
                    setAppliesGlobally(checked);
                    if (checked) setSelectedArtifactId("run");
                  }}
                />
              </div>
            )}
            <Button onClick={submitFeedback} disabled={feedbackSubmitting} className="w-full">
              {feedbackSubmitting ? "Saving..." : rejectingArtifactId ? "Save Feedback and Reject" : "Save Feedback"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
