import { useState }  from 'react'
import ReactDOM from 'react-dom/client'
import {
  BrowserRouter as Router,
  Routes, Route, Link
} from 'react-router-dom'
import '../index.css'
import '../App.css'
import './NavBar.css'

import nBell from "../assets/cowbell_9083687.png"
import mIcon from "../assets/comment-alt.png"
import pIcon from "../assets/picpeople.png"




const Navbar = () => {

const demo = {
  height: 1500
}

    const padding = {
        padding: 10,
        width: 60,
        height: 60,
      }
    return (
        <div>
         
        

<nav className="navbar">
<div className="nav-container">

 
<div className="burger" onclick="toggleMenu()">
        <div></div>
        <div></div>
        <div></div>
      </div>
      <div className="nav-links" id="navLinks">
  
  <Link to="/">Početna</Link>

  <Link to="/">Pomoć</Link>
        
  <Link to="/"><img src={nBell} className='white-filter'/> </Link>

  <Link to="/"><img src={mIcon} className='white-filter'/> </Link>

  <Link to="/" ><img src={pIcon}   className='white-filter' style={padding}/>  Aleksandar Tomic <br></br> Plac: Dedina njiva </Link>
  </div>
  </div>
</nav>




         
        
          </div>
     
      )
}

export default Navbar