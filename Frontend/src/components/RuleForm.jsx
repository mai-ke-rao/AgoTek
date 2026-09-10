import { useState } from 'react'
import { useDispatch } from 'react-redux'
import closeIcon from '../assets/cancel.png'
import rulesService, { COMPARATOR_SYMBOL } from '../services/rules'
import devicesService from '../services/devices'
import { setNotification } from '../reducers/notificationReducer'

const MAX_CLAUSES = 5

const emptyClause = () => ({ devId: '', variable: '', comparator: 'gt', threshold: '' })

const RuleForm = ({ devices, onClose, onCreated }) => {
    const dispatch = useDispatch()
    const [formData, setFormData] = useState({
        name: '',
        combinator: 'AND',
        clauses: [emptyClause()],
        targetDevId: '',
        payloadText: '',
        enabled: false,
    })
    // variable names seen in each device's recent telemetry, fetched on demand
    const [variables, setVariables] = useState({})
    const [submitting, setSubmitting] = useState(false)

    const fail = (message) => dispatch(setNotification({ message, type: 'fail', visible: true }))

    const handleChange = (event) => {
        const { name, value, type, checked } = event.target
        setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
    }

    const handleClauseChange = (index, field, value) => {
        setFormData((prev) => ({
            ...prev,
            clauses: prev.clauses.map((c, i) => (i === index ? { ...c, [field]: value } : c)),
        }))
        if (field === 'devId' && value && !variables[value]) loadVariables(value)
    }

    // There's no "variables per device" endpoint; the first page of readings
    // is enough to list what the device actually reports.
    const loadVariables = (devId) => {
        devicesService.getDataPage(devId, 1)
            .then((rows) => setVariables((prev) => ({ ...prev, [devId]: [...new Set(rows.map((r) => r.name))] })))
            .catch(() => setVariables((prev) => ({ ...prev, [devId]: [] })))
    }

    const addClause = () => setFormData((prev) => ({ ...prev, clauses: [...prev.clauses, emptyClause()] }))
    const removeClause = (index) =>
        setFormData((prev) => ({ ...prev, clauses: prev.clauses.filter((_, i) => i !== index) }))

    const handleSubmit = async (event) => {
        event.preventDefault()

        if (!formData.name.trim()) return fail('Unesite ime automatizacije')
        for (const [i, c] of formData.clauses.entries()) {
            if (!c.devId || !c.variable.trim()) return fail(`Uslov ${i + 1}: izaberite uredjaj i promenljivu`)
            if (c.threshold === '' || Number.isNaN(Number(c.threshold))) return fail(`Uslov ${i + 1}: prag mora biti broj`)
        }
        if (!formData.targetDevId) return fail('Izaberite uredjaj kome se salje downlink')
        if (!formData.payloadText) return fail('Unesite sadrzaj downlink-a')

        const rule = {
            name: formData.name.trim(),
            combinator: formData.combinator,
            enabled: formData.enabled,
            clauses: formData.clauses.map((c) => ({
                devId: c.devId,
                variable: c.variable.trim(),
                comparator: c.comparator,
                threshold: Number(c.threshold),
            })),
            action: {
                type: 'downlink',
                targetDevId: formData.targetDevId,
                payload: rulesService.buildDownlinkPayload(formData.payloadText),
            },
        }

        setSubmitting(true)
        try {
            onCreated(await rulesService.create(rule))
        } catch (e) {
            fail(rulesService.errorMessage(e))
        } finally {
            setSubmitting(false)
        }
    }

    const deviceOptions = devices.map((d) => <option key={d.dev_id} value={d.dev_id}>{d.name} ({d.dev_id})</option>)

    return (
            <div className='dialog'>
                <div className='dialog-container'>
                    <div className='loader-container'>
                        <div>
                            <div className='flex full-width justify-right' onClick={onClose}>
                                <img src={closeIcon}></img>
                                </div>
                                <h2>Nova automatizacija</h2><br></br>

                                <form className='rule-form' onSubmit={handleSubmit}>

                                    <div className='field-row'>
                                        <label htmlFor='name'>Ime</label>
                                        <input type='text' name='name' value={formData.name} onChange={handleChange} />
                                    </div>

                                    <div className='field-row'>
                                        <label>Uslov</label>
                                        <span className='hint'>svi (AND) ili bilo koji (OR) od uslova, na poslednjoj vrednosti</span>
                                    </div>

                                    {formData.clauses.map((clause, i) =>
                                        <div className='clause-row' key={i}>
                                            {i > 0
                                                ? <select name='combinator' value={formData.combinator} onChange={handleChange} disabled={i > 1}>
                                                    <option value='AND'>AND</option>
                                                    <option value='OR'>OR</option>
                                                  </select>
                                                : <span style={{ width: 62 }}>ako</span>}
                                            <select value={clause.devId} onChange={(e) => handleClauseChange(i, 'devId', e.target.value)}>
                                                <option value=''>-- uredjaj --</option>
                                                {deviceOptions}
                                            </select>
                                            <input list={`vars-${i}`} placeholder='promenljiva' value={clause.variable}
                                                onChange={(e) => handleClauseChange(i, 'variable', e.target.value)} />
                                            <datalist id={`vars-${i}`}>
                                                {(variables[clause.devId] ?? []).map((v) => <option key={v} value={v} />)}
                                            </datalist>
                                            <select value={clause.comparator} onChange={(e) => handleClauseChange(i, 'comparator', e.target.value)}>
                                                {Object.entries(COMPARATOR_SYMBOL).map(([k, s]) => <option key={k} value={k}>{s}</option>)}
                                            </select>
                                            <input className='threshold' type='number' step='any' placeholder='prag' value={clause.threshold}
                                                onChange={(e) => handleClauseChange(i, 'threshold', e.target.value)} />
                                            {formData.clauses.length > 1 &&
                                                <button type='button' className='row-button danger' onClick={() => removeClause(i)}>x</button>}
                                        </div>)}

                                    {formData.clauses.length < MAX_CLAUSES &&
                                        <button type='button' className='row-button' onClick={addClause}>+ uslov</button>}

                                    <br></br><br></br>

                                    <div className='field-row'>
                                        <label htmlFor='targetDevId'>Posalji downlink na</label>
                                        <select name='targetDevId' value={formData.targetDevId} onChange={handleChange}>
                                            <option value=''>-- uredjaj --</option>
                                            {deviceOptions}
                                        </select>
                                    </div>

                                    <div className='field-row'>
                                        <label htmlFor='payloadText'>Downlink</label>
                                        <input type='text' name='payloadText' value={formData.payloadText} onChange={handleChange} />
                                        <span className='hint'>isti format kao na "send downlink"</span>
                                    </div>

                                    <div className='field-row'>
                                        <label htmlFor='enabled'>Odmah ukljuci</label>
                                        <input type='checkbox' name='enabled' checked={formData.enabled} onChange={handleChange} />
                                        <span className='hint'>okida pravi hardver — podrazumevano iskljuceno</span>
                                    </div>

                                    <div className='bar'>
                <button className='bar-button' type="submit" disabled={submitting}> Sacuvaj </button>
                </div>

                                </form>
                        </div>
                    </div>
                </div>
            </div>
    )
}

export default RuleForm
