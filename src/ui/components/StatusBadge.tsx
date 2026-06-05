import {
  EXPOSURE_STATUS_LABEL,
  type ExposureStatus,
} from '@domain/hazard/ExposureAssessment';
import {
  ENROLLMENT_STATUS_LABEL,
  PROGRAM_STATUS_LABEL,
  type EnrollmentStatus,
  type ProgramStatus,
} from '@domain/program/HealthProgram';
import { SEVERITY_LABEL, type Severity } from '@domain/symptom/Symptom';

export function ExposureStatusBadge({ status }: { status: ExposureStatus }) {
  return (
    <span className={`badge badge--${status}`}>
      <span className="dot" />
      {EXPOSURE_STATUS_LABEL[status]}
    </span>
  );
}

const ENROLLMENT_TONE: Record<EnrollmentStatus, string> = {
  applied: 'info',
  enrolled: 'success',
  waitlisted: 'warning',
  completed: 'info',
  cancelled: 'muted',
};

export function EnrollmentStatusBadge({ status }: { status: EnrollmentStatus }) {
  return (
    <span className={`badge badge--${ENROLLMENT_TONE[status]}`}>
      {ENROLLMENT_STATUS_LABEL[status]}
    </span>
  );
}

const PROGRAM_TONE: Record<ProgramStatus, string> = {
  recruiting: 'success',
  ongoing: 'info',
  closed: 'muted',
};

export function ProgramStatusBadge({ status }: { status: ProgramStatus }) {
  return (
    <span className={`badge badge--${PROGRAM_TONE[status]}`}>{PROGRAM_STATUS_LABEL[status]}</span>
  );
}

const SEVERITY_TONE: Record<Severity, string> = {
  mild: 'success',
  moderate: 'warning',
  severe: 'danger',
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`badge badge--${SEVERITY_TONE[severity]}`}>{SEVERITY_LABEL[severity]}</span>
  );
}
