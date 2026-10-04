export type CiteApiErrorBody = {
  error: {
    code: string;
    message: string;
    user_message: string;
    retryable: boolean;
    field_errors?: Record<string, string>;
    request_id: string;
  };
};

export class CiteApiError extends Error {
  readonly code: string;
  readonly userMessage: string;
  readonly retryable: boolean;
  readonly requestId: string;
  readonly status: number;
  readonly fieldErrors: Record<string, string>;

  constructor(status: number, body: CiteApiErrorBody["error"]) {
    super(body.user_message || body.message);
    this.name = "CiteApiError";
    this.status = status;
    this.code = body.code;
    this.userMessage = body.user_message || body.message;
    this.retryable = body.retryable;
    this.requestId = body.request_id;
    this.fieldErrors = body.field_errors ?? {};
  }
}

export function parseCiteApiError(status: number, raw: unknown): CiteApiError {
  if (
    raw &&
    typeof raw === "object" &&
    "error" in raw &&
    raw.error &&
    typeof raw.error === "object" &&
    "code" in raw.error
  ) {
    const e = raw.error as CiteApiErrorBody["error"];
    return new CiteApiError(status, {
      code: String(e.code),
      message: String(e.message ?? "Request failed"),
      user_message: String(e.user_message ?? e.message ?? "Request failed"),
      retryable: Boolean(e.retryable),
      field_errors: e.field_errors ?? {},
      request_id: String(e.request_id ?? ""),
    });
  }
  if (
    raw &&
    typeof raw === "object" &&
    "error" in raw &&
    typeof (raw as { error: unknown }).error === "string"
  ) {
    const message = (raw as { error: string }).error;
    return new CiteApiError(status, {
      code: "INTERNAL_ERROR",
      message,
      user_message: message,
      retryable: status >= 500,
      field_errors: {},
      request_id: "",
    });
  }
  return new CiteApiError(status, {
    code: "INTERNAL_ERROR",
    message: `Cite API ${status}`,
    user_message: `Something went wrong loading results (HTTP ${status}). Please retry.`,
    retryable: status >= 500,
    field_errors: {},
    request_id: "",
  });
}
