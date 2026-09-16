export class ExplorerError extends Error {
  constructor(
    readonly code: string,
    readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 429 | 500 | 503,
    message: string,
  ) {
    super(message);
    this.name = "ExplorerError";
  }
}
