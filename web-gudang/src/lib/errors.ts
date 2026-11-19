/** A plain sentence for any thrown value. Refined once the API client exists. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message
  return 'Terjadi gangguan. Coba lagi sebentar lagi.'
}
