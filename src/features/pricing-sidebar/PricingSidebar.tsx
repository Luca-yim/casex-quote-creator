import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useIntake } from "@/features/intake/IntakeContext";
import { readinessCheck } from "@/lib/quote-validation";

/**
 * Right-hand sidebar. Always renders progress + readiness; pricing detail
 * only when the current role/state permits it.
 */
export function PricingSidebar() {
  const { quote, showPricing } = useIntake();
  const readiness = readinessCheck(quote);
  const percent = Math.round(
    (readiness.completedCount / readiness.totalRequired) * 100,
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Quote readiness</CardTitle>
            <Badge variant={readiness.ready ? "default" : "secondary"}>
              {readiness.ready ? "Ready" : "In progress"}
            </Badge>
          </div>
          <CardDescription>
            {readiness.completedCount} of {readiness.totalRequired} required
            fields complete
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={percent} aria-label="Quote completion" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pricing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Pricing sidebar — content coming in Prompt F</p>
          {showPricing ? (
            <p className="text-foreground">
              Full pricing visible for estimators.
            </p>
          ) : (
            <p>Pricing is hidden until this quote is approved.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
