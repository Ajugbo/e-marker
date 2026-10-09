import type { NavigatorScreenParams } from '@react-navigation/native';

export type ScriptMetadata = {
  institution: string;
  class: string;
  term: string;
  studentName: string;
  examNumber: string;
  course: string;
};

export type GradeBreakdown = Record<string, unknown> | {
  criterion: string;
  score: number;
  maxScore?: number;
  feedback?: string;
}[];

export type ProcessingResult = {
  metadata: ScriptMetadata;
  score: number;
  maxScore: number;
  feedback: string;
  breakdown: GradeBreakdown;
};

export type MainTabParamList = {
  Scan: { resetToken?: number } | undefined;
  Upload: undefined;
  Results: undefined;
  Account: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  Result: { result: ProcessingResult; rubricId: string };
};
