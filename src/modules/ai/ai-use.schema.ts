// src/modules/ai/ai-use.schema.ts
//
// One row per call to Claude, for the spending ceiling and the reporting
// connector's report_ai_use. No link to the course document: a deleted
// course's spend still counts toward the month it was made in, and the
// course name is copied in so reports still read.

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

/** The AI features a DA call can come from (contract v1 names where they exist). */
export const AI_FEATURES = [
  'ask_claude',
  'readings',
  'team_explanations',
  'debrief_captions',
] as const;
export type AiFeature = (typeof AI_FEATURES)[number];

/** kept: used as written; checks_failed: the checks dropped sentences or the reply; error: no usable reply. */
export const AI_OUTCOMES = ['kept', 'checks_failed', 'error'] as const;
export type AiOutcome = (typeof AI_OUTCOMES)[number];

@Schema({
  collection: 'ai_calls',
  timestamps: { createdAt: true, updatedAt: false },
})
export class AiCall {
  @Prop({ type: Types.ObjectId, default: null, index: true })
  simulationId!: Types.ObjectId | null;
  @Prop({ type: String, default: null }) course!: string | null;
  @Prop({ type: String, required: true, enum: AI_FEATURES })
  feature!: AiFeature;
  @Prop({ required: true }) model!: string;
  @Prop({ type: String, required: true, enum: AI_OUTCOMES })
  outcome!: AiOutcome;
  @Prop({ default: 0 }) sentencesDropped!: number;
  @Prop({ default: 0 }) inputTokens!: number;
  @Prop({ default: 0 }) outputTokens!: number;
  @Prop({ default: 0 }) costUsd!: number;
  createdAt!: Date;
}
export const AiCallSchema = SchemaFactory.createForClass(AiCall);
AiCallSchema.index({ createdAt: 1 });
