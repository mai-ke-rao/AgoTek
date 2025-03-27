
import './Pocetna.css'
import weatherIcon from '../assets/Weather.png'
import pcbIcon from '../assets/PCB.png'
import analizaIcon from '../assets/Analiza.png'
import dashboardIcon from '../assets/Dashboard.png'
import meteoIcon from '../assets/Meteo.png'
import parceleIcon from '../assets/Parcele.png'
import aktivnostIcon from '../assets/Aktivnost.svg'
import {
    BrowserRouter as Router,
    Routes, Route, Link
  } from 'react-router-dom'

const Pocetna = () => {



    return(
        
        <div className="page-content"> 
            <div className="dashboard-widget-container">
                <div className='widget'>
                <img src={weatherIcon}></img>
                <div>
                    <h2>Vremenska prognoza</h2>
                    <br></br>
                    <p>Podaci preuzeti sa Norveskog meteroloskog instituta</p>
                </div>

                </div>


            
                <div className='widget'>
                <img src={meteoIcon}></img>
                <div>
                    <h2>Meteo podaci</h2>
                    <br></br>
                    <p>Prikazuje podatke sa meteronloskih stanica najblizih odabranoj parceli</p>
                </div>

                </div>

                <Link to='/parcele' className='no-link-style'>
                <div className='widget'>
                <img src={parceleIcon}></img>
                <div>
                    <h2>Parcele</h2>
                    <br></br>
                    <p>Pregled, promena, unos i odabir parcela. Podaci o parceli omogucavaju dobivanje preporuka relevatnih za vase imanje. 
                        Omoguci stakeholderima ili investitorima uvid u podatke.
                    </p>
                </div>

                </div>
                </Link>

                <div className='widget'>
                <img src={analizaIcon}></img>
                <div>
                    <h2>Analiza zemljista</h2>
                    <br></br>
                    <p>Pregled i unos podataka o radjenoj analizi zemljista.</p>
                </div>

                </div>


                <div className='widget'>
                <img src={aktivnostIcon}></img>
                <div>
                    <h2>Aktivnosti</h2>
                    <br></br>
                    <p>Unesi podatke o Sadnji/Zetvi, Djubrenju, Negi useva, Obradi zemljista ili Djubrenju</p>
                </div>

                </div>


                <div className='widget'>
                <img src={pcbIcon}></img>
                <div>
                    <h2>Uredjaji</h2>
                    <br></br>
                    <p>Povezi pametne LoraWAN uredjaje sa The Things Network-om. </p>
                </div>

                </div>


            </div>

        </div>
        
        
    )
}

export default Pocetna