import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
   ArrowRight,
   Bot,
   BrainCircuit,
   Activity,
   CheckCircle2,
   Workflow,
   Sparkles,
   BarChart,
   LayoutTemplate,
   TerminalSquare,
   Play
} from "lucide-react";

export default function Index() {
   const { user, loading } = useAuth();

   if (loading) {
      return (
         <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
         </div>
      );
   }

   if (user) {
      return <Navigate to="/dashboard" replace />;
   }

   return (
      <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-blue-100 overflow-x-hidden">
         {/* Navigation */}
         <nav className="fixed top-0 left-0 right-0 z-50 bg-[#F8FAFC]/80 backdrop-blur-md border-b border-transparent transition-all duration-300">
            <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
               <div className="flex items-center gap-2">
                  {/* Replace with your actual logo if needed */}
                  <div className="font-display font-bold text-xl tracking-tight text-slate-900 flex items-center gap-2">
                     <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-white" />
                     </div>
                     ContentPilot
                  </div>
               </div>
               <div className="flex items-center gap-4">
                  <Link to="/auth" className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors hidden sm:block">
                     Log in
                  </Link>
                  <Button asChild className="rounded-full shadow-sm bg-slate-900 hover:bg-slate-800 text-white border-0">
                     <Link to="/auth">Get Started</Link>
                  </Button>
               </div>
            </div>
         </nav>

         <main className="pt-32 pb-24">
            {/* Hero Section */}
            <section className="relative max-w-5xl mx-auto px-6 text-center space-y-8 mb-16">
               {/* Subtle glowing ambient background similar to cshift.io */}
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-gradient-to-r from-blue-400/20 to-purple-400/20 blur-[100px] rounded-full pointer-events-none -z-10" />

               <div className="flex justify-center">
                  <Badge variant="outline" className="rounded-full px-4 py-1.5 bg-white border-slate-200 shadow-sm text-slate-600 mb-2 font-medium">
                     <span className="flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                           <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                           <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                        </span>
                        ContentPilot 1.0 is now live
                     </span>
                  </Badge>
               </div>

               <h1 className="text-5xl md:text-7xl font-display font-bold tracking-tight text-slate-900 leading-[1.1]">
                  Content operations.<br />Now agent-powered.
               </h1>

               <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto font-medium">
                  Deploy a 4+1 multi-agent orchestration pipeline. Transform single video ideas into coordinated, reviewed, and reusable content packages.
               </p>

               <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                  <Button asChild size="lg" className="rounded-full h-12 px-8 text-base shadow-lg shadow-blue-500/20 bg-slate-900 hover:bg-slate-800 text-white w-full sm:w-auto">
                     <Link to="/auth">Get started for free</Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="rounded-full h-12 px-8 text-base bg-white border-slate-200 hover:bg-slate-50 w-full sm:w-auto text-slate-900 font-semibold shadow-sm">
                     <Link to="/auth" className="flex items-center gap-2">
                        <Play className="w-4 h-4" /> Book a demo
                     </Link>
                  </Button>
               </div>

               <div className="pt-12 flex flex-wrap justify-center items-center gap-8 opacity-60 grayscale">
                  {/* Logo cloud placeholders */}
                  <div className="font-display font-bold text-xl text-slate-800">TRUSTED BY</div>
                  <div className="h-6 w-px bg-slate-300 hidden sm:block"></div>
                  <div className="font-display font-bold text-lg text-slate-500">INNOVATIVE</div>
                  <div className="font-display font-bold text-lg text-slate-500">CREATORS</div>
                  <div className="font-display font-bold text-lg text-slate-500">AND</div>
                  <div className="font-display font-bold text-lg text-slate-500">TEAMS</div>
               </div>
            </section>

            {/* Mockup / Dashboard UI Showcase mimicking cshift */}
            <section className="max-w-[1200px] mx-auto px-6 mb-32 relative">
               <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#F8FAFC] to-transparent z-10 pointer-events-none" />
               <div className="bg-white/60 backdrop-blur-xl border border-white/40 ring-1 ring-slate-900/5 rounded-2xl shadow-2xl overflow-hidden flex flex-col pt-4 px-4 pb-0 relative">
                  {/* Fake Mac OS Window Chrome */}
                  <div className="flex items-center gap-2 mb-4 px-2">
                     <div className="w-3 h-3 rounded-full bg-red-400"></div>
                     <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                     <div className="w-3 h-3 rounded-full bg-green-400"></div>
                     <div className="mx-auto text-xs font-semibold text-slate-400 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> ContentPilot Workspace
                     </div>
                  </div>

                  <div className="bg-white rounded-t-xl border border-slate-200 border-b-0 shadow-sm flex flex-col md:flex-row h-[500px] overflow-hidden">
                     {/* Left sidebar mock */}
                     <div className="w-64 border-r border-slate-100 bg-slate-50/50 p-4 space-y-6 hidden md:block">
                        <div className="space-y-1">
                           <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-2">Workspace</div>
                           <div className="h-9 rounded-md bg-white border border-slate-200 shadow-sm w-full flex items-center px-3 gap-2 text-sm font-medium text-slate-700">
                              <LayoutTemplate className="w-4 h-4 text-blue-500" />
                              Active Runs
                           </div>
                           <div className="h-9 rounded-md w-full flex items-center px-3 gap-2 text-sm font-medium text-slate-500 hover:bg-slate-100/50 transition-colors">
                              <TerminalSquare className="w-4 h-4" />
                              Memory Matrix
                           </div>
                        </div>
                     </div>

                     {/* Main content mock */}
                     <div className="flex-1 p-8 bg-[#F8FAFC]/50 flex flex-col">
                        <div className="flex items-center justify-between mb-8">
                           <div>
                              <h3 className="text-2xl font-bold font-display text-slate-900 flex items-center gap-2">
                                 <Workflow className="w-6 h-6 text-blue-500" /> Orchestrator Pipeline
                              </h3>
                              <p className="text-sm text-slate-500 mt-1">Run ID: #4092 • Generating Artifacts • Video: "The AI Revolution"</p>
                           </div>
                           <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100 font-semibold">
                              <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse" /> Active
                           </Badge>
                        </div>

                        {/* Pipeline columns - mimicking the cshift 3-column layout */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1">
                           {/* Col 1 */}
                           <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                                 <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                                       <CheckCircle2 className="w-4 h-4 text-blue-600" />
                                    </div>
                                    <span className="font-semibold text-slate-800">Hook Agent</span>
                                 </div>
                                 <Badge variant="outline" className="text-slate-500">Done</Badge>
                              </div>
                              <div className="space-y-3">
                                 <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                                    <p className="text-sm font-medium text-slate-700">Hook V1 (High Energy)</p>
                                    <div className="mt-2 h-2 w-3/4 bg-slate-200 rounded" />
                                    <div className="mt-2 h-2 w-1/2 bg-slate-200 rounded" />
                                 </div>
                                 <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 opacity-60">
                                    <p className="text-sm font-medium text-slate-700">Hook V2 (Story-focused)</p>
                                    <div className="mt-2 h-2 w-full bg-slate-200 rounded" />
                                 </div>
                              </div>
                           </div>

                           {/* Col 2 */}
                           <div className="bg-white border-2 border-purple-200 ring-4 ring-purple-50 rounded-xl p-5 shadow-md relative overflow-hidden">
                              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 to-blue-400" />
                              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                                 <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center">
                                       <Activity className="w-4 h-4 text-purple-600 animate-pulse" />
                                    </div>
                                    <span className="font-semibold text-slate-800">Script Agent</span>
                                 </div>
                                 <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 border-none">Generating...</Badge>
                              </div>
                              <div className="space-y-3">
                                 <div className="h-4 w-4/5 bg-slate-100 rounded animate-pulse mb-3" />
                                 <div className="h-3 w-full bg-slate-100 rounded animate-pulse" />
                                 <div className="h-3 w-full bg-slate-100 rounded animate-pulse" />
                                 <div className="h-3 w-3/4 bg-slate-100 rounded animate-pulse" />
                                 <div className="h-3 w-5/6 bg-slate-100 rounded animate-pulse" />
                                 <div className="h-3 w-2/3 bg-slate-100 rounded animate-pulse" />
                              </div>
                           </div>

                           {/* Col 3 */}
                           <div className="bg-slate-50/50 border border-slate-200 border-dashed rounded-xl p-5 shadow-sm opacity-70">
                              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                                 <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                                       <BarChart className="w-4 h-4 text-slate-400" />
                                    </div>
                                    <span className="font-semibold text-slate-600">Title Agent</span>
                                 </div>
                                 <Badge variant="outline" className="text-slate-400 border-slate-200">Pending</Badge>
                              </div>
                              <div className="flex flex-col items-center justify-center h-40 text-center">
                                 <Bot className="w-8 h-8 text-slate-300 mb-2" />
                                 <p className="text-sm font-medium text-slate-400">Waiting for Script completion</p>
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            </section>

            {/* Feature Grid similar to cshift card layout */}
            <section className="max-w-7xl mx-auto px-6 py-24 bg-white border-y border-slate-200">
               <div className="text-center mb-16 max-w-2xl mx-auto">
                  <h2 className="text-xs font-bold tracking-widest text-blue-600 uppercase mb-3">Modular Intelligence</h2>
                  <h3 className="text-3xl md:text-5xl font-display font-bold text-slate-900 leading-tight">
                     Four specialized agents.<br />One seamless workflow.
                  </h3>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                     { title: "Hook Agent", desc: "Generates high-retention vertical hooks optimized for the first 3 seconds.", icon: <Sparkles className="w-5 h-5 text-blue-600" />, color: "bg-blue-50 border-blue-100" },
                     { title: "Script Agent", desc: "Expands approved hooks into full narrative scripts with pacing markers.", icon: <Workflow className="w-5 h-5 text-purple-600" />, color: "bg-purple-50 border-purple-100" },
                     { title: "Title Agent", desc: "Produces data-backed titles and thumbnail concepts optimized for CTR.", icon: <BarChart className="w-5 h-5 text-emerald-600" />, color: "bg-emerald-50 border-emerald-100" },
                     { title: "Strategy Agent", desc: "Provides high-level packaging and community engagement blueprints.", icon: <BrainCircuit className="w-5 h-5 text-orange-600" />, color: "bg-orange-50 border-orange-100" }
                  ].map((feature, i) => (
                     <Card key={i} className="p-8 border-slate-200 shadow-sm bg-white hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 border ${feature.color} group-hover:scale-110 transition-transform`}>
                           {feature.icon}
                        </div>
                        <h4 className="text-xl font-bold font-display text-slate-900 mb-3">{feature.title}</h4>
                        <p className="text-slate-600 leading-relaxed font-medium">{feature.desc}</p>
                     </Card>
                  ))}
               </div>
            </section>

            {/* Dark Memory Matrix section like cshift's dark feature block */}
            <section className="max-w-[1200px] mx-auto px-6 py-24">
               <div className="bg-slate-900 rounded-[2.5rem] p-8 md:p-16 relative overflow-hidden shadow-2xl">
                  {/* Abstract dark mode glow */}
                  <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/20 blur-[130px] rounded-full pointer-events-none" />
                  <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-600/20 blur-[130px] rounded-full pointer-events-none" />

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative z-10">
                     <div className="space-y-8">
                        <Badge variant="outline" className="text-blue-400 border-blue-500/30 bg-blue-500/10 font-mono">
                           <TerminalSquare className="w-3 h-3 mr-2 inline" /> CORE_SYSTEM_MEMORY
                        </Badge>
                        <h2 className="text-4xl md:text-5xl font-display font-bold text-white leading-tight">
                           The operation stays the same.<br />
                           <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">The execution gets smarter.</span>
                        </h2>
                        <p className="text-lg text-slate-400 font-medium leading-relaxed">
                           Your feedback is deterministically weighted, stored, and injected into every future run. ContentPilot learns continuously from rejections, approvals, and external YouTube performance data.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 pt-4">
                           <Button className="rounded-full h-12 px-8 bg-blue-600 hover:bg-blue-500 text-white border-0 shadow-lg shadow-blue-900/50">
                              Explore Memory System
                           </Button>
                        </div>
                     </div>

                     {/* Code/Terminal style mock */}
                     <div className="bg-[#0f1117] border border-slate-800 rounded-2xl p-6 font-mono text-sm shadow-2xl text-slate-300">
                        <div className="flex items-center gap-2 mb-6 border-b border-slate-800 pb-4">
                           <div className="w-3 h-3 rounded-full bg-slate-700"></div>
                           <div className="w-3 h-3 rounded-full bg-slate-700"></div>
                           <div className="w-3 h-3 rounded-full bg-slate-700"></div>
                           <span className="ml-2 text-slate-500 text-xs">memory-compiler.ts</span>
                        </div>
                        <div className="space-y-4">
                           <div className="flex gap-4">
                              <span className="text-slate-600">1</span>
                              <span className="text-green-400">{"// COMPILING AGENT CONTEXT"}</span>
                           </div>
                           <div className="flex gap-4">
                              <span className="text-slate-600">2</span>
                              <span><span className="text-purple-400">const</span> context <span className="text-purple-400">=</span> <span className="text-blue-400">await</span> brain.compile({'{'}</span>
                           </div>
                           <div className="flex gap-4 pl-4">
                              <span className="text-slate-600">3</span>
                              <span>target: <span className="text-yellow-300">"ScriptAgent"</span>,</span>
                           </div>
                           <div className="flex gap-4 pl-4">
                              <span className="text-slate-600">4</span>
                              <span>video_id: currentRun.id,</span>
                           </div>
                           <div className="flex gap-4 pl-4">
                              <span className="text-slate-600">5</span>
                              <span>include_youtube_insights: <span className="text-blue-400">true</span></span>
                           </div>
                           <div className="flex gap-4">
                              <span className="text-slate-600">6</span>
                              <span>{'}'});</span>
                           </div>
                           <div className="flex gap-4 pt-4 border-t border-slate-800/50">
                              <span className="text-slate-600">7</span>
                              <span className="text-slate-500">{"→ [INFO] 3 negative feedback rules applied"}</span>
                           </div>
                           <div className="flex gap-4">
                              <span className="text-slate-600">8</span>
                              <span className="text-slate-500">{"→ [INFO] 1 top-performing hook template injected"}</span>
                           </div>
                           <div className="flex gap-4">
                              <span className="text-slate-600">9</span>
                              <span className="text-blue-400">{"→ [EXEC] GENERATING V2..."}</span>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            </section>

            {/* Final CTA */}
            <section className="max-w-4xl mx-auto px-6 py-24 text-center space-y-8">
               <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-sm">
                  <Sparkles className="w-8 h-8 text-blue-600" />
               </div>
               <h2 className="text-4xl md:text-6xl font-display font-bold text-slate-900 tracking-tight">
                  Ready to automate your<br />content pipeline?
               </h2>
               <p className="text-xl text-slate-600 max-w-2xl mx-auto font-medium">
                  Stop juggling prompts. Start managing outcomes. Join innovative creators using ContentPilot.
               </p>
               <div className="flex items-center justify-center gap-4 pt-8">
                  <Button asChild size="lg" className="rounded-full h-14 px-10 text-lg bg-slate-900 shadow-xl shadow-slate-900/20 hover:bg-slate-800 text-white">
                     <Link to="/auth">Start your free trial</Link>
                  </Button>
               </div>
            </section>
         </main>

         {/* Footer */}
         <footer className="border-t border-slate-200 bg-white">
            <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col md:flex-row justify-between items-center gap-6">
               <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
                     <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-display font-bold text-lg text-slate-900">ContentPilot</span>
               </div>

               <div className="flex gap-8 text-sm font-medium text-slate-500">
                  <a href="#" className="hover:text-slate-900 transition-colors">Documentation</a>
                  <a href="#" className="hover:text-slate-900 transition-colors">Pricing</a>
                  <a href="#" className="hover:text-slate-900 transition-colors">Twitter</a>
               </div>

               <p className="text-sm text-slate-500 font-medium">
                  © {new Date().getFullYear()} ContentPilot Inc. All rights reserved.
               </p>
            </div>
         </footer>
      </div>
   );
}
