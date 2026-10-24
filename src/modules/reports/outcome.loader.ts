import { Model, Types } from 'mongoose';
import { Outcome, outcomeFor } from './outcome';

interface OutcomeModels {
  kpiHistoryModel: Model<any>;
  decisionModel: Model<any>;
  simulationModel: Model<any>;
}

/** One outcome per firm in the simulation, keyed by firm id string. */
export async function loadOutcomes(
  { kpiHistoryModel, decisionModel, simulationModel }: OutcomeModels,
  simulationId: Types.ObjectId,
): Promise<Map<string, Outcome>> {
  const [simulation, kpis, decisions] = await Promise.all([
    simulationModel.findById(simulationId).select('totalQuarters').lean(),
    kpiHistoryModel.find({ simulation: simulationId }).select('firm quarter bsc').lean(),
    decisionModel.find({ simulation: simulationId }).select('firm quarter submittedHow').lean(),
  ]);
  const totalQuarters = (simulation as any)?.totalQuarters ?? 0;

  const kpisByFirm = new Map<string, any[]>();
  for (const k of kpis as any[]) {
    const id = String(k.firm);
    if (!kpisByFirm.has(id)) kpisByFirm.set(id, []);
    kpisByFirm.get(id)!.push(k);
  }
  const decisionsByFirm = new Map<string, any[]>();
  for (const d of decisions as any[]) {
    const id = String(d.firm);
    if (!decisionsByFirm.has(id)) decisionsByFirm.set(id, []);
    decisionsByFirm.get(id)!.push(d);
  }

  const result = new Map<string, Outcome>();
  for (const [firmId, firmKpis] of kpisByFirm) {
    result.set(
      firmId,
      outcomeFor(firmKpis, decisionsByFirm.get(firmId) ?? [], totalQuarters),
    );
  }
  return result;
}
