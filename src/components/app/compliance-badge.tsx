import { Badge } from "@/components/ui/badge";
import type { ComplianceStatus, RiskLevel } from "@/lib/types";

const COMPLIANCE_CONFIG: Record<
  ComplianceStatus,
  { label: string; variant: "success" | "warning" | "danger" | "neutral" }
> = {
  compliant: { label: "Compliant", variant: "success" },
  doubtful: { label: "Doubtful", variant: "warning" },
  non_compliant: { label: "Non-compliant", variant: "danger" },
  not_reviewed: { label: "Not reviewed", variant: "neutral" },
};

export function ComplianceBadge({ status }: { status: ComplianceStatus }) {
  const config = COMPLIANCE_CONFIG[status] ?? COMPLIANCE_CONFIG.not_reviewed;
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

const RISK_CONFIG: Record<
  RiskLevel,
  { label: string; variant: "success" | "warning" | "danger" }
> = {
  low: { label: "Low risk", variant: "success" },
  medium: { label: "Medium risk", variant: "warning" },
  high: { label: "High risk", variant: "danger" },
};

export function RiskBadge({ level }: { level: RiskLevel }) {
  const config = RISK_CONFIG[level] ?? RISK_CONFIG.medium;
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
