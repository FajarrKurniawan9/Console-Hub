import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { calls, fail, ok, on } from '../../test/api'
import { ApiError, request, setUnauthenticatedHandler, tokenStore } from './client'

describe('request', () => {
  it('sends the bearer token and returns parsed data', async () => {
    tokenStore.set('abc')
    on('GET /thing', ok({ n: 1 }))
    await expect(
      request(z.object({ data: z.object({ n: z.number() }) }), { url: '/thing' }),
    ).resolves.toEqual({ data: { n: 1 } })
    expect(calls[0]!.headers.Authorization).toBe('Bearer abc')
  })

  it('maps an error body to a typed error with details', async () => {
    on(
      'POST /thing',
      fail(409, 'REFERENCED', 'Masih dipakai', {
        used_by: [{ source: 'gudang', type: 'item', id: 'i-1', name: 'Kain katun' }],
      }),
    )
    const err = await request(z.unknown(), { url: '/thing', method: 'POST' }).catch(
      (e: unknown) => e,
    )
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ code: 'REFERENCED', status: 409 })
    expect((err as ApiError).details?.used_by).toHaveLength(1)
  })

  it('reads details.fields as messages, or as a list of field names', async () => {
    on(
      'POST /thing',
      fail(422, 'VALIDATION_ERROR', 'x', { fields: { name: ['Nama wajib diisi.'] } }),
    )
    on('PATCH /thing', fail(422, 'REFERENCE_NOT_FOUND', 'x', { fields: ['responsible_id'] }))
    const a = (await request(z.unknown(), { url: '/thing', method: 'POST' }).catch(
      (e: unknown) => e,
    )) as ApiError
    expect(a.fields).toEqual({ name: ['Nama wajib diisi.'] })
    const b = (await request(z.unknown(), { url: '/thing', method: 'PATCH' }).catch(
      (e: unknown) => e,
    )) as ApiError
    expect(b.fields).toEqual({ responsible_id: [] })
  })

  it('rejects responses that break the contract', async () => {
    on('GET /thing', ok({ n: 'satu' }))
    const err = await request(z.object({ data: z.object({ n: z.number() }) }), {
      url: '/thing',
    }).catch((e: unknown) => e)
    expect(err).toMatchObject({ code: 'CONTRACT_MISMATCH' })
  })

  it('clears the token and notifies on 401', async () => {
    tokenStore.set('old')
    const onUnauth = vi.fn()
    setUnauthenticatedHandler(onUnauth)
    on('GET /thing', fail(401, 'UNAUTHENTICATED'))
    await request(z.unknown(), { url: '/thing' }).catch(() => {})
    expect(onUnauth).toHaveBeenCalledOnce()
    expect(tokenStore.get()).toBeNull()
  })

  it('maps a dropped connection to NETWORK', async () => {
    on('GET /thing', 'network-error')
    const err = await request(z.unknown(), { url: '/thing' }).catch((e: unknown) => e)
    expect(err).toMatchObject({ code: 'NETWORK', status: 0 })
    expect(calls).toHaveLength(1)
  })
})
