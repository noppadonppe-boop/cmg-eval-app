const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const ROOT = 'CMG-eval-app/root'
const quarterPath = (quarter) => `${ROOT}/${quarter}_2026/data`
const plain = (value) => JSON.parse(JSON.stringify(value))
const kpi = (id, quarter) => ({ id, year: 2026, quarter, staffId: 'staff', supervisorId: 'sup', status: 'Pending' })

async function service(activeQuarter = 'Q1', legacyKpis = []) {
  const documents = new Map([[ROOT, {
    users: [{ id: 'staff' }], evaluationYears: [2026], activeYear: 2026, activeQuarter,
    staffConfigs: [], kpis: legacyKpis, quarterlyEvaluations: [],
    scorePartSettings: { 2026: { label: 'Q1' } }, competencyConfig: { label: 'Q1' },
  }]])
  for (const quarter of ['Q2', 'Q3', 'Q4']) {
    documents.set(quarterPath(quarter), {
      staffConfigs: [], kpis: [kpi(`existing-${quarter}`, quarter)], quarterlyEvaluations: [],
      scorePartSettings: { label: quarter }, competencyConfig: { label: quarter },
    })
  }
  const listeners = new Map()
  const snapshot = (ref) => ({ exists: () => documents.has(ref), data: () => plain(documents.get(ref)) })
  const context = vm.createContext({ console })
  const firestore = {
    doc: (_db, ...segments) => segments.join('/'),
    getDoc: async (ref) => snapshot(ref),
    setDoc: async (ref, value) => documents.set(ref, plain(value)),
    onSnapshot: (ref, callback) => {
      listeners.set(ref, callback)
      callback(snapshot(ref))
      return () => listeners.delete(ref)
    },
    runTransaction: async (_db, callback) => {
      const writes = new Map()
      const result = await callback({
        get: async (ref) => snapshot(ref),
        set: (ref, value) => writes.set(ref, plain(value)),
      })
      for (const [ref, value] of writes) documents.set(ref, value)
      return result
    },
  }
  const dependency = (values) => new vm.SyntheticModule(Object.keys(values), function () {
    for (const [name, value] of Object.entries(values)) this.setExport(name, value)
  }, { context })
  const module = new vm.SourceTextModule(fs.readFileSync(path.join(__dirname, '../src/services/firestoreService.js'), 'utf8'), { context })
  await module.link((specifier) => {
    if (specifier === '../utils/staffConfigUtils') {
      return new vm.SourceTextModule(fs.readFileSync(path.join(__dirname, '../src/utils/staffConfigUtils.js'), 'utf8'), { context })
    }
    return dependency(specifier === 'firebase/firestore' ? firestore : { db: {}, hasConfig: true })
  })
  await module.evaluate()
  return { api: module.namespace, documents, listeners, snapshot }
}

test('Q1 subscribes to all quarters without taking future evaluation settings', async () => {
  const { api, documents, listeners, snapshot } = await service()
  let data
  const unsubscribe = api.subscribeToApp((value) => { data = plain(value) })
  assert.equal(listeners.size, 4)
  assert.deepEqual(data.kpis.map((item) => item.quarter), ['Q2', 'Q3', 'Q4'])
  assert.equal(data.scorePartSettings[2026].label, 'Q1')
  assert.equal(data.competencyConfig.label, 'Q1')
  documents.get(quarterPath('Q4')).kpis.push(kpi('new-Q4', 'Q4'))
  listeners.get(quarterPath('Q4'))(snapshot(quarterPath('Q4')))
  assert.ok(data.kpis.some((item) => item.id === 'new-Q4'))
  unsubscribe()
  assert.equal(listeners.size, 0)
})

test('assign Q2-Q4 while Q1 is active, then reload and respond to a future KPI', async () => {
  const { api, documents } = await service()
  for (const quarter of ['Q2', 'Q3', 'Q4']) {
    await api.persistUpdate((data) => ({ ...data, kpis: [...data.kpis, kpi(`new-${quarter}`, quarter)] }), { year: 2026, quarter: 'Q1' })
    assert.ok(documents.get(quarterPath(quarter)).kpis.some((item) => item.id === `new-${quarter}`))
  }
  await api.persistUpdate((data) => ({ ...data, kpis: data.kpis.map((item) => item.id === 'new-Q4' ? { ...item, status: 'Accepted' } : item) }))
  let reloaded
  api.subscribeToApp((value) => { reloaded = plain(value) })
  assert.equal(reloaded.kpis.find((item) => item.id === 'new-Q4').status, 'Accepted')
  assert.equal(documents.get(ROOT).activeQuarter, 'Q1')
  assert.equal(documents.get(ROOT).kpis.length, 0)
  for (const quarter of ['Q2', 'Q3', 'Q4']) {
    assert.equal(documents.get(quarterPath(quarter)).scorePartSettings.label, quarter)
    assert.equal(documents.get(quarterPath(quarter)).competencyConfig.label, quarter)
  }
})

test('move and delete KPIs across quarters while Q3 is active', async () => {
  const { api, documents } = await service('Q3', [kpi('root-Q1', 'Q1')])
  await api.persistUpdate((data) => ({ ...data, kpis: data.kpis.map((item) => item.id === 'existing-Q2' ? { ...item, quarter: 'Q4' } : item) }))
  assert.equal(documents.get(quarterPath('Q2')).kpis.length, 0)
  assert.ok(documents.get(quarterPath('Q4')).kpis.some((item) => item.id === 'existing-Q2'))
  await api.persistUpdate((data) => ({ ...data, kpis: data.kpis.filter((item) => !['root-Q1', 'existing-Q2'].includes(item.id)) }))
  assert.equal(documents.get(ROOT).kpis.length, 0)
  assert.ok(!documents.get(quarterPath('Q4')).kpis.some((item) => item.id === 'existing-Q2'))
  assert.equal(documents.get(quarterPath('Q2')).scorePartSettings.label, 'Q2')
  assert.equal(documents.get(quarterPath('Q4')).scorePartSettings.label, 'Q4')
})

test('missing future documents migrate legacy records while retaining other years and Q1', async () => {
  const legacy = [kpi('q1', 'Q1'), kpi('q2', 'Q2'), kpi('q4', 'Q4'), { ...kpi('older', 'Q2'), year: 2025 }]
  const { api, documents } = await service('Q1', legacy)
  documents.delete(quarterPath('Q2'))
  documents.delete(quarterPath('Q4'))
  await api.persistUpdate((data) => ({ ...data, kpis: [...data.kpis, kpi('new', 'Q4')] }))
  assert.deepEqual(documents.get(ROOT).kpis.map((item) => item.id), ['q1', 'older'])
  assert.deepEqual(documents.get(quarterPath('Q2')).kpis.map((item) => item.id), ['q2'])
  assert.deepEqual(documents.get(quarterPath('Q4')).kpis.map((item) => item.id), ['q4', 'new'])
})

test('loading future records preserves settings for the active quarter', async () => {
  const { api, documents } = await service('Q2')
  let data
  api.subscribeToApp((value) => { data = plain(value) })
  assert.equal(data.scorePartSettings[2026].label, 'Q2')
  assert.equal(data.competencyConfig.label, 'Q2')
  await api.persistUpdate((current) => ({
    ...current, kpis: [...current.kpis, kpi('future', 'Q4')],
    scorePartSettings: { ...current.scorePartSettings, 2026: { label: 'updated-Q2' } },
  }))
  assert.equal(documents.get(quarterPath('Q2')).scorePartSettings.label, 'updated-Q2')
  assert.equal(documents.get(ROOT).scorePartSettings[2026].label, 'Q1')
  assert.equal(documents.get(quarterPath('Q4')).scorePartSettings.label, 'Q4')
})

test('changing Q2 supervisor resets Q2 and inherited Q3, preserves Q1 and explicit Q4, and archives Part 3', async () => {
  const { api, documents } = await service('Q1', [kpi('q1', 'Q1')])
  documents.get(ROOT).staffConfigs = [{ id: 'base', staffId: 'staff', year: 2026, quarter: 'Q1', supervisorId: 'sup' }]
  documents.get(quarterPath('Q4')).staffConfigs = [{ id: 'q4', staffId: 'staff', year: 2026, quarter: 'Q4', supervisorId: 'q4-sup' }]
  const score = (id, part) => ({ id, part, year: 2026, quarter: 'Q2', staffId: 'staff', rawTotal: 30 })
  documents.get(quarterPath('Q2')).quarterlyEvaluations = [score('self', 'part3_staff'), score('sup', 'part3_sup'), score('jd', 'part1')]
  documents.get(quarterPath('Q2')).kpis.push({ ...kpi('other-staff', 'Q2'), staffId: 'other' })
  await api.persistUpdate((data) => ({ ...data, staffConfigs: [...data.staffConfigs, {
    id: 'new-q2', staffId: 'staff', year: 2026, quarter: 'Q2', supervisorId: 'new-sup',
  }] }))
  assert.deepEqual(documents.get(ROOT).kpis.map((item) => item.id), ['q1'])
  assert.deepEqual(documents.get(quarterPath('Q2')).kpis.map((item) => item.id), ['other-staff'])
  assert.equal(documents.get(quarterPath('Q3')).kpis.length, 0)
  assert.equal(documents.get(quarterPath('Q4')).kpis.length, 1)
  assert.deepEqual(documents.get(quarterPath('Q2')).quarterlyEvaluations.map((item) => item.id), ['jd'])
  const history = documents.get(quarterPath('Q2')).kpiReassignments
  assert.equal(history.length, 1)
  assert.equal(history[0].previousSupervisorId, 'sup')
  assert.equal(history[0].supervisorId, 'new-sup')
  assert.equal(history[0].kpis.length, 1)
  assert.equal(history[0].quarterlyEvaluations.length, 2)
  await api.persistUpdate((data) => ({ ...data, kpis: [...data.kpis, { ...kpi('new-agreement', 'Q2'), supervisorId: 'new-sup' }] }))
  let loaded
  api.subscribeToApp((value) => { loaded = plain(value) })
  assert.ok(loaded.kpis.some((item) => item.id === 'new-agreement'))
  assert.equal(loaded.kpiReassignments.length, 2)
  assert.equal(documents.get(ROOT).activeQuarter, 'Q1')
})

test('changing stakeholders or leave quota with the same supervisor keeps KPIs and scores', async () => {
  const { api, documents } = await service('Q2')
  documents.get(ROOT).staffConfigs = [{ id: 'base', staffId: 'staff', year: 2026, supervisorId: 'sup' }]
  await api.persistUpdate((data) => ({ ...data, staffConfigs: data.staffConfigs.map((config) => ({ ...config, leaveQuota: 15, stakeholderIds: ['new-stakeholder'] })) }))
  for (const quarter of ['Q2', 'Q3', 'Q4']) {
    assert.equal(documents.get(quarterPath(quarter)).kpis.length, 1)
    assert.equal(documents.get(quarterPath(quarter)).kpiReassignments.length, 0)
  }
})

test('removing a quarter override resets the quarters whose effective supervisor changes', async () => {
  const { api, documents } = await service('Q2')
  documents.get(ROOT).staffConfigs = [{ id: 'base', staffId: 'staff', year: 2026, supervisorId: 'base-sup' }]
  documents.get(quarterPath('Q2')).staffConfigs = [{ id: 'override', staffId: 'staff', year: 2026, quarter: 'Q2', supervisorId: 'sup' }]
  await api.persistUpdate((data) => ({ ...data, staffConfigs: data.staffConfigs.filter((config) => config.id !== 'override') }))
  for (const quarter of ['Q2', 'Q3', 'Q4']) {
    assert.equal(documents.get(quarterPath(quarter)).kpis.length, 0)
    assert.equal(documents.get(quarterPath(quarter)).kpiReassignments[0].supervisorId, 'base-sup')
  }
})

test('changing legacy annual supervisor resets all four quarters, retaining previous years', async () => {
  const { api, documents } = await service('Q1', [kpi('q1', 'Q1'), { ...kpi('previous-year', 'Q1'), year: 2025 }])
  documents.get(ROOT).staffConfigs = [
    { id: 'base', staffId: 'staff', year: 2026, supervisorId: 'sup' },
    { id: 'previous-base', staffId: 'staff', year: 2025, supervisorId: 'sup' },
  ]
  await api.persistUpdate((data) => ({ ...data, staffConfigs: data.staffConfigs.map((config) => config.id === 'base' ? { ...config, supervisorId: 'new-sup' } : config) }))
  assert.deepEqual(documents.get(ROOT).kpis.map((item) => item.id), ['previous-year'])
  assert.equal(documents.get(ROOT).kpiReassignments.length, 1)
  for (const quarter of ['Q2', 'Q3', 'Q4']) {
    assert.equal(documents.get(quarterPath(quarter)).kpis.length, 0)
    assert.equal(documents.get(quarterPath(quarter)).kpiReassignments.length, 1)
  }
})
