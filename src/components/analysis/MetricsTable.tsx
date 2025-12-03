import { ShotAnalysis } from "../../types/shots";
import { Card } from "../Card";

type MetricsTableProps = {
  analysis?: ShotAnalysis;
};

const rows = (analysis?: ShotAnalysis) => [
  { label: "Club path angle", value: analysis?.swing_plane?.club_path_angle },
  { label: "Downswing path curve", value: analysis?.swing_plane?.downswing_path_curve },
  { label: "On plane ratio", value: analysis?.swing_plane?.on_plane_ratio },
  { label: "Plane deviation std", value: analysis?.swing_plane?.plane_deviation_std },
  { label: "Low point position", value: analysis?.low_point?.low_point_position_relative_to_ball },
  { label: "Attack angle", value: analysis?.low_point?.attack_angle_category },
  { label: "Tempo ratio", value: analysis?.tempo?.tempo_ratio },
  { label: "Backswing time (ms)", value: analysis?.tempo?.backswing_time_ms },
  { label: "Downswing time (ms)", value: analysis?.tempo?.downswing_time_ms },
  { label: "Vertical launch angle", value: analysis?.impact?.vertical_launch_angle },
  { label: "Horizontal launch direction", value: analysis?.impact?.horizontal_launch_direction },
  { label: "Initial velocity", value: analysis?.impact?.initial_velocity },
  { label: "Spin bias", value: analysis?.impact?.spin_bias },
  { label: "Side curve intensity", value: analysis?.impact?.side_curve_intensity },
  { label: "Apex height relative", value: analysis?.impact?.apex_height_relative },
  { label: "Projected carry distance", value: analysis?.impact?.projected_carry_distance },
  { label: "Shot type", value: analysis?.shot_type },
];

export function MetricsTable({ analysis }: MetricsTableProps) {
  if (!analysis) {
    return (
      <Card>
        <p className="text-slate-500 text-sm">분석 데이터가 없습니다.</p>
      </Card>
    );
  }

  return (
    <Card>
      <p className="text-sm text-slate-500 mb-2">핵심 지표</p>
      <div className="divide-y divide-slate-200">
        {rows(analysis).map((row) => (
          <div key={row.label} className="flex items-center justify-between py-2 text-sm">
            <span className="text-slate-600">{row.label}</span>
            <span className="font-semibold text-slate-900">{row.value ?? "-"}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
