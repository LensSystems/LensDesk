export class ToolReleaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolReleaseError";
  }
}
