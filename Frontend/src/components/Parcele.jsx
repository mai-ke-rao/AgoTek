import SideBar from './SideBar'
import emptyImage from '../assets/placeholder.png'
import './Parcele.css'
import { useEffect, useState } from 'react'
import parcelService from '../services/parcels'


const Parcele = () => {


    const [parcels, setParcels] = useState([])

 useEffect(() => {
    parcelService.getAll().then(returnedParcels => 
        setParcels(returnedParcels)
    )

 }, [])



    return(
        <div className="flex p3">
        <SideBar />
        <div className='full-width'>
            
            <h1>Parcele</h1>
            <div className='widget-page'>
            {parcels.map(parc =>
                            

                            <div className='content-widget-section' key={parc.id}>
                                <div className='widget-section'>
                                    <div className='widget-widget-section'>
                                        <div className='widget-title-widget-section'>
                                            <h2>{parc.name}</h2>
                                        </div>
                
                                        <div className='widget-content-widget-section'>
                                            <div className='sub-section-content-widget-section'>
                                                <div className='widget-content-widget-section'>
                                                    <img src={emptyImage}/>
                                                    <p> Kreirano dana: {parc.date}</p>
                                                    <p>Vrsta useva: {parc.vrsta_useva}</p>
                                                    <p>Povrsina: {parc.povrsina}</p>
                
                
                
                
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                          
                       
             )}
             </div>

        </div>
        </div>
    )
}


export default Parcele