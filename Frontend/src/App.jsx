import { useState, useEffect }  from 'react'
import ReactDOM from 'react-dom/client'
import {
  BrowserRouter as Router,
  Routes, Route, Link, useNavigate, Navigate
} from 'react-router-dom'
import NavBar from './components/NavBar'
import Pocetna from './components/Pocetna'
import Parcele from './components/Parcele'
import Login from './components/Login'
import './index.css'
import parcelService from './services/parcels'

const Home = () => (
  <div> <h2>TKTL notes app</h2> </div>
)



const App = () => {
  const [user, setUser] = useState(null)


  const [parcels, setParcels] = useState([])
  const [chosenParcId, setChosenParcId] = useState(null)
  
  useEffect(() => {
    const loggedUserJSON = window.localStorage.getItem('loggedFarmAppUser')
    if (loggedUserJSON) {
      const user = JSON.parse(loggedUserJSON)
      setUser(user)
      parcelService.setToken(user.token)
    }
  }, [])



  return (
    <div className='loader-container'>
       
      <Router>

      <NavBar user={user} parcels={parcels} chosenParcId={chosenParcId}/>
         <Routes>
                  <Route path="/login" element={<Login setUser={setUser}/>}/>
                  <Route path="/" element={user ? <Pocetna /> : <Navigate replace to='/login'/>} />
                  <Route path="/parcele" element={<Parcele parcels={parcels} setParcels={setParcels} setChosenParcId={setChosenParcId}/>} />
                  <Route path="/notes" element={<Home />} />
                </Routes>
          
                <div>
                  <i>Note app, Department of Computer Science 2024</i>
                </div>
              </Router>
     
    </div>
  )
}
 export default App