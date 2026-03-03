import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Video, Zap, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface VideoRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [runCounts, setRunCounts] = useState<Record<string, number>>({});

  const fetchVideos = async () => {
    const { data } = await supabase.from("videos").select("*").order("created_at", { ascending: false });
    setVideos(data || []);

    // Fetch run counts for each video
    if (data && data.length > 0) {
      const { data: runs } = await supabase.from("runs").select("video_id");
      const counts: Record<string, number> = {};
      (runs || []).forEach((r: any) => {
        counts[r.video_id] = (counts[r.video_id] || 0) + 1;
      });
      setRunCounts(counts);
    }
    setLoading(false);
  };

  useEffect(() => { fetchVideos(); }, []);

  const createVideo = async () => {
    if (!newTitle.trim() || !user) return;
    const { error } = await supabase.from("videos").insert({ title: newTitle.trim(), description: newDesc.trim() || null, user_id: user.id });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setNewTitle("");
      setNewDesc("");
      setDialogOpen(false);
      fetchVideos();
    }
  };

  const totalRuns = Object.values(runCounts).reduce((a, b) => a + b, 0);

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Your content projects at a glance</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />New Video</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Video Project</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input placeholder="e.g. I tried to learn guitar in 24 hours" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Idea / Description</Label>
                  <Textarea placeholder="Describe your video concept..." value={newDesc} onChange={e => setNewDesc(e.target.value)} />
                </div>
                <Button onClick={createVideo} className="w-full">Create Project</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
                <Video className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold font-display">{videos.length}</p>
                <p className="text-sm text-muted-foreground">Total Videos</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
                <Zap className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold font-display">{totalRuns}</p>
                <p className="text-sm text-muted-foreground">Total Runs</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold font-display">∞</p>
                <p className="text-sm text-muted-foreground">Runs Remaining</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Video List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : videos.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Video className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-display font-semibold mb-2">No videos yet</h3>
              <p className="text-muted-foreground mb-4">Create your first content project to get started</p>
              <Button onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />New Video</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.map((video) => (
              <Link key={video.id} to={`/video/${video.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg font-display leading-tight">{video.title}</CardTitle>
                      <Badge variant={video.status === "draft" ? "secondary" : "default"} className="ml-2 shrink-0">
                        {video.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {video.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{video.description}</p>
                    )}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{runCounts[video.id] || 0} runs</span>
                      <span>{format(new Date(video.created_at), "MMM d, yyyy")}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
