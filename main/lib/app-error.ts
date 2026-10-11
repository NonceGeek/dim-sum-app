/** Expected server-side failure whose status and message can be returned to the caller. */
export class AppError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "AppError";
  }
}
