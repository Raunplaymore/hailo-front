import { ShotAnalysis } from "../../types/shots";
import { Card } from "../Card";

type MetricsTableProps = {
  analysis?: ShotAnalysis;
};

const rows = (analysis?: ShotAnalysis) => [
  {
    label: "Club path angle",
    value: analysis?.swing_plane?.club_path_angle,
    tooltip: "클럽 패스 각도 (+: 아웃-인, -: 인-아웃)",
  },
  {
    label: "Downswing path curve",
    value: analysis?.swing_plane?.downswing_path_curve,
    tooltip: "다운스윙 경로 곡률(0~0.5, 높을수록 더 굽음)",
  },
  {
    label: "On plane ratio",
    value: analysis?.swing_plane?.on_plane_ratio,
    tooltip: "스윙이 플레인에 올라탄 비율(0~1)",
  },
  {
    label: "Plane deviation std",
    value: analysis?.swing_plane?.plane_deviation_std,
    tooltip: "플레인 편차 표준편차(작을수록 안정)",
  },
  {
    label: "Low point position",
    value: analysis?.low_point?.low_point_position_relative_to_ball,
    tooltip: "로우포인트 위치 (공 이전/이후/직전)",
  },
  {
    label: "Low point depth",
    value: analysis?.low_point?.low_point_depth,
    tooltip: "로우포인트 깊이",
  },
  {
    label: "Attack angle",
    value: analysis?.low_point?.attack_angle_category,
    tooltip: "어택 앵글 범주 (steep/neutral/shallow)",
  },
  {
    label: "Tempo ratio",
    value: analysis?.tempo?.tempo_ratio,
    tooltip: "템포 비율(백스윙:다운스윙)",
  },
  {
    label: "Backswing time (ms)",
    value: analysis?.tempo?.backswing_time_ms,
    tooltip: "백스윙 시간(ms)",
  },
  {
    label: "Downswing time (ms)",
    value: analysis?.tempo?.downswing_time_ms,
    tooltip: "다운스윙 시간(ms)",
  },
  {
    label: "Acceleration rate",
    value: analysis?.tempo?.acceleration_rate,
    tooltip: "다운스윙 가속도 지표",
  },
  {
    label: "Max clubhead speed frame idx",
    value: analysis?.tempo?.max_clubhead_speed_frame_index,
    tooltip: "클럽헤드 최대 속도 프레임 인덱스",
  },
  {
    label: "Vertical launch angle",
    value: analysis?.impact?.vertical_launch_angle,
    tooltip: "수직 런치 각도(도)",
  },
  {
    label: "Horizontal launch direction",
    value: analysis?.impact?.horizontal_launch_direction,
    tooltip: "수평 발사 방향(+: 우측, -: 좌측)",
  },
  {
    label: "Initial velocity",
    value: analysis?.impact?.initial_velocity,
    tooltip: "초기 속도(상대값)",
  },
  {
    label: "Spin bias",
    value: analysis?.impact?.spin_bias,
    tooltip: "스핀 성향(fade/draw)",
  },
  {
    label: "Side curve intensity",
    value: analysis?.impact?.side_curve_intensity,
    tooltip: "사이드 커브 강도",
  },
  {
    label: "Apex height relative",
    value: analysis?.impact?.apex_height_relative,
    tooltip: "상대 최고점",
  },
  {
    label: "Side deviation",
    value: analysis?.impact?.side_deviation,
    tooltip: "좌/우 편차",
  },
  {
    label: "Projected carry distance",
    value: analysis?.impact?.projected_carry_distance,
    tooltip: "예상 캐리 거리",
  },
  {
    label: "Head movement",
    value: analysis?.body_motion?.head_movement
      ? `${analysis.body_motion.head_movement.horizontal}, ${analysis.body_motion.head_movement.vertical}`
      : undefined,
    tooltip: "머리 이동량(가로/세로)",
  },
  {
    label: "Upper body tilt change",
    value: analysis?.body_motion?.upper_body_tilt_change,
    tooltip: "상체 기울기 변화",
  },
  {
    label: "Shoulder angle (address)",
    value: analysis?.body_motion?.shoulder_angle_at_address,
    tooltip: "셋업 시 어깨 각도",
  },
  {
    label: "Shoulder angle (impact)",
    value: analysis?.body_motion?.shoulder_angle_at_impact,
    tooltip: "임팩트 시 어깨 각도",
  },
  {
    label: "Shot type",
    value: analysis?.shot_type,
    tooltip: "샷 구질 분류",
  },
];

export function MetricsTable({ analysis }: MetricsTableProps) {
  if (!analysis) {
    return (
      <Card>
        <p className="text-slate-500 text-sm">분석 데이터가 없습니다.</p>
      </Card>
    );
  }
  
  console.log('MetricsTable analysis:', analysis);

  return (
    <Card>
      <p className="text-sm text-slate-500 mb-2">핵심 지표</p>
      <div className="divide-y divide-slate-200">
        {rows(analysis).map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between py-2 text-sm"
            title={row.tooltip}
          >
            <span className="text-slate-600">{row.label}</span>
            <span className="font-semibold text-slate-900">{row.value ?? "-"}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
