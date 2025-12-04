export type SourceType = "upload" | "camera";

export type ShotType =
  | "straight"
  | "fade"
  | "draw"
  | "pull"
  | "push"
  | "pull-fade"
  | "push-fade"
  | "unknown";

export type SwingPlaneMetrics = {
  club_path_angle: number;
  downswing_path_curve: number;
  shaft_forward_lean_at_impact: number;
  shaft_angle_change_rate: number;
  on_plane_ratio: number;
  plane_deviation_std: number;
};

export type LowPointMetrics = {
  low_point_position_relative_to_ball: "before" | "at" | "after";
  low_point_depth: number;
  attack_angle_category: "steep" | "neutral" | "shallow";
};

export type TempoMetrics = {
  backswing_time_ms: number;
  downswing_time_ms: number;
  tempo_ratio: string;
  acceleration_rate: number;
  max_clubhead_speed_frame_index: number;
};

export type ImpactMetrics = {
  vertical_launch_angle: number;
  horizontal_launch_direction: number;
  initial_velocity: number;
  spin_bias: "fade" | "draw" | "neutral";
  side_curve_intensity: "low" | "mid" | "high";
  apex_height_relative: number;
  side_deviation: number;
  projected_carry_distance: number;
};

export type BodyMetrics = {
  head_movement: { horizontal: number; vertical: number };
  upper_body_tilt_change: number;
  shoulder_angle_at_address: number;
  shoulder_angle_at_impact: number;
};

export type ShotAnalysis = {
  swing_plane: SwingPlaneMetrics;
  low_point: LowPointMetrics;
  tempo: TempoMetrics;
  impact: ImpactMetrics;
  shot_type: ShotType;
  body_motion: BodyMetrics;
  coach_summary: string[];
};

export type Shot = {
  shot_type: string;
  id: string;
  createdAt: string;
  club?: string;
  sourceType: SourceType;
  filename: string;
  videoUrl: string;
  thumbnailUrl?: string;
  analysis?: ShotAnalysis;
};
