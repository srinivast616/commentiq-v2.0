import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import { ApiError } from "../../../middleware/error-handler.middleware";
import { RawComment } from "./youtube.provider";

// Accepts a CSV or XLSX buffer. Expected columns (case-insensitive, order
// doesn't matter): username, comment (or text), time (or date/posted_at),
// likes (or like_count), replies (or reply_count). Only "comment"/"text" is
// strictly required — everything else defaults sensibly so a bare
// single-column export still works.
function normalizeRow(row: Record<string, any>): RawComment | null {
  const lower: Record<string, any> = {};
  for (const key of Object.keys(row)) {
    lower[key.trim().toLowerCase()] = row[key];
  }

  const text = lower["comment"] ?? lower["text"] ?? lower["message"];
  if (!text || String(text).trim() === "") return null;

  return {
    externalCommentId: String(lower["id"] ?? lower["comment_id"] ?? ""),
    username: String(lower["username"] ?? lower["user"] ?? lower["author"] ?? "Unknown"),
    authorIsVerified: Boolean(lower["verified"]),
    text: String(text),
    likeCount: Number(lower["likes"] ?? lower["like_count"] ?? 0) || 0,
    replyCount: Number(lower["replies"] ?? lower["reply_count"] ?? 0) || 0,
    postedAt: String(lower["time"] ?? lower["date"] ?? lower["posted_at"] ?? new Date().toISOString()),
  };
}

export function parseCommentsFile(buffer: Buffer, filename: string): RawComment[] {
  const isXlsx = filename.toLowerCase().endsWith(".xlsx") || filename.toLowerCase().endsWith(".xls");

  let rows: Record<string, any>[];
  if (isXlsx) {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(sheet);
  } else {
    rows = parse(buffer, { columns: true, skip_empty_lines: true, trim: true });
  }

  if (rows.length === 0) {
    throw new ApiError(400, "empty_file", "The uploaded file had no rows to parse");
  }

  const comments = rows.map(normalizeRow).filter((c): c is RawComment => c !== null);

  if (comments.length === 0) {
    throw new ApiError(
      400,
      "no_comment_column",
      'Could not find a "comment" or "text" column in the uploaded file'
    );
  }

  return comments;
}
