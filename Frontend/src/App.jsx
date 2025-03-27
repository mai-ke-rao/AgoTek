import { useState }  from 'react'
import ReactDOM from 'react-dom/client'
import {
  BrowserRouter as Router,
  Routes, Route, Link
} from 'react-router-dom'
import NavBar from './components/NavBar'
import Pocetna from './components/Pocetna'
import Parcele from './components/Parcele'
import './index.css'

const Home = () => (
  <div> <h2>TKTL notes app</h2> </div>
)

const [user, setUser] = useState(null)

const App = () => {
  

  const padding = {
    padding: 5
  }

  return (
    <div className='loader-container'>
       
      <Router>

      <NavBar/>
         <Routes>
                  <Route path="/login" element={<Login user={user} setUser={setUser}/>}/>
                  <Route path="/" element={user ? <Pocetna /> : <Navigate replace to='/login'/>} />
                  <Route path="/parcele" element={<Parcele />} />
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