import { useState, useEffect, useRef } from 'react'
import loginService from '../services/login'
import { useNavigate } from 'react-router-dom'
import parcelService from '../services/parcels'




const Login = ({user, setUser}) => {
    const [username, setUsername] = useState('') 
    const [password, setPassword] = useState('')
    const [errorMessage, setErrorMessage] = useState(null)
   
    const navigate = useNavigate()

    const handleLogin = async (event) => {
        event.preventDefault()
        console.log('logging in with', username, password)
        try {
            const user = await loginService.login({
              username, password,
            })
            window.localStorage.setItem(
              'loggedFarmAppUser', JSON.stringify(user)
            )
            setUser(user)
            parcelService.setToken(user.token)
            setUsername('')
            setPassword('')
            navigate('/')
          } catch (exception) {
            console.log(exception)
            setErrorMessage('Wrong credentials')
            setTimeout(() => {
              setErrorMessage(null)
            }, 5000)
          }
        }
    

      return(
        <div>
            <form onSubmit={handleLogin}>
        <div>
          username
            <input
            type="text"
            value={username}
            name="Username"
            onChange={({ target }) => setUsername(target.value)}
          />
        </div>
        <div>
          password
            <input
            type="password"
            value={password}
            name="Password"
            onChange={({ target }) => setPassword(target.value)}
          />
        </div>
        <button type="submit">login</button>
      </form>
      <h4>{errorMessage}</h4>

        </div>
      )



}

export default Login