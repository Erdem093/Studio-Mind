import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface ArtifactRow {
  id: string;
  type: string;
  content: string | null;
  approval_status: string;
  created_at: string;
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
  story: "Story Structure",
  script: "Script Draft",
  hook: "Hook Option",
  title: "Title & Thumbnail",
};

export default function RunDetail() {
  const { runId } = useParams();
  const { toast } = useToast();
  const [run, setRun] = useState<RunRow | null>(null);
  const [artifacts, setArtifacts] = useState<ArtifactRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!runId) return;
    const [{ data: r }, { data: a }] = await Promise.all([
      supabase.from("runs").select("*").eq("id", runId).single(),
      supabase.from("artifacts").select("*").eq("run_id", runId).order("created_at"),
    ]);
    setRun(r);
    setArtifacts(a || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [runId]);

  const updateApproval = async (artifactId: string, status: "approved" | "rejected") => {
    const { error } = await supabase.from("artifacts").update({
      approval_status: status,
      approved_at: status === "approved" ? new Date().toISOString() : null,
    }).eq("id", artifactId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      fetchData();
    }
  };

  const statusBadge = (status: string) => {
    if (status === "approved") return <Badge className="bg-success text-success-foreground">Approved</Badge>;
    if (status === "rejected") return <Badge variant="destructive">Rejected</Badge>;
    return <Badge className="bg-warning text-warning-foreground">Pending</Badge>;
  };

  if (loading) {
    return <AppLayout><div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div></AppLayout>;
  }

  if (!run) {
    return <AppLayout><div className="text-center py-12"><p className="text-muted-foreground">Run not found</p></div></AppLayout>;
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

        <div>
          <h1 className="text-3xl font-display font-bold">Run #{run.id.slice(0, 8)}</h1>
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            <span>{format(new Date(run.started_at), "MMM d, yyyy · h:mm a")}</span>
            {run.cost_tokens && <span>{run.cost_tokens.toLocaleString()} tokens</span>}
            {run.cost_usd && <span>${Number(run.cost_usd).toFixed(4)}</span>}
          </div>
        </div>

        {Object.entries(grouped).map(([type, arts]) => (
          <div key={type}>
            <h2 className="text-lg font-display font-semibold mb-3">{TYPE_LABELS[type] || type}</h2>
            <div className="space-y-3">
              {arts.map((art) => (
                <Card key={art.id}>
                  <CardContent className="pt-5">
                    <div className="flex items-start justify-between mb-3">
                      {statusBadge(art.approval_status)}
                      {art.approval_status === "pending" && (
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="text-success border-success hover:bg-success/10" onClick={() => updateApproval(art.id, "approved")}>
                            <Check className="mr-1 h-3 w-3" />Approve
                          </Button>
                          <Button size="sm" variant="outline" className="text-destructive border-destructive hover:bg-destructive/10" onClick={() => updateApproval(art.id, "rejected")}>
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
    </AppLayout>
  );
}
