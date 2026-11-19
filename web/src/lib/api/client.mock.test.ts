import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { server } from '../../../mocks/node'
import { ApiError, request, setUnauthenticatedHandler, tokenStore } from './client'

const url = '/api/v1/thing'

describe('request', () => {
  it('sends the bearer token and returns parsed data', async () => {
    tokenStore.set('abc')
    let auth: string | null = null
    server.use(
      http.get(url, ({ request }) => {
        auth = request.headers.get('Authorization')
        return HttpResponse.json({ data: { n: 1 } })
      }),
    )
    await expect(
      request(z.object({ data: z.object({ n: z.number() }) }), { url: '/thing' }),
    ).resolves.toEqual({
      data: { n: 1 },
    })
    expect(auth).toBe('Bearer abc')
  })

  it('maps an ApiError body to a typed error with details and field messages', async () => {
    server.use(
      http.post(url, () =>
        HttpResponse.json(
          {
            error: {
              code: 'REFERENCED',
              message: 'Masih dipakai',
              details: {
                used_by: [{ source: 'gudang', type: 'item', id: 'i-1', name: 'Kain katun' }],
              },
            },
          },
          { status: 409 },
        ),
      ),
    )
    const err = await request(z.unknown(), { url: '/thing', method: 'POST' }).catch(
      (e: unknown) => e,
    )
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ code: 'REFERENCED', status: 409 })
    expect((err as ApiError).details?.used_by).toHaveLength(1)
  })

  it('reads details.fields as messages, or as a list of field names', async () => {
    server.use(
      http.post(url, () =>
        HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'x',
              details: { fields: { name: ['Nama wajib diisi.'] } },
            },
          },
          { status: 422 },
        ),
      ),
      http.patch(url, () =>
        HttpResponse.json(
          {
            error: {
              code: 'REFERENCE_NOT_FOUND',
              message: 'x',
              details: { fields: ['responsible_id'] },
            },
          },
          { status: 422 },
        ),
      ),
    )
    const a = (await request(z.unknown(), { url: '/thing', method: 'POST' }).catch(
      (e: unknown) => e,
    )) as ApiError
    expect(a.fields).toEqual({ name: ['Nama wajib diisi.'] })
    const b = (await request(z.unknown(), { url: '/thing', method: 'PATCH' }).catch(
      (e: unknown) => e,
    )) as ApiError
    expect(b.fields).toEqual({ responsible_id: [] })
  })

  it('sends no Idempotency-Key (removed in update 2)', async () => {
    let key: string | null = 'unset'
    server.use(
      http.post(url, ({ request }) => {
        key = request.headers.get('Idempotency-Key')
        return HttpResponse.json({ data: null })
      }),
    )
    await request(z.unknown(), { url: '/thing', method: 'POST' })
    expect(key).toBeNull()
  })

  it('rejects responses that break the contract', async () => {
    server.use(http.get(url, () => HttpResponse.json({ data: { n: 'satu' } })))
    const err = await request(z.object({ data: z.object({ n: z.number() }) }), {
      url: '/thing',
    }).catch((e: unknown) => e)
    expect(err).toMatchObject({ code: 'CONTRACT_MISMATCH' })
  })

  it('clears the token and notifies on 401', async () => {
    tokenStore.set('old')
    const onUnauth = vi.fn()
    setUnauthenticatedHandler(onUnauth)
    server.use(
      http.get(url, () =>
        HttpResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, { status: 401 }),
      ),
    )
    await request(z.unknown(), { url: '/thing' }).catch(() => {})
    expect(onUnauth).toHaveBeenCalledOnce()
    expect(tokenStore.get()).toBeNull()
  })

  it('maps a dropped connection to NETWORK', async () => {
    server.use(http.get(url, () => HttpResponse.error()))
    const err = await request(z.unknown(), { url: '/thing' }).catch((e: unknown) => e)
    expect(err).toMatchObject({ code: 'NETWORK', status: 0 })
  })
})
