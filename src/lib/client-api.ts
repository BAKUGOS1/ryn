export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
// Do not retry mutations automatically: an interrupted response can follow a
// committed write. The user must inspect the saved state before resubmitting.
export async function post(path: string, payload: unknown) {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new ApiError(
      0,
      "Connection interrupted. Check the saved state before submitting again.",
    );
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(
      response.status,
      "The response could not be confirmed. Refresh and check the saved state before submitting again.",
    );
  }
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new ApiError(
      response.status,
      "Unexpected response. Refresh and check the saved state.",
    );
  if (!response.ok)
    throw new ApiError(
      response.status,
      typeof data.error === "string"
        ? data.error
        : "The request failed. Please try again later.",
    );
  return data;
}
