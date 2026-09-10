import { useCallback, useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import SideBar from './SideBar'
import NotificationSA from './NotificationSA'
import RuleForm from './RuleForm'
import RuleAudit from './RuleAudit'
import rulesService, { COMPARATOR_SYMBOL } from '../services/rules'
import devicesService from '../services/devices'
import { setNotification } from '../reducers/notificationReducer'
import './Rules.css'

// Rules store the TTN downlink body; show the text the user typed when it
// decodes cleanly, otherwise the raw base64.
const payloadText = (payload) => {
    try {
        return window.atob(payload?.frm_payload ?? '')
    } catch {
        return payload?.frm_payload ?? ''
    }
}

const Rules = () => {
    const dispatch = useDispatch()
    const [rules, setRules] = useState([])
    const [devices, setDevices] = useState([])
    const [showForm, setShowForm] = useState(false)
    const [auditRule, setAuditRule] = useState(null)

    const notify = useCallback(
        (message, type = 'success') => dispatch(setNotification({ message, type, visible: true })),
        [dispatch]
    )

    const loadRules = useCallback(() =>
        rulesService.getAll()
            .then(setRules)
            .catch((e) => notify(rulesService.errorMessage(e), 'fail')),
        [notify]
    )

    useEffect(() => {
        loadRules()
        // Only TTN devices can feed a clause or receive a downlink — Chirpstack
        // devices have no dev_id (and no downpush URL).
        devicesService.getAll().then((list) => setDevices(list.filter((d) => d.dev_id)))
    }, [loadRules])

    const deviceName = (devId) => devices.find((d) => d.dev_id === devId)?.name ?? devId

    const toggle = async ({ rule }) => {
        try {
            const updated = await rulesService.patch(rule.id, { enabled: !rule.enabled })
            setRules((prev) => prev.map((r) => (r.rule.id === rule.id ? { ...r, rule: updated } : r)))
            notify(`"${updated.name}" je ${updated.enabled ? 'ukljucena' : 'iskljucena'}`)
        } catch (e) {
            notify(rulesService.errorMessage(e), 'fail')
        }
    }

    const remove = async ({ rule }) => {
        if (!window.confirm(`Obrisati automatizaciju "${rule.name}"?`)) return
        try {
            await rulesService.remove(rule.id)
            setRules((prev) => prev.filter((r) => r.rule.id !== rule.id))
            if (auditRule?.rule.id === rule.id) setAuditRule(null)
            notify('Automatizacija je obrisana')
        } catch (e) {
            notify(rulesService.errorMessage(e), 'fail')
        }
    }

    const killAll = async () => {
        if (!window.confirm('Iskljuciti SVE automatizacije?')) return
        try {
            const { disabled } = await rulesService.killSwitch()
            notify(`Iskljuceno automatizacija: ${disabled}`)
            loadRules()
        } catch (e) {
            notify(rulesService.errorMessage(e), 'fail')
        }
    }

    const onCreated = (created) => {
        setRules((prev) => [created, ...prev])
        setShowForm(false)
        notify(`Automatizacija "${created.rule.name}" je dodata (iskljucena — ukljucite je kada ste spremni)`)
    }

    return (
        <div>
        <div className="flex p3">
        <SideBar />
        <div className='full-width'>

            <h1>Automatizacije</h1>
                <div className='bar'>
                <button className='bar-button' onClick={() => setShowForm(true)}> Nova automatizacija </button>
                <button className='bar-button danger' onClick={killAll} disabled={!rules.some((r) => r.rule.enabled)}> Iskljuci sve </button>
                </div>

<NotificationSA/>

            {rules.length === 0
                ? <p className='empty'>Nema automatizacija. Napravite prvu — okida se downlink kada ocitavanja zadovolje uslov.</p>
                : <table className='rules-table'>
                <thead>
                    <tr>
                        <th className='tRule'>ime</th>
                        <th className='tCondition'>uslov</th>
                        <th className='tAction'>akcija</th>
                        <th className='tStatus'>status</th>
                        <th className='tActions'></th>
                    </tr>
                    </thead>
                <tbody>
                { rules.map(({ rule, clauses, action }) =>
                 <tr key={rule.id}>
                    <td>{rule.name}</td>
                    <td className='condition'>
                        {clauses.map((c, i) =>
                            <span key={c.id}>
                                {i > 0 && <span className='combinator'>{rule.combinator}</span>}
                                {deviceName(c.devId)}.{c.variable} {COMPARATOR_SYMBOL[c.comparator]} {c.threshold}
                            </span>)}
                    </td>
                    <td>downlink → {deviceName(action?.targetDevId)} <span className='hint'>"{payloadText(action?.payload)}"</span></td>
                    <td>
                        <button className={`toggle ${rule.enabled ? 'on' : ''}`} onClick={() => toggle({ rule })}>
                            {rule.enabled ? 'ukljucena' : 'iskljucena'}
                        </button>
                    </td>
                    <td>
                        <button className='row-button' onClick={() => setAuditRule({ rule, clauses, action })}>istorija</button>
                        <button className='row-button danger' onClick={() => remove({ rule })}>obrisi</button>
                    </td>
                 </tr>)}
                    </tbody>
            </table>}

            {auditRule && <RuleAudit ruleRow={auditRule} deviceName={deviceName} onClose={() => setAuditRule(null)} />}
        </div>
        </div>

            {showForm && <RuleForm devices={devices} onClose={() => setShowForm(false)} onCreated={onCreated} />}
            </div>
    )
}

export default Rules
