import { useState, type FormEvent } from 'react'
import { CalendarClock, Download, FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { SelectField } from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'
import { ApiError } from '../../lib/api/client'
import {
  EXPORT_FORMATS,
  SCHEDULE_PRESETS,
  SCHEDULE_WEEKDAYS,
  defaultExportTimezone,
  defaultTomorrowMorningInput,
  toLocalDateTimeInputValue,
  useCreateExport,
  type CreateExportInput,
  type ExportFormat,
  type ExportScheduleMode,
  type ExportType,
  type SchedulePreset,
} from './queries'

const DAYS_OF_MONTH = Array.from({ length: 28 }, (_, i) => i + 1)

export function ExportModal({
  open,
  onOpenChange,
  type,
  title,
  filterSummary,
  filters,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: ExportType
  title: string
  filterSummary?: string
  filters?: unknown
  onSuccess?: () => void
}) {
  const [format, setFormat] = useState<ExportFormat>('csv')
  const [scheduleMode, setScheduleMode] = useState<ExportScheduleMode>('immediate')
  const [scheduledAtLocal, setScheduledAtLocal] = useState<string>(() =>
    defaultTomorrowMorningInput(),
  )
  const [recurringKind, setRecurringKind] = useState<SchedulePreset | 'cron'>('daily')
  const [scheduleTime, setScheduleTime] = useState<string>('08:00')
  const [dayOfWeek, setDayOfWeek] = useState<number>(1)
  const [dayOfMonth, setDayOfMonth] = useState<number>(1)
  const [cronExpression, setCronExpression] = useState<string>('0 8 * * *')
  const [customName, setCustomName] = useState<string>('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const createExport = useCreateExport()
  const activeOption = EXPORT_FORMATS.find((item) => item.value === format) ?? EXPORT_FORMATS[0]
  const timezone = defaultExportTimezone()
  const defaultName = `Laporan ${title} (${format.toUpperCase()})`

  function handleModeChange(nextMode: ExportScheduleMode) {
    setScheduleMode(nextMode)
    setFieldErrors({})
    if (nextMode === 'once') {
      const parsed = new Date(scheduledAtLocal)
      if (!scheduledAtLocal || Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
        setScheduledAtLocal(defaultTomorrowMorningInput())
      }
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFieldErrors({})

    const payload: CreateExportInput = {
      type,
      format,
      name: customName.trim() || defaultName,
      filters,
    }

    if (scheduleMode === 'once') {
      const parsed = new Date(scheduledAtLocal)
      if (!scheduledAtLocal || Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
        setFieldErrors({ scheduled_at: 'Waktu jadwal ekspor harus di masa depan.' })
        return
      }
      payload.scheduled_at = parsed.toISOString()
      payload.timezone = timezone
    } else if (scheduleMode === 'recurring') {
      payload.timezone = timezone
      if (recurringKind === 'cron') {
        const expr = cronExpression.trim().replace(/\s+/g, ' ')
        if (expr.split(' ').filter(Boolean).length !== 5) {
          setFieldErrors({
            cron_expression: 'Ekspresi cron 5-field tidak valid (contoh: "0 8 * * *").',
          })
          return
        }
        payload.cron_expression = expr
      } else {
        if (!/^\d{2}:\d{2}$/.test(scheduleTime)) {
          setFieldErrors({ schedule_time: 'Format jam harus HH:MM.' })
          return
        }
        payload.schedule_preset = recurringKind
        payload.schedule_time = scheduleTime
        if (recurringKind === 'weekly') {
          payload.schedule_day_of_week = dayOfWeek
        } else if (recurringKind === 'monthly') {
          payload.schedule_day_of_month = dayOfMonth
        }
      }
    }

    try {
      await createExport.mutateAsync(payload)
      toast.success(
        scheduleMode === 'immediate'
          ? 'Tiket ekspor berhasil dibuat! Masuk ke antrean waiting list.'
          : scheduleMode === 'once'
            ? 'Ekspor terjadwal berhasil disimpan!'
            : 'Jadwal ekspor otomatis berhasil diaktifkan!',
      )
      setScheduleMode('immediate')
      setCustomName('')
      setFieldErrors({})
      onOpenChange(false)
      onSuccess?.()
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        const mapped: Record<string, string> = {}
        for (const [key, msgs] of Object.entries(err.fields)) {
          if (msgs[0]) mapped[key] = msgs[0]
        }
        setFieldErrors(mapped)
        toast.error(err.message)
      } else {
        toast.error('Gagal membuat tiket ekspor.')
      }
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={
        <div className="flex items-center gap-2">
          <FileSpreadsheet size={18} className="text-accent" />
          <span>Export Data {title}</span>
        </div>
      }
      description="Buat tiket unduhan instan atau atur jadwal ekspor otomatis di background scheduler."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {filterSummary ? (
          <div className="rounded-md border border-border bg-surface/50 p-2.5 text-xs">
            <span className="font-semibold text-fg">Cakupan Data:</span>
            <p className="text-muted mt-0.5">{filterSummary}</p>
          </div>
        ) : null}

        <SelectField
          label="Pilih Format File"
          name="export-format"
          value={format}
          onChange={(e) => setFormat(e.target.value as ExportFormat)}
          hint={activeOption.hint}
        >
          {EXPORT_FORMATS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Waktu Eksekusi"
          name="schedule-mode"
          value={scheduleMode}
          onChange={(e) => handleModeChange(e.target.value as ExportScheduleMode)}
        >
          <option value="immediate">Langsung Sekarang (Antrean)</option>
          <option value="once">Jadwalkan Sekali (Tanggal & Jam)</option>
          <option value="recurring">Jadwal Berulang Otomatis (Cron / Rutin)</option>
        </SelectField>

        {scheduleMode !== 'immediate' ? (
          <Field
            label="Nama Laporan (opsional)"
            name="export-name"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder={defaultName}
            maxLength={160}
            error={fieldErrors.name}
          />
        ) : null}

        {scheduleMode === 'once' ? (
          <Field
            type="datetime-local"
            label="Tanggal & Waktu Eksekusi"
            name="scheduled-at"
            required
            min={toLocalDateTimeInputValue(new Date())}
            value={scheduledAtLocal}
            onChange={(e) => setScheduledAtLocal(e.target.value)}
            error={fieldErrors.scheduled_at}
            hint={`Zona waktu: ${timezone} · Harus di masa depan`}
          />
        ) : null}

        {scheduleMode === 'recurring' ? (
          <div className="flex flex-col gap-3 rounded-md border border-border bg-surface/30 p-3">
            <SelectField
              label="Pola Pengulangan"
              name="recurring-kind"
              value={recurringKind}
              onChange={(e) => {
                setRecurringKind(e.target.value as SchedulePreset | 'cron')
                setFieldErrors({})
              }}
            >
              {SCHEDULE_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
              <option value="cron">Ekspresi Cron Kustom (5-field)</option>
            </SelectField>

            {recurringKind === 'cron' ? (
              <Field
                label="Ekspresi Cron (5-field)"
                name="cron-expression"
                required
                value={cronExpression}
                onChange={(e) => setCronExpression(e.target.value)}
                placeholder="0 8 * * *"
                error={fieldErrors.cron_expression}
                hint={`Format: menit jam tgl bulan hari (contoh: "0 8 * * 1" = Senin 08:00 · ${timezone})`}
              />
            ) : (
              <div
                className={
                  recurringKind === 'daily' ? 'flex flex-col gap-3' : 'grid grid-cols-2 gap-3'
                }
              >
                <Field
                  type="time"
                  label="Jam Eksekusi"
                  name="schedule-time"
                  required
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  error={fieldErrors.schedule_time}
                  hint={`Zona waktu: ${timezone}`}
                />

                {recurringKind === 'weekly' ? (
                  <SelectField
                    label="Hari"
                    name="schedule-day-of-week"
                    value={String(dayOfWeek)}
                    onChange={(e) => setDayOfWeek(Number(e.target.value))}
                    error={fieldErrors.schedule_day_of_week}
                  >
                    {SCHEDULE_WEEKDAYS.map((d) => (
                      <option key={d.value} value={String(d.value)}>
                        {d.label}
                      </option>
                    ))}
                  </SelectField>
                ) : null}

                {recurringKind === 'monthly' ? (
                  <SelectField
                    label="Tanggal"
                    name="schedule-day-of-month"
                    value={String(dayOfMonth)}
                    onChange={(e) => setDayOfMonth(Number(e.target.value))}
                    error={fieldErrors.schedule_day_of_month}
                  >
                    {DAYS_OF_MONTH.map((day) => (
                      <option key={day} value={String(day)}>
                        Tanggal {day}
                      </option>
                    ))}
                  </SelectField>
                ) : null}
              </div>
            )}
          </div>
        ) : null}

        <div className="rounded-md bg-accent/5 p-3 text-xs text-muted border border-accent/10">
          <p className="font-medium text-fg mb-1 flex items-center gap-1.5">
            {scheduleMode === 'immediate' ? (
              <span>ℹ️ Mekanisme Background Scheduler:</span>
            ) : (
              <>
                <CalendarClock size={14} className="text-accent shrink-0" aria-hidden />
                <span>Penjadwalan Otomatis Server:</span>
              </>
            )}
          </p>
          <p>
            {scheduleMode === 'immediate'
              ? 'Permintaan ini akan dimasukkan ke dalam antrean (Waiting List). Scheduler background akan memproses file secara bertahap dan menyediakannya untuk diunduh tanpa membebani browser Anda.'
              : `Jadwal disimpan di server (${timezone}) dan dijalankan otomatis oleh Laravel scheduler saat waktunya tiba. Hasilnya akan muncul di Daftar Unduhan dan dapat dibatalkan kapan saja sebelum diproses.`}
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button type="button" onClick={() => onOpenChange(false)} disabled={createExport.isPending}>
            Batal
          </Button>
          <Button variant="primary" type="submit" disabled={createExport.isPending}>
            {createExport.isPending ? (
              <Spinner />
            ) : scheduleMode === 'immediate' ? (
              <Download size={14} />
            ) : (
              <CalendarClock size={14} />
            )}
            {createExport.isPending
              ? scheduleMode === 'immediate'
                ? 'Membuat Tiket…'
                : 'Menyimpan Jadwal…'
              : scheduleMode === 'immediate'
                ? 'Mulai Antrean Export'
                : 'Simpan Jadwal Export'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
