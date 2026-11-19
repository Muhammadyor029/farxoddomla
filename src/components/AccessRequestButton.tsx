import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { AccessRequestStatus, AccessResourceType } from "../../shared/types";
import { apiRequest } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "./ui/button";

export interface AccessListMeta {
  locked?: boolean;
  requestable?: boolean;
  requestStatus?: AccessRequestStatus;
}

const RESOURCE_LABELS: Record<AccessResourceType, string> = {
  chapters: "Boblar",
  lessons: "Darslar",
  presentations: "Prezentatsiyalar",
  glossary: "Huquqiy lug'at",
  legislation: "Qonunchilik",
  scenarios: "Amaliy vaziyatlar",
};

export function resourceTypeLabel(type: AccessResourceType): string {
  return RESOURCE_LABELS[type] || type;
}

export function accessRequestLabel(status: AccessRequestStatus): string {
  switch (status) {
    case "pending":
      return "So'rov yuborildi";
    case "approved":
      return "Ruxsat berildi";
    case "rejected":
      return "Rad etildi";
    default:
      return "Ruxsat so'rash";
  }
}

interface AccessRequestButtonProps {
  resourceType: AccessResourceType;
  resourceId?: number;
  requestStatus?: AccessRequestStatus;
  onOpenAuth?: () => void;
  onSubmitted?: () => void;
  className?: string;
}

export function AccessRequestButton({
  resourceType,
  resourceId = 0,
  requestStatus = "none",
  onOpenAuth,
  onSubmitted,
  className = "",
}: AccessRequestButtonProps) {
  const { user } = useAuth();
  const [status, setStatus] = useState<AccessRequestStatus>(requestStatus);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    setStatus(requestStatus);
  }, [requestStatus]);

  async function handleClick() {
    setMessage(null);
    if (!user) {
      if (onOpenAuth) {
        onOpenAuth();
      } else {
        setIsError(false);
        setMessage("Ruxsat so'rash uchun tizimga kiring.");
      }
      return;
    }
    if (status === "pending" || status === "approved") return;

    setBusy(true);
    try {
      const res = await apiRequest<{
        message?: string;
        duplicate?: boolean;
        request?: { status: AccessRequestStatus };
      }>("/api/access-requests", {
        method: "POST",
        body: JSON.stringify({ resourceType, resourceId }),
      });
      setStatus(res.request?.status || "pending");
      setIsError(false);
      setMessage(
        res.message || (res.duplicate ? "So'rovingiz allaqachon ko'rib chiqilishni kutmoqda." : "So'rov yuborildi.")
      );
      onSubmitted?.();
    } catch (err) {
      setIsError(true);
      setMessage(err instanceof Error ? err.message : "So'rov yuborilmadi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className={`inline-flex flex-col items-start gap-1 ${className}`}>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handleClick}
        disabled={busy || status === "pending" || status === "approved"}
        title={status === "rejected" ? "Qayta so'rash" : undefined}
        className="gap-1.5 text-xs"
      >
        {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {accessRequestLabel(status)}
      </Button>
      {message && (
        <span className={`text-[11px] leading-snug ${isError ? "text-red-400" : "text-primary"}`}>{message}</span>
      )}
    </span>
  );
}
