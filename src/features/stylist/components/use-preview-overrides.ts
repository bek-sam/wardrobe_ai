import { useCallback, useState } from "react";

import type { PreviewInfo } from "./stylist.types";

// Scoped to the candidateId they were set for, so switching to a different
// recommendation's preview (a new candidateId) implicitly drops stale
// notices/overrides without needing an effect to reset them.
export function usePreviewOverrides(candidateId: string | null) {
  const [statusOverride, setStatusOverride] = useState<{
    candidateId: string;
    status: PreviewInfo["status"];
  } | null>(null);
  const [noticeState, setNoticeState] = useState<{ candidateId: string; message: string } | null>(
    null,
  );

  const localStatus = statusOverride?.candidateId === candidateId ? statusOverride.status : null;
  const notice = noticeState?.candidateId === candidateId ? noticeState.message : null;

  const setLocalStatus = useCallback(
    (status: PreviewInfo["status"]) => {
      if (candidateId) setStatusOverride({ candidateId, status });
    },
    [candidateId],
  );
  const setNotice = useCallback(
    (message: string | null) => {
      if (candidateId) setNoticeState(message ? { candidateId, message } : null);
    },
    [candidateId],
  );

  return { localStatus, notice, setLocalStatus, setNotice };
}
