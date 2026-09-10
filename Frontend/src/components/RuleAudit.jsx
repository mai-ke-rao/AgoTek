import { useEffect, useState } from 'react'
import rulesService from '../services/rules'

// Fired-action history for one rule — every attempt, success or failure.
const RuleAudit = ({ ruleRow, deviceName, onClose }) => {
    const { rule } = ruleRow
    const [rows, setRows] = useState([])
    const [page, setPage] = useState(1)

    useEffect(() => {
        rulesService.getAudit(rule.id, page).then(setRows).catch(() => setRows([]))
    }, [rule.id, page])

    // snapshot keys are "devId:variable" (plus fCnt, which isn't a reading)
    const snapshotEntries = (snapshot) =>
        Object.entries(snapshot ?? {})
            .filter(([key]) => key !== 'fCnt')
            .map(([key, value]) => {
                const sep = key.indexOf(':')
                return `${deviceName(key.slice(0, sep))}.${key.slice(sep + 1)} = ${value}`
            })

    return (
        <div>
            <div className='audit-header'>
                <h3>Istorija: {rule.name}</h3>
                <button className='row-button' onClick={onClose}>zatvori</button>
            </div>

            {rows.length === 0 && page === 1
                ? <p className='empty'>Jos nije okinuta.</p>
                : <table className='audit-table'>
                <thead>
                    <tr>
                        <th>vreme</th>
                        <th>status</th>
                        <th>vrednosti</th>
                        <th>cilj</th>
                        <th>detalj</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) =>
                        <tr key={row.id}>
                            <td>{new Date(row.firedAt).toLocaleString()}</td>
                            <td className={row.status === 'ok' ? 'status-ok' : 'status-failed'}>{row.status}</td>
                            <td className='condition'>{snapshotEntries(row.snapshot).join(', ')}</td>
                            <td>{deviceName(row.targetDevId)}</td>
                            <td>{row.detail ?? ''}</td>
                        </tr>)}
                </tbody>
            </table>}

            <div className='pager'>
                <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
                <button disabled={rows.length < 15} onClick={() => setPage(page + 1)}>Next</button>
            </div>
        </div>
    )
}

export default RuleAudit
