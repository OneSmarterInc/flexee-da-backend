export type AnalyticsWorkbenchModuleId = 'ds' | 'sa' | 'ci' | 'nd' | 'pi' | 'me';

export interface AnalyticsWorkbenchModuleCatalogEntry {
  moduleId: AnalyticsWorkbenchModuleId;
  moduleName: string;
  shortDescription: string;
  dataFileName: string;
  assignmentFileName: string;
  directoryKey: string;
}

export const ANALYTICS_WORKBENCH_MODULE_CATALOG: AnalyticsWorkbenchModuleCatalogEntry[] = [
  {
    moduleId: 'ds',
    moduleName: 'Demand Science',
    shortDescription: 'Forecast regional demand using historical data.',
    dataFileName: 'data.csv',
    assignmentFileName: 'assignment.docx',
    directoryKey: 'demand-science',
  },
  {
    moduleId: 'sa',
    moduleName: 'Supplier Analytics',
    shortDescription: 'Select suppliers using total cost of ownership analysis.',
    dataFileName: 'data.csv',
    assignmentFileName: 'assignment.docx',
    directoryKey: 'supplier-analytics',
  },
  {
    moduleId: 'ci',
    moduleName: 'Customer Intelligence',
    shortDescription: 'Segment customers and allocate marketing investment.',
    dataFileName: 'data.csv',
    assignmentFileName: 'assignment.docx',
    directoryKey: 'customer-intelligence',
  },
  {
    moduleId: 'nd',
    moduleName: 'Network Design',
    shortDescription: 'Design the distribution network for service and cost.',
    dataFileName: 'data.csv',
    assignmentFileName: 'assignment.docx',
    directoryKey: 'network-design',
  },
  {
    moduleId: 'pi',
    moduleName: 'Product Innovation',
    shortDescription: 'Decide whether and how to launch the P3 product.',
    dataFileName: 'data.csv',
    assignmentFileName: 'assignment.docx',
    directoryKey: 'product-innovation',
  },
  {
    moduleId: 'me',
    moduleName: 'Market Expansion',
    shortDescription: 'Enter international regions based on NPV analysis.',
    dataFileName: 'data.csv',
    assignmentFileName: 'assignment.docx',
    directoryKey: 'market-expansion',
  },
];

export const ANALYTICS_WORKBENCH_MODULE_BY_ID = ANALYTICS_WORKBENCH_MODULE_CATALOG.reduce(
  (acc, module) => {
    acc[module.moduleId] = module;
    return acc;
  },
  {} as Record<AnalyticsWorkbenchModuleId, AnalyticsWorkbenchModuleCatalogEntry>,
);

export const ANALYTICS_WORKBENCH_MODULE_IDS = ANALYTICS_WORKBENCH_MODULE_CATALOG.map(
  (module) => module.moduleId,
);
