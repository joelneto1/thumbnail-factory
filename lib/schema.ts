import { z } from "zod";

// "gemini" saiu — imagem hoje é só G-Labs (gpt-image-2 é placeholder futuro).
export const engineSchema = z.enum(["glabs", "gpt-image-2"]);
export const modeSchema = z.enum(["from-scratch", "remodel"]);
export const swapActionSchema = z.enum(["replace", "keep", "remove"]);

export const textSwapSchema = z.object({
  original: z.string().min(1),
  action: swapActionSchema,
  replacement: z.string().optional(),
  position: z.string().optional(),
  style: z.string().optional(),
});

export const objectSwapSchema = z.object({
  original: z.string().min(1),
  action: swapActionSchema,
  replacement: z.string().optional(),
  position: z.string().optional(),
});

export const createPersonaSchema = z.object({
  name: z.string().min(1).max(80),
  channel: z.string().max(80).optional(),
  notes: z.string().max(500).optional(),
});

export const updatePersonaSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  channel: z.string().max(80).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export const generateRequestSchema = z
  .object({
    personaId: z.string().nullable().optional(),
    competitorPath: z.string().nullable().optional(),
    competitorUrl: z.string().nullable().optional(),
    mode: modeSchema.default("from-scratch"),

    // Identificador interno do batch (não vai pro prompt)
    title: z.string().max(200).nullable().optional(),

    // From-scratch mode
    headlineTop: z.string().max(60).nullable().optional(),
    headlineMainWhite: z.string().max(40).nullable().optional(),
    headlineMainYellow: z.string().max(40).nullable().optional(),
    concept: z.string().max(800).optional(),

    // Remodel mode
    textSwaps: z.array(textSwapSchema).optional(),
    objectSwaps: z.array(objectSwapSchema).optional(),
    compositionAnchor: z.string().max(500).optional(),

    extraInstructions: z.string().max(500).optional(),
    variantCount: z.number().int().min(1).max(4),
    engine: engineSchema,
  })
  .refine(
    (data) => {
      if (data.mode === "remodel") {
        return !!data.competitorPath;
      }
      return !!data.concept && data.concept.trim().length >= 3;
    },
    {
      message:
        "Modo remodelar exige competitor; modo from-scratch exige concept",
    }
  );

export type GenerateRequest = z.infer<typeof generateRequestSchema>;
