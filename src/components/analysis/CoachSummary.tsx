import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type CoachSummaryProps = {
  comments?: string[];
};

export function CoachSummary({ comments }: CoachSummaryProps) {
  const list = comments ?? [];
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">코치 코멘트</CardTitle>
        <CardDescription>분석 결과 기반 코칭 메모</CardDescription>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">코멘트가 없습니다.</p>
        ) : (
          <ul className="list-disc list-inside space-y-1 text-sm text-foreground">
            {list.map((c, idx) => (
              <li key={idx}>{c}</li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
