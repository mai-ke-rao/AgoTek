import { useState } from 'react'
import ChatIcon from '../assets/comment-alt.png'
import './Chat.css'

const Chat = () => {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')

  const handleSend = () => {
    const text = input.trim()
    if (!text) return
    setMessages(prev => [...prev, { text, from: 'user' }])
    setInput('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSend()
  }

  return (
    <div className="chat-wrapper">
      {open && (
        <div className="chat-box">
          <div className="chat-header">
            <span>Chat</span>
            <button className="chat-close" onClick={() => setOpen(false)}>✕</button>
          </div>
          <div className="chat-messages">
            {messages.length === 0 && (
              <p className="chat-empty">No messages yet.</p>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`chat-message chat-message--${msg.from}`}>
                {msg.text}
              </div>
            ))}
          </div>
          <div className="chat-input-row">
            <input
              className="chat-input"
              type="text"
              placeholder="Type a message..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button className="chat-send" onClick={handleSend}>Send</button>
          </div>
        </div>
      )}
      <button className="chat-toggle" onClick={() => setOpen(prev => !prev)}>
        <img src={ChatIcon} alt="Chat" />
      </button>
    </div>
  )
}

export default Chat
