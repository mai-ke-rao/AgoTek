import { useState, useEffect }  from 'react'
import ReactDOM from 'react-dom/client'
import {
  BrowserRouter as Router,
  Routes, Route, Link, Navigate
} from 'react-router-dom'
import NavBar from './components/NavBar'
import Pocetna from './components/Pocetna'
import Parcele from './components/Parcele'
import Login from './components/Login'
import './index.css'
import parcelService from './services/parcels'
import activitiesService from './services/activities'
import devicesService from './services/devices'
import Activities from './components/Activities'
import Weather from './components/Weather'
import Devices from './components/Devices'
import DeviceMenu from './components/DeviceMenu'
import Integrations from './components/Integrations'
import Registracija from './components/Registracija'



const App = () => {
  const [user, setUser] = useState(JSON.parse(window.localStorage.getItem('loggedFarmAppUser')))
  const [parcels, setParcels] = useState([])
  const [chosenParcId, setChosenParcId] = useState(JSON.parse(window.localStorage.getItem('chosenParcelId')))
  const [deviceList, setDeviceList] = useState([])
  const [chosenDev, setChosenDev] = useState(
    {
      name: "",
      hook_id: "",
      dev_id:"",
      app_id:""
    }
  )
  
  
  useEffect(() => {
    const loggedUserJSON = window.localStorage.getItem('loggedFarmAppUser')
    if (loggedUserJSON) {
      const user = JSON.parse(loggedUserJSON)
      setChosenParcId(JSON.parse(window.localStorage.getItem('chosenParcelId')))
      setUser(user)
      parcelService.setToken(user.token)
      activitiesService.setToken(user.token)
      devicesService.setToken(user.token)
      parcelService.getAll().then(returnedParcels => 
        setParcels(returnedParcels)
    )
     
    }
  }, [])
/*
   useEffect(() => {
    const loggedUserJSON = window.localStorage.getItem('loggedFarmAppUser')
    if (loggedUserJSON) {
      parcelService.getAll().then(returnedParcels => 
          setParcels(returnedParcels)
           
      )
       }
  
   }, [])*/

console.log("parcels: ", parcels);
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
                  <Route path="/aktivnosti" element={<Activities chosenParcId={chosenParcId}/>} />
                  <Route path="/vremenska" element={<Weather/>}/>
                  <Route path="/uredjaji" element={<Devices setChosenDev={setChosenDev} deviceList={deviceList} setDeviceList={setDeviceList}/>}/>
                  <Route path="/device_menu" element={<DeviceMenu chosenDev={chosenDev}/>}/>
                  <Route path="/integrations" element={<Integrations  deviceList={deviceList} setDeviceList={setDeviceList}/>}/>
                  <Route path="/registracija" element={<Registracija/>}/>
                </Routes>
          
                
              </Router>
     
    </div>
  )
}
 export default App