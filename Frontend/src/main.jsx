import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import activitiesReducer from './reducers/activitiesReducer'
import notificationReducer from './reducers/notificationReducer.js'


const store = configureStore({
  reducer: {
    activities: activitiesReducer,
    notification: notificationReducer
  }
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
     <Provider store={store}>
    <App />
    </Provider>
  </StrictMode>,
)
