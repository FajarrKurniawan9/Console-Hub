export function redirectToGoogleAuth(): void {
  const apiBase = (import.meta.env.VITE_API_URL as string | undefined) || '/api/v1'
  const redirectUrl = apiBase.startsWith('http')
    ? `${apiBase}/auth/google/redirect`
    : `${window.location.origin}${apiBase}/auth/google/redirect`
  window.location.href = redirectUrl
}
