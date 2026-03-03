import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";

const plans = [
  {
    name: "Starter",
    price: "$19",
    period: "/month",
    features: ["10 pipeline runs/month", "All artifact types", "Email support", "Basic analytics"],
    current: true,
  },
  {
    name: "Pro",
    price: "$49",
    period: "/month",
    features: ["50 pipeline runs/month", "All artifact types", "Priority support", "Advanced analytics", "API access"],
    current: false,
    recommended: true,
  },
];

export default function Billing() {
  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-display font-bold">Billing</h1>
          <p className="text-muted-foreground mt-1">Manage your subscription and usage</p>
        </div>

        {/* Usage */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display">Current Usage</CardTitle>
            <CardDescription>Your usage this billing period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-muted-foreground">Runs Used</p>
                <p className="text-3xl font-bold font-display">3 / 10</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Current Plan</p>
                <p className="text-3xl font-bold font-display">Starter</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Next Billing</p>
                <p className="text-3xl font-bold font-display">Apr 1</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {plans.map((plan) => (
            <Card key={plan.name} className={plan.recommended ? "border-primary shadow-lg" : ""}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="font-display">{plan.name}</CardTitle>
                  {plan.current && <Badge variant="secondary">Current</Badge>}
                  {plan.recommended && <Badge>Recommended</Badge>}
                </div>
                <div className="mt-2">
                  <span className="text-4xl font-bold font-display">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center text-sm">
                      <Check className="mr-2 h-4 w-4 text-success" />{f}
                    </li>
                  ))}
                </ul>
                <Button className="w-full" variant={plan.current ? "outline" : "default"} disabled={plan.current}>
                  {plan.current ? "Current Plan" : "Upgrade"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
