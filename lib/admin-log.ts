type AdminLog = {
  evt: "admin.mutation";
  type: string;
  publicId?: string;
  ok: boolean;
  errorCategory?: string;
};

export function logAdminMutation(entry: Omit<AdminLog, "evt">): void {
  const line: AdminLog = { evt: "admin.mutation", ...entry };
  if (entry.ok) {
    console.info(JSON.stringify(line));
  } else {
    console.warn(JSON.stringify(line));
  }
}

export function errorCategory(error: unknown): string {
  if (error && typeof error === "object") {
    const code =
      "http_code" in error
        ? (error as { http_code?: unknown }).http_code
        : "error" in error
          ? (error as { error?: { http_code?: unknown } }).error?.http_code
          : undefined;
    if (typeof code === "number") return `cloudinary-${code}`;
  }
  if (error instanceof Error) return error.name;
  return "unknown";
}
