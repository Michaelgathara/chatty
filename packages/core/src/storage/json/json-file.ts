import { promises as fs } from "node:fs";
import path from "node:path";

export class JsonFile<T> {
  constructor(
    private readonly filePath: string,
    private readonly createEmpty: () => T,
  ) {}

  async read(): Promise<T> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      return JSON.parse(raw) as T;
    } catch (error) {
      if (isMissingFile(error)) {
        const empty = this.createEmpty();
        await this.write(empty);
        return empty;
      }

      throw error;
    }
  }

  async write(data: T): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  }
}

function isMissingFile(error: unknown): error is NodeJS.ErrnoException {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
