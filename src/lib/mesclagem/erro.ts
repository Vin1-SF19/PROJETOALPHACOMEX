export class ErroMesclagem extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: 400 | 403 | 405 | 409 | 413 | 422 | 429 = 400,
  ) {
    super(message);
    this.name = "ErroMesclagem";
  }
}
