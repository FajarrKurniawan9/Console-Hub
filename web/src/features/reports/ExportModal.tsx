import { useState, type FormEvent } from 'react'
import { Download, FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { SelectField } from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'
import { ApiError } from '../../lib/api/client'
import { EXPORT_FORMATS, useCreateExport, type ExportFormat, type ExportType } from './queries'

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
  const createExport = useCreateExport()
  const activeOption = EXPORT_FORMATS.find((item) => item.value === format) ?? EXPORT_FORMATS[0]

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    try {
      await createExport.mutateAsync({
        type,
        format,
        name: `Laporan ${title} (${format.toUpperCase()})`,
        filters,
      })
      toast.success('Tiket ekspor berhasil dibuat! Masuk ke antrean waiting list.')
      onOpenChange(false)
      onSuccess?.()
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Gagal membuat tiket ekspor.')
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
      description="Buat tiket unduhan baru. Scheduler akan memproses data ini di background antrean."
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

        <div className="rounded-md bg-accent/5 p-3 text-xs text-muted border border-accent/10">
          <p className="font-medium text-fg mb-1">ℹ️ Mekanisme Background Scheduler:</p>
          <p>
            Permintaan ini akan dimasukkan ke dalam antrean (Waiting List). Scheduler background
            akan memproses file secara bertahap dan menyediakannya untuk diunduh tanpa membebani browser Anda.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button type="button" onClick={() => onOpenChange(false)} disabled={createExport.isPending}>
            Batal
          </Button>
          <Button variant="primary" type="submit" disabled={createExport.isPending}>
            {createExport.isPending ? <Spinner /> : <Download size={14} />}
            {createExport.isPending ? 'Membuat Tiket…' : 'Mulai Antrean Export'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
