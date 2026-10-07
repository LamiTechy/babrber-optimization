import { NextResponse } from "next/server";
import { ZodError, type ZodIssue } from "zod";

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = { ok: false; error: { code: string; message: string } };

export function ok<T>(data: T, init?: ResponseInit): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(
  code: string,
  message: string,
  status = 400,
  init?: ResponseInit,
): NextResponse<ApiFailure> {
  return NextResponse.json({ ok: false, error: { code, message } }, { status, ...init });
}

function issueMessage(issue: ZodIssue): string {
  const path = issue.path.map(String).join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}

export function fromZodError(error: ZodError, status = 400): NextResponse<ApiFailure> {
  return fail("invalid_input", issueMessage(error.issues[0] ?? { message: "Invalid input", path: [], code: "custom" }), status);
}

export function isZodError(error: unknown): error is ZodError {
  return error instanceof ZodError;
}

/** Server-side guard: never leak stack traces or SQL to the client. */
export function serverError(error: unknown, message = "Something went wrong."): NextResponse<ApiFailure> {
  console.error("[api]", error instanceof Error ? error.message : error);
  return fail("server_error", message, 500);
}
