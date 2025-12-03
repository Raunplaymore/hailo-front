import { useState } from "react";
import { ShotAnalysis } from "../../types/shots";
import { Card } from "../Card";
import { Button } from "../Button";

type MetricsTableProps = {
  analysis?: ShotAnalysis;
  onOpenVideo?: () => void;
};

const metricDefs = [
  { key: "club_path_angle", label: "Club path angle", labelKor: "클럽 패스 각도" },
  {
    key: "path_direction",
    label: "Path direction",
    labelKor: "스윙 패스 방향",
  },
  {
    key: "downswing_path_curve",
    label: "Downswing path curve",
    labelKor: "다운스윙 경로 곡률(0~0.5, 높을수록 더 굽음)",
  },
  {
    key: "shaft_forward_lean_at_impact",
    label: "Shaft forward lean",
    labelKor: "임팩트 시 샤프트 전방 기울기(도)",
  },
  {
    key: "shaft_angle_change_rate",
    label: "Shaft angle change rate",
    labelKor: "다운스윙 중 샤프트 각도 변화율(도/프레임)",
  },
  { key: "on_plane_ratio", label: "On plane ratio", labelKor: "스윙이 플레인에 올라탄 비율(0~1)" },
  { key: "plane_deviation_std", label: "Plane deviation std", labelKor: "플레인 편차 표준편차(작을수록 안정)" },
  {
    key: "low_point_position_relative_to_ball",
    label: "Low point position",
    labelKor: "로우포인트 위치 (공 이전/이후/직전)",
  },
  { key: "low_point_depth", label: "Low point depth", labelKor: "로우포인트 깊이" },
  {
    key: "attack_angle_category",
    label: "Attack angle",
    labelKor: "어택 앵글 범주 (steep/neutral/shallow)",
  },
  { key: "vertical_launch_angle", label: "Vertical launch angle", labelKor: "수직 런치 각도(도)" },
  {
    key: "horizontal_launch_direction",
    label: "Horizontal launch direction",
    labelKor: "수평 발사 방향(+: 우측, -: 좌측)",
  },
  { key: "initial_velocity", label: "Initial velocity", labelKor: "초기 속도(상대값)" },
  { key: "spin_bias", label: "Spin bias", labelKor: "스핀 성향(fade/draw)" },
  { key: "side_curve_intensity", label: "Side curve intensity", labelKor: "사이드 커브 강도" },
  { key: "apex_height_relative", label: "Apex height relative", labelKor: "상대 최고점" },
  { key: "side_deviation", label: "Side deviation", labelKor: "좌/우 편차" },
  { key: "projected_carry_distance", label: "Projected carry distance", labelKor: "예상 캐리 거리" },
  {
    key: "head_movement.horizontal",
    label: "Head movement (H)",
    labelKor: "머리 이동량(가로)",
  },
  {
    key: "head_movement.vertical",
    label: "Head movement (V)",
    labelKor: "머리 이동량(세로)",
  },
  { key: "upper_body_tilt_change", label: "Upper body tilt change", labelKor: "상체 기울기 변화" },
  { key: "shoulder_angle_at_address", label: "Shoulder angle (address)", labelKor: "셋업 시 어깨 각도" },
  { key: "shoulder_angle_at_impact", label: "Shoulder angle (impact)", labelKor: "임팩트 시 어깨 각도" },
  { key: "shot_type", label: "Shot type", labelKor: "샷 구질 분류" },
];

const keyMetricsSet = new Set([
  "club_path_angle",
  "path_direction",
  "on_plane_ratio",
  "plane_deviation_std",
  "vertical_launch_angle",
  "horizontal_launch_direction",
  "spin_bias",
  "shot_type",
  "projected_carry_distance",
]);

const extraMetricsSet = new Set([
  "downswing_path_curve",
  "shaft_forward_lean_at_impact",
  "shaft_angle_change_rate",
  "low_point_position_relative_to_ball",
  "low_point_depth",
  "attack_angle_category",
  "head_movement.horizontal",
  "head_movement.vertical",
  "upper_body_tilt_change",
  "shoulder_angle_at_address",
  "shoulder_angle_at_impact",
  "side_curve_intensity",
  "apex_height_relative",
  "side_deviation",
  "initial_velocity",
]);

// 다양한 스키마(swing, swing_plane, ballFlight 등)를 포괄적으로 탐색
const getValue = (analysis: ShotAnalysis & Record<string, any>, key: string) => {
  const candidates: any[] = [
    analysis,
    analysis.swing_plane,
    analysis.swing,
    analysis.ballFlight,
    analysis.impact,
    analysis.low_point,
    analysis.tempo,
    analysis.body_motion,
  ].filter(Boolean);

  const parts = key.split(".");

  for (const root of candidates) {
    let current: any = root;
    let found = true;
    for (const part of parts) {
      if (current == null || !(part in current)) {
        found = false;
        break;
      }
      current = current[part];
    }
    if (found && current !== undefined) return current;
  }

  return undefined;
};

export function MetricsTable({ analysis, onOpenVideo }: MetricsTableProps) {
  const [showMore, setShowMore] = useState(false);

  if (!analysis) {
    return (
      <Card>
        <p className="text-slate-500 text-sm">분석 데이터가 없습니다.</p>
      </Card>
    );
  }

  const keyed = metricDefs.map((def) => ({
    ...def,
    value: getValue(analysis, def.key),
  }));

  const keyMetrics = keyed.filter((k) => keyMetricsSet.has(k.key));
  const extraMetrics = keyed.filter((k) => extraMetricsSet.has(k.key));

  return (
    <Card>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-slate-500">핵심 지표</p>
        {onOpenVideo && (
          <Button
            type="button"
            onClick={onOpenVideo}
            variant="outline"
            className="w-auto px-3 py-1 text-sm"
            fullWidth={false}
          >
            영상 보기
          </Button>
        )}
      </div>
      <div className="divide-y divide-slate-200">
        {keyMetrics.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between py-2 text-sm"
          >
            <div className="flex items-center gap-2 text-slate-600">
              <span>{row.labelKor}</span>
            </div>
            <span className="font-semibold text-slate-900">{row.value ?? "-"}</span>
          </div>
        ))}
      </div>
      {extraMetrics.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            className="text-sm text-blue-600 font-semibold hover:underline"
            onClick={() => setShowMore((prev) => !prev)}
          >
            {showMore ? "접기" : "더보기"}
          </button>
          {showMore && (
            <div className="mt-2 divide-y divide-slate-200">
              {extraMetrics.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <div className="flex items-center gap-2 text-slate-600">
                    <span>{row.labelKor}</span>
                  </div>
                  <span className="font-semibold text-slate-900">{row.value ?? "-"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
