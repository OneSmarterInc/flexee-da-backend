// One row per Ask Claude question, answered or failed. Kept 90 days by the
// TTL index on createdAt. The course name is not copied: the row links to
// the course by id, as the figures in an answer come from that course.

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

export const ASK_RETENTION_DAYS = 90;

@Schema({
  collection: 'ask_questions',
  timestamps: { createdAt: true, updatedAt: false },
})
export class AskQuestion {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  simulationId!: Types.ObjectId;
  @Prop({ type: Types.ObjectId, required: true }) userId!: Types.ObjectId;
  @Prop({ required: true }) conversationId!: string;
  @Prop({ required: true }) page!: string;
  @Prop({ type: Object, default: {} }) context!: Record<string, unknown>;
  @Prop({ required: true }) question!: string;
  @Prop({ type: String, default: null }) answer!: string | null;
  @Prop({ type: [Object], default: [] }) lookups!: Array<{
    name: string;
    summary: string;
  }>;
  @Prop({ type: [Object], default: [] }) dropped!: Array<{
    sentence: string;
    figures: string[];
  }>;
  @Prop({ default: 0 }) figuresChecked!: number;
  @Prop({ type: String, enum: ['answered', 'failed'], required: true })
  status!: 'answered' | 'failed';
  @Prop({ required: true }) model!: string;
  @Prop({ default: 0 }) inputTokens!: number;
  @Prop({ default: 0 }) outputTokens!: number;
  @Prop({ default: 0 }) costUsd!: number;
  createdAt!: Date;
}
export const AskQuestionSchema = SchemaFactory.createForClass(AskQuestion);
AskQuestionSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: ASK_RETENTION_DAYS * 24 * 3600 },
);
AskQuestionSchema.index({
  simulationId: 1,
  userId: 1,
  conversationId: 1,
  createdAt: -1,
});
