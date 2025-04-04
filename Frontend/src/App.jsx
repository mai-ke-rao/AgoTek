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
import Activities from './components/Activities'
import Weather from './components/Weather'


const Home = () => (
  <div> <h2>TKTL notes app</h2> </div>
)



const App = () => {
  const [user, setUser] = useState(JSON.parse(window.localStorage.getItem('loggedFarmAppUser')))
  const [parcels, setParcels] = useState([])
  const [chosenParcId, setChosenParcId] = useState(JSON.parse(window.localStorage.getItem('chosenParcelId')))
  
  useEffect(() => {
    const loggedUserJSON = window.localStorage.getItem('loggedFarmAppUser')
    if (loggedUserJSON) {
      const user = JSON.parse(loggedUserJSON)
      setChosenParcId(JSON.parse(window.localStorage.getItem('chosenParcelId')))
      setUser(user)
      parcelService.setToken(user.token)
     
    }
  }, [])

   useEffect(() => {
      parcelService.getAll().then(returnedParcels => 
          setParcels(returnedParcels)
      )
  
   }, [])

console.log("parcelId", chosenParcId);
console.log("user", user);



  return (
    <div className='loader-container'>
       
      <Router>

      <NavBar user={user} parcels={parcels} chosenParcId={chosenParcId}/>
         <Routes>
                  <Route path="/login" element={<Login setUser={setUser}/>}/>
                  <Route path="/" element={user ? <Pocetna /> : <Navigate replace to='/login'/>} />
                  <Route path="/parcele" element={<Parcele parcels={parcels} setParcels={setParcels} setChosenParcId={setChosenParcId}/>} />
                  <Route path="/aktivnosti" element={<Activities />} />
                  <Route path="/vremenska" element={<Weather/>}/>
                </Routes>
          
                
              </Router>
     
    </div>
  )
}
 export default App