// src/modules/reporting/reporting.schemas.ts
//
// Storage for the reporting connector (Flexee family reporting contract v1)
// and the history it reports. Codes and tokens are stored only as SHA-256
// hashes. Close history and the scheduler's last run are kept apart from the
// course documents, so deleting a course does not erase its history (BPM B59).

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

/** An OAuth client: Claude's metadata document (cimd) or a registered one (dcr). */
@Schema({ collection: 'reporting_clients', timestamps: true })
export class ReportingClient {
  @Prop({ required: true, unique: true }) clientIdHash!: string;
  @Prop({ required: true }) clientId!: string;
  @Prop({ required: true, enum: ['cimd', 'dcr'] }) kind!: 'cimd' | 'dcr';
  @Prop({ type: String, default: null }) name!: string | null;
  @Prop({ type: [String], default: [] }) redirectUris!: string[];
  @Prop({ type: Date, default: null }) lastUsedAt!: Date | null;
  updatedAt!: Date;
}
export const ReportingClientSchema =
  SchemaFactory.createForClass(ReportingClient);

/** A single-use authorization code, valid for ten minutes. */
@Schema({ collection: 'reporting_codes', timestamps: true })
export class ReportingCode {
  @Prop({ required: true, unique: true }) codeHash!: string;
  @Prop({ type: Types.ObjectId, required: true }) clientRef!: Types.ObjectId;
  @Prop({ type: Types.ObjectId, required: true }) userId!: Types.ObjectId;
  @Prop({ required: true }) redirectUri!: string;
  @Prop({ required: true }) codeChallenge!: string;
  @Prop({ required: true }) scope!: string;
  @Prop({ required: true }) expiresAt!: Date;
  @Prop({ type: Date, default: null }) usedAt!: Date | null;
}
export const ReportingCodeSchema = SchemaFactory.createForClass(ReportingCode);
ReportingCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86_400 });

/** One admin's connection: an access token (an hour) and a rotating refresh token. */
@Schema({ collection: 'reporting_connections', timestamps: true })
export class ReportingConnection {
  @Prop({ type: Types.ObjectId, required: true }) clientRef!: Types.ObjectId;
  @Prop({ type: Types.ObjectId, required: true }) userId!: Types.ObjectId;
  @Prop({ required: true }) scope!: string;
  @Prop({ required: true, index: true }) accessHash!: string;
  @Prop({ required: true }) accessExpiresAt!: Date;
  @Prop({ required: true, index: true }) refreshHash!: string;
  @Prop({ required: true }) refreshExpiresAt!: Date;
  @Prop({ type: Date, default: null }) lastUsedAt!: Date | null;
  @Prop({ type: Date, default: null }) revokedAt!: Date | null;
  @Prop({ type: Types.ObjectId, default: null })
  revokedBy!: Types.ObjectId | null;
  createdAt!: Date;
}
export const ReportingConnectionSchema =
  SchemaFactory.createForClass(ReportingConnection);

/** One tool call: which tool, how it went, how many rows. Never the rows. */
@Schema({
  collection: 'reporting_calls',
  timestamps: { createdAt: true, updatedAt: false },
})
export class ReportingCall {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  connectionId!: Types.ObjectId;
  @Prop({ required: true }) tool!: string;
  @Prop({ required: true }) status!: string;
  @Prop({ required: true }) rows!: number;
  @Prop({ required: true }) ms!: number;
  createdAt!: Date;
}
export const ReportingCallSchema = SchemaFactory.createForClass(ReportingCall);

/**
 * One quarter close, recorded when it ends. The course name is copied in, so
 * the row still reads after the course is deleted.
 */
@Schema({
  collection: 'quarter_close_logs',
  timestamps: { createdAt: true, updatedAt: false },
})
export class QuarterCloseLog {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  simulationId!: Types.ObjectId;
  @Prop({ required: true }) course!: string;
  @Prop({ required: true }) quarter!: number;
  @Prop({ required: true, enum: ['deadline', 'faculty'] }) source!:
    | 'deadline'
    | 'faculty';
  @Prop({ required: true, enum: ['succeeded', 'failed'] }) status!:
    | 'succeeded'
    | 'failed';
  @Prop({ type: String, default: null }) errorCode!: string | null;
  @Prop({ type: Date, default: null }) openedAt!: Date | null;
  @Prop({ type: Date, default: null }) deadlineAt!: Date | null;
  @Prop({ required: true }) startedAt!: Date;
  @Prop({ required: true }) completedAt!: Date;
  @Prop({ required: true }) seconds!: number;
  @Prop({ required: true }) firms!: number;
  @Prop({ required: true }) firmsSubmitted!: number;
  @Prop({ required: true }) firmsCarriedForward!: number;
}
export const QuarterCloseLogSchema =
  SchemaFactory.createForClass(QuarterCloseLog);
QuarterCloseLogSchema.index({ simulationId: 1, quarter: 1 });

/** When the scheduled sweep last ran (key "quarter-sweep"). */
@Schema({ collection: 'scheduler_state' })
export class SchedulerState {
  @Prop({ required: true, unique: true }) key!: string;
  @Prop({ required: true }) lastRunAt!: Date;
}
export const SchedulerStateSchema =
  SchemaFactory.createForClass(SchedulerState);
