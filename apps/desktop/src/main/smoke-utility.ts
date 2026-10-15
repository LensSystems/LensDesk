import { supportsFts5 } from "./db/driver.ts";

process.parentPort.postMessage({ fts5: supportsFts5() });
