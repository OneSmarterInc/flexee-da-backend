// The frontend shows every one of these values in plain words, through
// flexee-da-frontend/src/lib/labels.js, and checks its labels against
// flexee-da-frontend/src/lib/enums.json. When an enum here changes, this test
// fails: update that file and the labels in the same change, or a new value
// reaches a page as a raw code.

import {
  DecisionStatus,
  EnrollmentStatus,
  ForecastMethod,
  ForecastSource,
  InviteStatus,
  RegistrationLinkStatus,
  SimulationStatus,
  DCStatus,
  DecisionSchema,
  SimulationSchema,
} from './index.entity';

const values = (e: object) => Object.values(e) as string[];

describe('enums the frontend labels', () => {
  it('match the lists in the frontend enums.json', () => {
    expect({
      course: values(SimulationStatus),
      enrollment: values(EnrollmentStatus),
      invite: values(InviteStatus),
      registrationLink: values(RegistrationLinkStatus),
      forecastMethod: values(ForecastMethod),
      forecastSource: values(ForecastSource),
      dcStatus: values(DCStatus),
      deployment: (SimulationSchema.path('deploymentStatus') as any).enumValues,
      submittedHow: (DecisionSchema.path('submittedHow') as any).enumValues,
      decisionStatus: values(DecisionStatus),
    }).toEqual({
      course: ['CREATED', 'INITIALIZED', 'IN_PROGRESS', 'COMPLETED', 'PAUSED'],
      enrollment: ['PENDING', 'ACTIVE', 'COMPLETED', 'DROPPED'],
      invite: ['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED'],
      registrationLink: ['ACTIVE', 'EXPIRED', 'DISABLED'],
      forecastMethod: ['GUT', 'MODEL'],
      forecastSource: ['GUT', 'MODEL', 'BASELINE'],
      dcStatus: ['NO', 'YES', 'CLOSE'],
      deployment: ['NOT_DEPLOYED', 'FACULTY_DEPLOYED', 'STUDENT_DEPLOYED'],
      submittedHow: [
        'team',
        'draft_promoted',
        'carried_forward',
        'baseline',
        'reference',
      ],
      decisionStatus: ['DRAFT', 'SUBMITTED', 'PROCESSED', 'LOCKED'],
    });
  });
});
