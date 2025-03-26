import { useState }  from 'react'
import ReactDOM from 'react-dom/client'
import {
  BrowserRouter as Router,
  Routes, Route, Link
} from 'react-router-dom'
import NavBar from './components/NavBar'
import Pocetna from './components/Pocetna'

const Home = () => (
  <div> <h2>TKTL notes app</h2> </div>
)

const Notes = () => (
  <div> <h2>Notes</h2> </div>
)

const Users = () => (
  <div> <h2>Users</h2> </div>
)

const App = () => {
  

  const padding = {
    padding: 5
  }

  return (
    <div>
       
      <Router>
      <NavBar/>
         <Routes>
                  <Route path="/" element={<Pocetna />} />
                  <Route path="/users" element={<Users />} />
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