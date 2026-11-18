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

  it('maps an ApiError body to a typed error with fields and details', async () => {
    server.use(
      http.post(url, () =>
        HttpResponse.json(
          {
            error: {
              code: 'TRANSACTION_REFUSED',
              message: 'Stok tidak cukup',
              details: {
                refusals: [{ console: 'gudang', code: 'INSUFFICIENT_STOCK', message: 'x' }],
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
    expect(err).toMatchObject({ code: 'TRANSACTION_REFUSED', status: 409 })
    expect((err as ApiError).details?.refusals).toHaveLength(1)
  })

  it('sends an Idempotency-Key on writes and reuses a given key', async () => {
    const keys: (string | null)[] = []
    server.use(
      http.post(url, ({ request }) => {
        keys.push(request.headers.get('Idempotency-Key'))
        return HttpResponse.json({ data: null })
      }),
      http.get(url, ({ request }) => {
        keys.push(request.headers.get('Idempotency-Key'))
        return HttpResponse.json({ data: null })
      }),
    )
    await request(z.unknown(), { url: '/thing', method: 'POST', idempotencyKey: 'k-1' })
    await request(z.unknown(), { url: '/thing', method: 'POST', idempotencyKey: 'k-1' })
    await request(z.unknown(), { url: '/thing', method: 'POST' })
    await request(z.unknown(), { url: '/thing' })
    expect(keys.slice(0, 2)).toEqual(['k-1', 'k-1'])
    expect(keys[2]).toMatch(/^[0-9a-f-]{36}$/)
    expect(keys[3]).toBeNull()
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
