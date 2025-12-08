import { useState } from 'react'

import { useNavigate } from 'react-router-dom'

import './Login.css'
import registerService from '../services/register'


const Registracija = () => {
    const [username, setUsername] = useState('') 
    const [password, setPassword] = useState('')
    const [name, setName] = useState('')
    const [errorMessage, setErrorMessage] = useState(null)
   
    const navigate = useNavigate()

    const handleLogin = async (event) => {
        event.preventDefault()
        
        try {

             await registerService.register({username,name, password})
            /*const user = await loginService.login({
              username, password,
            })
            window.localStorage.setItem(
              'loggedFarmAppUser', JSON.stringify(user)
            )
              
            setUser(user)*/
           // parcelService.setToken(user.token)
            setUsername('')
            setPassword('')
            setName('')
            navigate('/login')
          } catch (exception) {
            console.log(exception)
            setErrorMessage('Wrong credentials')
            setTimeout(() => {
              setErrorMessage(null)
            }, 5000)
          }
        }
    

      return(
        <div className='container'>
          <div className='login-box'>
            <form onSubmit={handleLogin} >
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
          name
            <input
            type="text"
            value={name}
            name="name"
            onChange={({ target }) => setName(target.value)}
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
        <button type="submit">Register</button>
      </form>
      <h4>{errorMessage}</h4>

      <div>
         <a onClick={() => navigate('/login')}>Login</a>
      </div>
        </div>
        </div>
      )



}


export default Registracija