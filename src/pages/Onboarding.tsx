import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const TONE_OPTIONS = ["clear_confident", "educational", "playful", "authoritative"];
const PACING_OPTIONS = ["fast", "balanced", "deep_dive"];
const HOOK_OPTIONS = ["curiosity_with_value", "bold_claim", "question_led", "story_first"];
const LENGTH_OPTIONS = ["short_form", "mid_form", "long_form"];

interface InspirationInput {
  youtubeUrl: string;
  note: string;
  label: string;
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, onboardingCompleted, refreshProfile } = useAuth();
  const { toast } = useToast();

  const [goal, setGoal] = useState("");
  const [tone, setTone] = useState("clear_confident");
  const [pacing, setPacing] = useState("fast");
  const [hookStyle, setHookStyle] = useState("curiosity_with_value");
  const [scriptLengthPreference, setScriptLengthPreference] = useState("short_form");
  const [bannedPhrasesInput, setBannedPhrasesInput] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [inspirations, setInspirations] = useState<InspirationInput[]>([{ youtubeUrl: "", note: "", label: "" }]);

  const [submitting, setSubmitting] = useState(false);
  const [generatedSummary, setGeneratedSummary] = useState<string | null>(null);
  const [editableSummary, setEditableSummary] = useState("");
  const [savingSummary, setSavingSummary] = useState(false);

  useEffect(() => {
    if (onboardingCompleted) {
      navigate("/dashboard", { replace: true });
    }
  }, [onboardingCompleted, navigate]);

  const bannedPhrases = useMemo(
    () => bannedPhrasesInput.split(",").map((item) => item.trim()).filter(Boolean),
    [bannedPhrasesInput],
  );

  const updateInspiration = (index: number, key: keyof InspirationInput, value: string) => {
    setInspirations((prev) => prev.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  };

  const addInspiration = () => {
    setInspirations((prev) => [...prev, { youtubeUrl: "", note: "", label: "" }]);
  };

  const removeInspiration = (index: number) => {
    setInspirations((prev) => prev.filter((_, i) => i !== index));
  };

  const runOnboarding = async () => {
    if (!goal.trim()) {
      toast({ title: "Goal required", description: "Add a channel goal to continue.", variant: "destructive" });
      return;
    }

    setSubmitting(true);

    const { data, error } = await supabase.functions.invoke("complete-onboarding", {
      body: {
        goal: goal.trim(),
        tone,
        pacing,
        hookStyle,
        scriptLengthPreference,
        bannedPhrases,
        inspirations: inspirations
          .map((item) => ({
            youtubeUrl: item.youtubeUrl.trim(),
            note: item.note.trim(),
            label: item.label.trim(),
          }))
          .filter((item) => item.youtubeUrl),
        additionalNotes: additionalNotes.trim(),
      },
    });

    if (error || (data as { error?: string } | null)?.error) {
      toast({
        title: "Onboarding failed",
        description: error?.message || (data as { error?: string } | null)?.error || "Unknown error",
        variant: "destructive",
      });
      setSubmitting(false);
      return;
    }

    const summary = (data as { channelSummaryPrompt?: string }).channelSummaryPrompt || "";
    setGeneratedSummary(summary);
    setEditableSummary(summary);
    setSubmitting(false);
  };

  const confirmSummary = async () => {
    if (!user || !editableSummary.trim()) return;
    setSavingSummary(true);

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("profiles")
      .update({
        channel_summary_prompt: editableSummary.trim(),
        onboarding_completed_at: now,
        updated_at: now,
      })
      .eq("user_id", user.id);

    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      setSavingSummary(false);
      return;
    }

    await refreshProfile();
    toast({ title: "Onboarding complete", description: "Your channel style baseline is ready." });
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-display">Channel Onboarding</CardTitle>
            <CardDescription>Set your channel style so all future runs match your direction.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Channel goal + niche</Label>
              <Textarea
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
                placeholder="Example: I help startup founders explain AI tools in under 60 seconds with practical examples."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tone</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TONE_OPTIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Pacing</Label>
                <Select value={pacing} onValueChange={setPacing}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PACING_OPTIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Hook style</Label>
                <Select value={hookStyle} onValueChange={setHookStyle}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{HOOK_OPTIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Script length preference</Label>
                <Select value={scriptLengthPreference} onValueChange={setScriptLengthPreference}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LENGTH_OPTIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Banned phrases (comma separated)</Label>
              <Input
                value={bannedPhrasesInput}
                onChange={(event) => setBannedPhrasesInput(event.target.value)}
                placeholder="smash that like, guaranteed viral"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>YouTube inspirations</Label>
                <Button variant="outline" size="sm" onClick={addInspiration}>Add</Button>
              </div>
              {inspirations.map((item, index) => (
                <div key={index} className="rounded-md border p-3 space-y-2">
                  <Input
                    value={item.youtubeUrl}
                    onChange={(event) => updateInspiration(index, "youtubeUrl", event.target.value)}
                    placeholder="https://www.youtube.com/@creator"
                  />
                  <Input
                    value={item.label}
                    onChange={(event) => updateInspiration(index, "label", event.target.value)}
                    placeholder="Creator / channel label (optional)"
                  />
                  <Input
                    value={item.note}
                    onChange={(event) => updateInspiration(index, "note", event.target.value)}
                    placeholder="What should we emulate?"
                  />
                  {inspirations.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => removeInspiration(index)}>
                      Remove
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label>Additional notes</Label>
              <Textarea value={additionalNotes} onChange={(event) => setAdditionalNotes(event.target.value)} placeholder="Anything else your agents should know..." />
            </div>

            {!generatedSummary ? (
              <Button onClick={runOnboarding} disabled={submitting} className="w-full">
                {submitting ? "Generating style baseline..." : "Generate Channel Baseline"}
              </Button>
            ) : (
              <div className="space-y-3">
                <Label>Review/edit generated channel summary prompt</Label>
                <Textarea value={editableSummary} onChange={(event) => setEditableSummary(event.target.value)} className="min-h-[220px]" />
                <Button onClick={confirmSummary} disabled={savingSummary} className="w-full">
                  {savingSummary ? "Saving..." : "Confirm and Continue"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
