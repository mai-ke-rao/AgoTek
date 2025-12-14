import { useState }  from 'react'
import ReactDOM from 'react-dom/client'
import {
  BrowserRouter as Router,
  Routes, Route, Link, useNavigate
} from 'react-router-dom'
import '../index.css'
import '../App.css'
import './NavBar.css'

import nBell from "../assets/cowbell_9083687.png"
import mIcon from "../assets/comment-alt.png"
import pIcon from "../assets/picpeople.png"




const Navbar = ({user, parcels, chosenParcId}) => {

  const navigate = useNavigate()

const [showBurger, setShowBurger] = useState(false)


const pickedParc = () => {

  console.log("NavBar rerender");
  
  const chosen = parcels.find(parc => parc.id == chosenParcId)
  console.log("Chosen", chosen);
  
  return  chosen ? chosen.name : ""


}

const handleLogout = () => {
  localStorage.clear();
  navigate('/login')
  window.location.reload();
}
 
const demo = {
  height: 1500
}

    const padding = {
        padding: 10,
        width: 60,
        height: 60,
      }


const toggleDrop = () => {

  setShowBurger(!showBurger)
  return
}

    return (
        <div>
         
        

<nav className="navbar">
<div className="nav-container">

 
<div className="burger" onClick={() => toggleDrop()}>
        <div></div>
        <div></div>
        <div></div>
        
      </div>
      <div className="nav-links" id="navLinks">
  
  <Link to="/">Početna</Link>

  <Link to="/">Pomoć</Link>
        
  <Link to="/"><img src={nBell} className='white-filter'/> </Link>

  <Link to="/"><img src={mIcon} className='white-filter'/> </Link>

  <Link to="/" ><img src={pIcon}   className='white-filter' style={padding}/> Ime: {user ? user.username: ""} <br></br> Plac: {pickedParc()} </Link>
  
  
  <button className='logout' onClick={() => handleLogout()}>
  Odjava
  </button>
  
  </div>
  </div>
</nav>

{showBurger? <DropDown/> : null}

         
        
          </div>
     
      )
}


const DropDown = () => {



  return(
    <>

<Link to="/"   className='no-link-style' onClick={() => toggleDrop()}>
<div className="burger-dropdown">
<h3>Pocetna</h3>
</div>
</Link>

    <Link to="/vremenska"   className='no-link-style' onClick={() => toggleDrop()}>
<div className="burger-dropdown">
<h3>Vremenska prognoza</h3>
</div>
</Link>

 <Link to="/parcele"  className='no-link-style' onClick={() => toggleDrop()}>
<div className="burger-dropdown">
<h3>Parcele</h3>
</div>
</Link>

 <Link to="/aktivnosti"  className='no-link-style' onClick={() => toggleDrop()}>
<div className="burger-dropdown">
<h3>Aktivnosti</h3>
</div>
</Link>

 <Link to="/uredjaji"  className='no-link-style' onClick={() => toggleDrop()}>
<div className="burger-dropdown">
<h3>Uredjaji</h3>
</div>
</Link>

</>
  )
}

export default Navbar