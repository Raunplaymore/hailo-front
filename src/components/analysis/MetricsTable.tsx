import { useState } from "react";
import { ShotAnalysis } from "../../types/shots";
import { Card } from "../Card";

type MetricsTableProps = {
  analysis?: ShotAnalysis;
};

const metricDefs = [
  { key: "club_path_angle", label: "Club path angle", tooltip: "클럽 패스 각도 (+: 아웃-인, -: 인-아웃)" },
  {
    key: "path_direction",
    label: "Path direction",
    tooltip: "스윙 패스 방향 (in-to-in / out-to-in / in-to-out)",
  },
  {
    key: "downswing_path_curve",
    label: "Downswing path curve",
    tooltip: "다운스윙 경로 곡률(0~0.5, 높을수록 더 굽음)",
  },
  {
    key: "shaft_forward_lean_at_impact",
    label: "Shaft forward lean",
    tooltip: "임팩트 시 샤프트 전방 기울기(도)",
  },
  {
    key: "shaft_angle_change_rate",
    label: "Shaft angle change rate",
    tooltip: "다운스윙 중 샤프트 각도 변화율(도/프레임)",
  },
  { key: "on_plane_ratio", label: "On plane ratio", tooltip: "스윙이 플레인에 올라탄 비율(0~1)" },
  { key: "plane_deviation_std", label: "Plane deviation std", tooltip: "플레인 편차 표준편차(작을수록 안정)" },
  {
    key: "low_point_position_relative_to_ball",
    label: "Low point position",
    tooltip: "로우포인트 위치 (공 이전/이후/직전)",
  },
  { key: "low_point_depth", label: "Low point depth", tooltip: "로우포인트 깊이" },
  {
    key: "attack_angle_category",
    label: "Attack angle",
    tooltip: "어택 앵글 범주 (steep/neutral/shallow)",
  },
  { key: "tempo_ratio", label: "Tempo ratio", tooltip: "템포 비율(백스윙:다운스윙)" },
  { key: "backswing_time_ms", label: "Backswing time (ms)", tooltip: "백스윙 시간(ms)" },
  { key: "downswing_time_ms", label: "Downswing time (ms)", tooltip: "다운스윙 시간(ms)" },
  { key: "acceleration_rate", label: "Acceleration rate", tooltip: "다운스윙 가속도 지표" },
  {
    key: "max_clubhead_speed_frame_index",
    label: "Max clubhead speed frame idx",
    tooltip: "클럽헤드 최대 속도 프레임 인덱스",
  },
  { key: "vertical_launch_angle", label: "Vertical launch angle", tooltip: "수직 런치 각도(도)" },
  {
    key: "horizontal_launch_direction",
    label: "Horizontal launch direction",
    tooltip: "수평 발사 방향(+: 우측, -: 좌측)",
  },
  { key: "initial_velocity", label: "Initial velocity", tooltip: "초기 속도(상대값)" },
  { key: "spin_bias", label: "Spin bias", tooltip: "스핀 성향(fade/draw)" },
  { key: "side_curve_intensity", label: "Side curve intensity", tooltip: "사이드 커브 강도" },
  { key: "apex_height_relative", label: "Apex height relative", tooltip: "상대 최고점" },
  { key: "side_deviation", label: "Side deviation", tooltip: "좌/우 편차" },
  { key: "projected_carry_distance", label: "Projected carry distance", tooltip: "예상 캐리 거리" },
  {
    key: "head_movement.horizontal",
    label: "Head movement (H)",
    tooltip: "머리 이동량(가로)",
  },
  {
    key: "head_movement.vertical",
    label: "Head movement (V)",
    tooltip: "머리 이동량(세로)",
  },
  { key: "upper_body_tilt_change", label: "Upper body tilt change", tooltip: "상체 기울기 변화" },
  { key: "shoulder_angle_at_address", label: "Shoulder angle (address)", tooltip: "셋업 시 어깨 각도" },
  { key: "shoulder_angle_at_impact", label: "Shoulder angle (impact)", tooltip: "임팩트 시 어깨 각도" },
  { key: "shot_type", label: "Shot type", tooltip: "샷 구질 분류" },
];

const keyMetricsSet = new Set([
  "club_path_angle",
  "path_direction",
  "on_plane_ratio",
  "plane_deviation_std",
  "backswing_time_ms",
  "downswing_time_ms",
  "tempo_ratio",
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
  "acceleration_rate",
  "max_clubhead_speed_frame_index",
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

const getValue = (analysis: ShotAnalysis, key: string) => {
  const parts = key.split(".");
  let current: any = analysis;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
};

export function MetricsTable({ analysis }: MetricsTableProps) {
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
      <p className="text-sm text-slate-500 mb-2">핵심 지표</p>
      <div className="divide-y divide-slate-200">
        {keyMetrics.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between py-2 text-sm"
          >
            <div className="flex items-center gap-2 text-slate-600">
              <span>{row.label}</span>
              {row.tooltip && (
                <div className="relative group">
                  <button
                    type="button"
                    className="w-4 h-4 rounded-full border border-slate-400 text-[10px] leading-3 text-slate-600 flex items-center justify-center hover:bg-slate-100"
                    aria-label={row.tooltip}
                  >
                    i
                  </button>
                  <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 hidden group-hover:block z-10 whitespace-normal break-words rounded bg-slate-800 text-white text-xs px-3 py-2 shadow-lg w-max max-w-[320px] text-left leading-relaxed">
                    {row.tooltip}
                  </div>
                </div>
              )}
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
                    <span>{row.label}</span>
                    {row.tooltip && (
                      <div className="relative group">
                        <button
                          type="button"
                          className="w-4 h-4 rounded-full border border-slate-400 text-[10px] leading-3 text-slate-600 flex items-center justify-center hover:bg-slate-100"
                          aria-label={row.tooltip}
                        >
                          i
                        </button>
                        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 hidden group-hover:block z-10 whitespace-normal break-words rounded bg-slate-800 text-white text-xs px-3 py-2 shadow-lg w-max max-w-[320px] text-left leading-relaxed">
                          {row.tooltip}
                        </div>
                      </div>
                    )}
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
