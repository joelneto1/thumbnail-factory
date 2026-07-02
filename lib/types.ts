export type EngineId = "glabs" | "gemini" | "gpt-image-2";

export type GenerationMode = "from-scratch" | "remodel";

export type SwapAction = "replace" | "keep" | "remove";

export interface TextSwap {
  original: string;
  action: SwapAction;
  replacement?: string;
  position?: string;
  style?: string;
}

export interface ObjectSwap {
  original: string;
  action: SwapAction;
  replacement?: string;
  position?: string;
}

export interface GenerationSwaps {
  textSwaps: TextSwap[];
  objectSwaps: ObjectSwap[];
}

export type GenerationStatus =
  | "pending"
  | "partial"
  | "completed"
  | "failed";

export type VariantStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed";

export interface Persona {
  id: string;
  name: string;
  channel: string | null;
  facePath: string;
  stylePaths: string[];
  notes: string | null;
  createdAt: number;
  updatedAt: number;
  lastUsedAt: number | null;
}

export interface Generation {
  id: string;
  personaId: string | null;
  title: string | null;
  headlineTop: string | null;
  headlineMainWhite: string | null;
  headlineMainYellow: string | null;
  concept: string;
  competitorUrl: string | null;
  competitorPath: string | null;
  promptFinal: string;
  engineRequested: EngineId;
  variantCount: number;
  status: GenerationStatus;
  mode: GenerationMode;
  swaps: GenerationSwaps | null;
  createdAt: number;
  completedAt: number | null;
}

export interface AnalysisResult {
  detectedText: Array<{
    text: string;
    position: string;
    color?: string;
    style?: string;
  }>;
  dominantColors: Array<{
    hex: string;
    name: string;
    role?: string;
  }>;
  objects: Array<{
    name: string;
    position: string;
  }>;
  composition: string;
  suggestedHeadlineTop?: string;
  suggestedHeadlineMainWhite?: string;
  suggestedHeadlineMainYellow?: string;
  suggestedConcept?: string;
}

export interface GenerationVariant {
  id: string;
  generationId: string;
  variantIndex: number;
  engineUsed: EngineId;
  taskId: string | null;
  outputPath: string | null;
  status: VariantStatus;
  errorDetail: string | null;
  createdAt: number;
  completedAt: number | null;
}

export interface HealthStatus {
  glabs: "up" | "down" | "unknown";
  gemini: "configured" | "missing";
  glabsBaseUrl: string;
  checkedAt: number;
}
