const Notification = ({ message, mistake }) => {
    if (message === null) {
      return null
    }
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
    return (
      <div style={mistake? mistakeStyle:messageStyle}>
        {message}
      </div>
    )
  }
  export default Notification;