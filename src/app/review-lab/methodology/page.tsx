import Link from "next/link";
import { REVIEW_LAB_METHODOLOGY } from "@/lib/review-lab/methodology";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ReviewLabMethodologyPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6 lg:p-8">
      <div>
        <Badge className="mb-3">{REVIEW_LAB_METHODOLOGY.version}</Badge>
        <h1 className="text-3xl font-black uppercase leading-none md:text-5xl">Review Lab Methodology</h1>
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
          How FitCoach AI turns movement sessions into explainable evidence while staying honest about confidence and limitations.
        </p>
      </div>

      <Card className="border-primary/25 bg-primary/5">
        <CardHeader>
          <CardTitle>Claim Boundary</CardTitle>
          <CardDescription>{REVIEW_LAB_METHODOLOGY.claimBoundary}</CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {REVIEW_LAB_METHODOLOGY.modules.map((module) => (
          <Card key={module.id}>
            <CardHeader>
              <CardTitle>{module.name}</CardTitle>
              <CardDescription>{module.id.replace(/_/g, " ")}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-2 text-sm font-semibold">Measured signals</p>
              <div className="flex flex-wrap gap-2">
                {module.measuredSignals.map((signal) => <Badge key={signal} variant="secondary">{signal}</Badge>)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {[
        ["Scoring Policy", REVIEW_LAB_METHODOLOGY.scoringPolicy],
        ["Confidence Policy", REVIEW_LAB_METHODOLOGY.confidencePolicy],
        ["Limitations", REVIEW_LAB_METHODOLOGY.limitations],
      ].map(([title, items]) => (
        <Card key={title as string}>
          <CardHeader>
            <CardTitle>{title as string}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {(items as string[]).map((item) => <li key={item}>- {item}</li>)}
            </ul>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle>References</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {REVIEW_LAB_METHODOLOGY.references.map((reference) => (
            <a key={reference.url} href={reference.url} target="_blank" rel="noreferrer" className="block text-sm text-primary">
              {reference.label}
            </a>
          ))}
        </CardContent>
      </Card>

      <Link href="/review-lab"><Button>Back to Review Lab</Button></Link>
    </div>
  );
}
