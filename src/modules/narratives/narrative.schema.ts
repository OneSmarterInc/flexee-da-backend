// The words about a closed quarter: readings (faculty), explanations (one per
// firm, for its students) and the debrief's chart captions. engineText is the
// engine's own text and is always kept; text is Claude's rewording, or null.
// Pages show text when it is set, engineText otherwise.

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

export const NARRATIVE_KINDS = [
  'reading',
  'explanation',
  'debrief_caption',
] as const;
export type NarrativeKind = (typeof NARRATIVE_KINDS)[number];
export const REWORD_OUTCOMES = [
  'pending',
  'kept',
  'checks_failed',
  'error',
  'off',
] as const;
export type RewordOutcome = (typeof REWORD_OUTCOMES)[number];

@Schema({ collection: 'narratives', timestamps: true })
export class Narrative {
  @Prop({ type: Types.ObjectId, required: true }) simulationId!: Types.ObjectId;
  /** The course's name, copied in so reports still read. */
  @Prop({ type: String, default: null }) course!: string | null;
  /** Null for a reading and for course-level captions. */
  @Prop({ type: Types.ObjectId, default: null }) firmId!: Types.ObjectId | null;
  /** The closed quarter (the last one for the debrief). */
  @Prop({ required: true }) quarter!: number;
  @Prop({ type: String, required: true, enum: NARRATIVE_KINDS })
  kind!: NarrativeKind;
  /** Names the chart for a debrief caption; empty otherwise. */
  @Prop({ type: String, default: '' }) key!: string;
  @Prop({ required: true }) engineText!: string;
  @Prop({ type: String, default: null }) text!: string | null;
  @Prop({ type: String, enum: REWORD_OUTCOMES, default: 'pending' })
  rewordOutcome!: RewordOutcome;
  createdAt!: Date;
  updatedAt!: Date;
}
export const NarrativeSchema = SchemaFactory.createForClass(Narrative);
NarrativeSchema.index(
  { simulationId: 1, firmId: 1, quarter: 1, kind: 1, key: 1 },
  { unique: true },
);
NarrativeSchema.index({ rewordOutcome: 1, createdAt: 1 });
