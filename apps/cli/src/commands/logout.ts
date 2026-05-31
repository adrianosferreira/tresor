import { unlink } from "node:fs/promises";
import { sessionPath } from "../config.js";

export async function logoutCommand(): Promise<void> {
  try {
    await unlink(sessionPath());
    console.log("Signed out. Session removed.");
  } catch {
    console.log("No session file found.");
  }
}
