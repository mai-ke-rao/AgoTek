import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import ChatIcon from '../assets/comment-alt.png'
import assistantService from '../services/assistant'
import './Chat.css'

const TEXT = {
  sr: {
    title: 'AgroTek asistent',
    empty: 'Pitajte o priručnicima, svojim parcelama, uređajima ili automatizacijama. Svaki odgovor navodi izvore.',
    placeholder: 'Postavite pitanje…',
    send: 'Pošalji',
    thinking: 'Razmišljam…',
    page: 'str.',
    open: 'Otvori',
    openPdf: 'Otvori PDF',
    partial: 'Delimičan odgovor. Nedostaje:',
    proposal: 'Predlog automatizacije',
    confirm: 'Potvrdi',
    reject: 'Odbaci',
    confirmed: 'Pravilo je napravljeno i isključeno. Uključite ga na stranici',
    rejected: 'Predlog je odbačen.',
    rulesPage: 'Automatizacije',
    error: 'Greška. Pokušajte ponovo.',
  },
  en: {
    title: 'AgroTek assistant',
    empty: 'Ask about the manuals, your parcels, devices or automations. Every answer cites its sources.',
    placeholder: 'Ask a question…',
    send: 'Send',
    thinking: 'Thinking…',
    page: 'p.',
    open: 'Open',
    openPdf: 'Open PDF',
    partial: 'Partial answer. Not covered:',
    proposal: 'Automation proposal',
    confirm: 'Confirm',
    reject: 'Reject',
    confirmed: 'Rule created and disabled. Enable it on the',
    rejected: 'Proposal rejected.',
    rulesPage: 'Automations page',
    error: 'Something went wrong. Please try again.',
  },
}

const HISTORY_TURNS = 8

const readLang = () => {
  try { return window.localStorage.getItem('assistantLang') === 'en' ? 'en' : 'sr' } catch { return 'sr' }
}

// Inline markdown: **bold** and [S1]/[D2] citation chips. Rendered as React
// elements, never as HTML.
const Inline = ({ text, citations, onCite }) => {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[SD]\d+\])/g)
  return parts.map((part, i) => {
    const tag = part.match(/^\[([SD]\d+)\]$/)
    if (tag) {
      const known = citations.some((c) => c.tag === tag[1])
      return known
        ? <button key={i} className={`chat-chip chat-chip--${tag[1][0]}`} onClick={() => onCite(tag[1])}>{tag[1]}</button>
        : null
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>
    return <span key={i}>{part}</span>
  })
}

// Same unit split the server validates: headings, list items, paragraphs.
const Markdown = ({ text, citations, onCite }) => {
  const blocks = []
  let list = null
  for (const line of text.split('\n')) {
    if (!line.trim()) { list = null; continue }
    const heading = line.match(/^\s{0,3}#{1,6}\s+(.*)$/)
    const item = line.match(/^\s*(?:[-*•+]|\d{1,3}[.)])\s+(.*)$/)
    if (heading) { list = null; blocks.push({ type: 'h', text: heading[1] }) }
    else if (item) {
      if (!list) { list = { type: 'ul', items: [] }; blocks.push(list) }
      list.items.push(item[1])
    } else {
      list = null
      const last = blocks[blocks.length - 1]
      if (last && last.type === 'p' && last.open) last.text += ' ' + line
      else blocks.push({ type: 'p', text: line, open: true })
    }
  }
  return blocks.map((b, i) => {
    if (b.type === 'h') return <p key={i} className="chat-md-heading"><Inline text={b.text} citations={citations} onCite={onCite} /></p>
    if (b.type === 'ul') return <ul key={i}>{b.items.map((t, j) => <li key={j}><Inline text={t} citations={citations} onCite={onCite} /></li>)}</ul>
    return <p key={i}><Inline text={b.text} citations={citations} onCite={onCite} /></p>
  })
}

const Citation = ({ citation, t, onClose }) => (
  <div className="chat-citation">
    <div className="chat-citation-head">
      <span className={`chat-chip chat-chip--${citation.tag[0]}`}>{citation.tag}</span>
      <strong>{citation.documentTitle}</strong>
      <button className="chat-citation-close" onClick={onClose} aria-label="close">✕</button>
    </div>
    {citation.page && (
      <div className="chat-citation-meta">
        {t.page} {citation.page}{citation.pageEnd && citation.pageEnd !== citation.page ? `–${citation.pageEnd}` : ''}
      </div>
    )}
    <blockquote>{citation.snippet}{citation.snippet && citation.snippet.length >= 300 ? '…' : ''}</blockquote>
    {citation.sourceUrl && (citation.kind === 'data'
      ? <Link to={citation.sourceUrl}>{t.open} →</Link>
      : <a href={assistantService.manualHref(citation.sourceUrl)} target="_blank" rel="noopener noreferrer">{t.openPdf} →</a>)}
  </div>
)

const Proposal = ({ proposal, t, onDecide }) => (
  <div className="chat-proposal">
    <div className="chat-proposal-title">{t.proposal}</div>
    <div className="chat-proposal-summary">{proposal.summary}</div>
    {proposal.warnings?.map((w, i) => <div key={i} className="chat-proposal-warning">⚠️ {w}</div>)}
    {proposal.state === 'confirmed' && (
      <div className="chat-proposal-done">{t.confirmed} <Link to="/automatizacije">{t.rulesPage}</Link>.</div>
    )}
    {proposal.state === 'rejected' && <div className="chat-proposal-done">{t.rejected}</div>}
    {proposal.error && <div className="chat-proposal-warning">{proposal.error}</div>}
    {(!proposal.state || proposal.state === 'pending') && (
      <div className="chat-proposal-actions">
        <button className="chat-proposal-confirm" disabled={proposal.busy} onClick={() => onDecide(proposal.id, 'confirm')}>{t.confirm}</button>
        <button className="chat-proposal-reject" disabled={proposal.busy} onClick={() => onDecide(proposal.id, 'reject')}>{t.reject}</button>
      </div>
    )}
  </div>
)

const Chat = () => {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [lang, setLang] = useState(readLang)
  const [openCitation, setOpenCitation] = useState(null) // { msg, tag }
  const endRef = useRef(null)
  const t = TEXT[lang]

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [messages, busy, openCitation])

  const toggleLang = () => {
    const next = lang === 'sr' ? 'en' : 'sr'
    setLang(next)
    try { window.localStorage.setItem('assistantLang', next) } catch { /* private mode */ }
  }

  const handleSend = async () => {
    const question = input.trim()
    if (!question || busy) return
    const history = messages
      .filter((m) => !m.error)
      .slice(-HISTORY_TURNS)
      .map((m) => ({ role: m.from === 'user' ? 'user' : 'assistant', text: m.text }))
    setMessages((prev) => [...prev, { from: 'user', text: question }])
    setInput('')
    setBusy(true)
    try {
      const res = await assistantService.ask(question, lang, history)
      setMessages((prev) => [...prev, {
        from: 'assistant',
        text: res.answer,
        status: res.status,
        missing: res.missing || [],
        citations: res.citations || [],
        proposals: res.proposals || [],
      }])
    } catch (e) {
      setMessages((prev) => [...prev, { from: 'assistant', error: true, text: assistantService.errorMessage(e, t.error), citations: [], proposals: [] }])
    } finally {
      setBusy(false)
    }
  }

  const updateProposal = (id, changes) => setMessages((prev) => prev.map((m) => (
    m.proposals ? { ...m, proposals: m.proposals.map((p) => (p.id === id ? { ...p, ...changes } : p)) } : m
  )))

  const decide = async (id, action) => {
    updateProposal(id, { busy: true, error: null })
    try {
      const res = action === 'confirm'
        ? await assistantService.confirmProposal(id)
        : await assistantService.rejectProposal(id)
      updateProposal(id, { busy: false, state: res.status })
    } catch (e) {
      updateProposal(id, { busy: false, error: assistantService.errorMessage(e, t.error) })
    }
  }

  return (
    <div className="chat-wrapper">
      {open && (
        <div className="chat-box">
          <div className="chat-header">
            <span>{t.title}</span>
            <div className="chat-header-actions">
              <button className="chat-lang" onClick={toggleLang} title="Jezik / Language">{lang.toUpperCase()}</button>
              <button className="chat-close" onClick={() => setOpen(false)} aria-label="close">✕</button>
            </div>
          </div>
          <div className="chat-messages">
            {messages.length === 0 && <p className="chat-empty">{t.empty}</p>}
            {messages.map((msg, i) => (
              <div key={i} className={`chat-message chat-message--${msg.from}${msg.error ? ' chat-message--error' : ''}`}>
                {msg.from === 'user' || msg.error
                  ? msg.text
                  : <Markdown text={msg.text} citations={msg.citations} onCite={(tag) => setOpenCitation({ msg: i, tag })} />}
                {msg.status === 'partial' && msg.missing.length > 0 && (
                  <div className="chat-missing">{t.partial} {msg.missing.join('; ')}</div>
                )}
                {openCitation && openCitation.msg === i && (
                  <Citation
                    citation={msg.citations.find((c) => c.tag === openCitation.tag)}
                    t={t}
                    onClose={() => setOpenCitation(null)}
                  />
                )}
                {msg.proposals?.map((p) => <Proposal key={p.id} proposal={p} t={t} onDecide={decide} />)}
              </div>
            ))}
            {busy && <div className="chat-message chat-message--assistant chat-thinking">{t.thinking}</div>}
            <div ref={endRef} />
          </div>
          <div className="chat-input-row">
            <input
              className="chat-input"
              type="text"
              placeholder={t.placeholder}
              value={input}
              maxLength={2000}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSend() }}
            />
            <button className="chat-send" onClick={handleSend} disabled={busy}>{t.send}</button>
          </div>
        </div>
      )}
      <button className="chat-toggle" onClick={() => setOpen((prev) => !prev)} aria-label={t.title}>
        <img src={ChatIcon} alt="" />
      </button>
    </div>
  )
}

export default Chat
