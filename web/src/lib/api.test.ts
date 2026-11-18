import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { server } from '../mocks/node'
import { ApiError, request, setUnauthenticatedHandler, tokenStore } from './api'

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

  it('maps an ApiError body to a typed error with console and fields', async () => {
    server.use(
      http.get(url, () =>
        HttpResponse.json(
          { error: { code: 'CONSOLE_TIMEOUT', message: 'Gudang lambat', console: 'gudang' } },
          { status: 504 },
        ),
      ),
    )
    const err = await request(z.unknown(), { url: '/thing' }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ code: 'CONSOLE_TIMEOUT', status: 504, console: 'gudang' })
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
