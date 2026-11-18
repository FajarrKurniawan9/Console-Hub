// Portal API contract (/api/v1). Every response is parsed against these schemas.
import { z } from 'zod'

export const one = <T extends z.ZodType>(item: T) => z.object({ data: item })
export const many = <T extends z.ZodType>(item: T) =>
  z.object({
    data: z.array(item),
    meta: z.object({ next_cursor: z.string().nullable(), total: z.number().nullable() }),
  })
export type Page<T> = { data: T[]; meta: { next_cursor: string | null; total: number | null } }

export const ERROR_CODES = [
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'VALIDATION_FAILED',
  'RATE_LIMITED',
  'CONSOLE_ERROR',
  'CONSOLE_UNREACHABLE',
  'CONSOLE_TIMEOUT',
] as const
export type ErrorCode = (typeof ERROR_CODES)[number]

export const apiErrorBody = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    console: z.string().optional(),
    fields: z.record(z.string(), z.array(z.string())).optional(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
})
export type ApiErrorBody = z.infer<typeof apiErrorBody>

const iso = z.string()

export const consoleStatus = z.enum(['ok', 'slow', 'down', 'unknown'])
export type ConsoleStatus = z.infer<typeof consoleStatus>
export const logLevel = z.enum(['debug', 'info', 'warn', 'error'])
export type LogLevel = z.infer<typeof logLevel>
export const runStatus = z.enum(['queued', 'running', 'succeeded', 'failed', 'canceled'])
export type RunStatus = z.infer<typeof runStatus>
export const stepStatus = z.enum([
  'pending',
  'running',
  'succeeded',
  'failed',
  'skipped',
  'compensated',
  'compensation_failed',
])
export type StepStatus = z.infer<typeof stepStatus>

export const user = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
  is_admin: z.boolean(),
})
export type User = z.infer<typeof user>
export const loginResult = z.object({ token: z.string(), user })

export const consoleResource = z.object({
  key: z.string(),
  label: z.string(),
  writable_fields: z.array(z.string()),
})
export type ConsoleResource = z.infer<typeof consoleResource>

export const hubConsole = z.object({
  id: z.number(),
  slug: z.string(),
  name: z.string(),
  base_url: z.string(),
  auth_type: z.enum(['api_key', 'bearer', 'basic']),
  status: consoleStatus,
  last_latency_ms: z.number().nullable(),
  last_checked_at: iso.nullable(),
  last_error: z.string().nullable().optional(),
  // Assumed (not in the contract summary): when the console started failing. Fallback: last_checked_at.
  down_since: iso.nullable().optional(),
  resources: z.array(consoleResource),
})
export type HubConsole = z.infer<typeof hubConsole>

export const consoleTest = z.object({
  status: consoleStatus,
  latency_ms: z.number().nullable(),
  message: z.string(),
})
export type ConsoleTest = z.infer<typeof consoleTest>

export const consoleRef = z.object({ id: z.number(), slug: z.string(), name: z.string() })

export const logEntry = z.object({
  id: z.number(),
  console: consoleRef,
  occurred_at: iso,
  level: logLevel,
  message: z.string(),
  actor: z.string().nullable(),
  raw: z.unknown().optional(),
})
export type LogEntry = z.infer<typeof logEntry>

export const processStep = z.object({
  position: z.number(),
  name: z.string(),
  console: z.object({ slug: z.string(), name: z.string() }),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  path: z.string(),
  on_failure: z.enum(['stop', 'continue']),
  max_retries: z.number(),
  has_compensation: z.boolean(),
})
export type ProcessStep = z.infer<typeof processStep>

export const inputField = z.object({
  type: z.enum(['string', 'integer']),
  required: z.boolean().optional(),
  min: z.number().optional(),
  label: z.string(),
})
export type InputField = z.infer<typeof inputField>

export const hubProcess = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string(),
  is_active: z.boolean(),
  input_schema: z.record(z.string(), inputField),
  compensate_on_failure: z.boolean(),
  steps: z.array(processStep),
})
export type HubProcess = z.infer<typeof hubProcess>

export const runStep = z.object({
  position: z.number(),
  name: z.string(),
  console: z.object({ slug: z.string() }).nullable(),
  status: stepStatus,
  attempt: z.number(),
  request: z
    .object({ method: z.string(), url: z.string(), body: z.unknown().optional() })
    .optional(),
  response: z.object({ status: z.number(), body: z.unknown().optional() }).optional(),
  error: z.string().nullable().optional(),
  duration_ms: z.number().nullable().optional(),
})
export type RunStep = z.infer<typeof runStep>

export const run = z.object({
  id: z.string(),
  process: z.object({ id: z.number(), name: z.string() }),
  status: runStatus,
  input: z.record(z.string(), z.unknown()),
  triggered_by: z.object({ id: z.number(), name: z.string() }),
  created_at: iso,
  started_at: iso.nullable(),
  finished_at: iso.nullable(),
  error_summary: z.string().nullable(),
  retry_of: z.string().nullable(),
  steps: z.array(runStep).optional(),
})
export type Run = z.infer<typeof run>

export const auditEvent = z.object({
  id: z.number(),
  user: z.object({ id: z.number(), name: z.string() }).nullable(),
  action: z.string(),
  target_type: z.string().nullable(),
  target_id: z.string().nullable(),
  console: z.object({ slug: z.string() }).nullable(),
  details: z.record(z.string(), z.unknown()).nullable(),
  created_at: iso,
})
export type AuditEvent = z.infer<typeof auditEvent>

export const overview = z.object({
  consoles: z.array(hubConsole),
  error_logs_24h: z.number(),
  recent_runs: z.array(run),
})
export type Overview = z.infer<typeof overview>

export const record = z.record(z.string(), z.unknown())
export type DataRecord = z.infer<typeof record>

export const logSyncResult = z.object({
  results: z.array(
    z.object({
      console: z.object({ slug: z.string(), name: z.string() }),
      ok: z.boolean(),
      fetched: z.number().nullable(),
      message: z.string().nullable(),
    }),
  ),
})
export type LogSyncResult = z.infer<typeof logSyncResult>
