import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { hideNotification } from '../reducers/notificationReducer'

const NotificationSA = () => {
  const dispatch = useDispatch()
  const { message, type, visible } = useSelector(
    (state) => state.notification
  )

  useEffect(() => {
    if (!visible) return

    const timer = setTimeout(() => {
      dispatch(hideNotification())
    }, 5000)

    return () => clearTimeout(timer)
  }, [visible, dispatch])

   const messageStyle = {
    color: 'green',
    background: 'lightgrey',
    fontSize: 20,
    borderStyle: 'solid',
    borderRadius: 5,
    padding: 10,
    marginTop: 10,
    marginBottom: 10
  }

  const mistakeStyle = {
    color: 'red',
    background: 'lightgrey',
    fontSize: 20,
    borderStyle: 'solid',
    borderRadius: 5,
    padding: 10,
    marginTop: 10,
    marginBottom: 10
  }

  if (!visible) return null

  return (
    <div style={type != "success"? mistakeStyle:messageStyle}>
      {message}
    </div>
  )
}

export default NotificationSA