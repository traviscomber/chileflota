const selectMock = jest.fn()
const eqStatusMock = jest.fn(() => ({ select: selectMock }))
const inMock = jest.fn(() => ({ eq: eqStatusMock }))
const updateMock = jest.fn(() => ({ in: inMock }))
const fromMock = jest.fn(() => ({ update: updateMock }))

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: fromMock }),
}))

import { recoverStaleSystemJobRuns } from '@/lib/system-job-runs'

describe('recoverStaleSystemJobRuns', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('does nothing when there are no stale runs', async () => {
    await expect(recoverStaleSystemJobRuns([], 'reconcile-1')).resolves.toEqual([])
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('only terminalizes rows that are still running and returns the ids actually updated', async () => {
    selectMock.mockResolvedValueOnce({
      data: [{ id: 'run-1' }],
      error: null,
    })

    const recovered = await recoverStaleSystemJobRuns([
      { id: 'run-1', job_name: 'prt_import', started_at: '2026-08-09T20:12:21.270Z' },
      { id: 'run-2', job_name: 'f30_backfill', started_at: '2026-08-09T20:13:21.270Z' },
    ], 'reconcile-1')

    expect(recovered).toEqual(['run-1'])
    expect(fromMock).toHaveBeenCalledWith('system_job_runs')
    expect(inMock).toHaveBeenCalledWith('id', ['run-1', 'run-2'])
    expect(eqStatusMock).toHaveBeenCalledWith('status', 'running')
    expect(selectMock).toHaveBeenCalledWith('id')
  })
})
