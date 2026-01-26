import SideBar from './SideBar'
import emptyImage from '../assets/placeholder.png'
import './Parcele.css'
import './Devices.css'
import { useEffect, useState } from 'react'
import parcelService from '../services/parcels'
import closeIcon from '../assets/cancel.png'
import {
    Link
 } from 'react-router-dom'
import Notification from './Notification'



const Parcele = ({parcels, setParcels, setChosenParcId}) => {


    
const [showDialog, setShowDialog] = useState(false)
const [showNotification, setShowNotification] = useState(false); 

    

 useEffect(() => {
    if (!showNotification) return;

    const timer = setTimeout(() => {
      setShowNotification(false);
    }, 5000); 

    //  Cleanup to prevent memory leaks
    return () => clearTimeout(timer);
  }, [showNotification])

 const choiceHandler = (parcId) => {

    window.localStorage.setItem(
        'chosenParcelId', JSON.stringify(parcId)
      )
      setChosenParcId(parcId)
      

 }

 useEffect(() => {

    parcelService.getAll().then(returnedParcels => 
        setParcels(returnedParcels))

        setChosenParcId(JSON.parse(window.localStorage.getItem('chosenParcelId')))
 }, [])


    return(
        <div className="flex p3">
        <SideBar />
        <div className='full-width'>
            
            <h1>Parcele</h1>
             <div className='bar'>
                <button className='bar-button' onClick={()=>setShowDialog(true)}> Dodaj parcelu </button>
                </div>
                {showNotification && (<Notification message={"Uspesno kreirana parcela"} mistake={false}/>)}
            <div className='widget-page'>
            {parcels.map(parc =>
                            
                        <Link to='/' key={parc.id} onClick={() => choiceHandler(parc.id)} className='reset-link'>
                            <div className='content-widget-section'>
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
                            </Link>
                          
                       
             )}
             </div>

        </div>
           {showDialog? <FormDialog setShowDialog={setShowDialog} parcels={parcels} setParcels={setParcels} setShowNotification={setShowNotification}/>:null}
        </div>
    )
}



const FormDialog = ({setShowDialog, parcels, setParcels, setShowNotification}) => {

    const [formData, setFormData] = useState(
        {
            name:"",
            vrsta_useva:"",
            povrsina: "",
           
        }
    )
    const handleSubmit = async (event) => {
        event.preventDefault();
        
        const newParcel = await parcelService.addNew(formData)
        if(newParcel){
            setShowNotification(true)
            setParcels([...parcels, newParcel])
        
        }
        
        setShowDialog(false)
        
    }


    const hadnleChange = (event) => {
        const { name , value } = event.target;
        setFormData((prevState) =>  ({ ...prevState, [name]: value}))
    }
    
    return(
            <div className='dialog'>
                <div className='dialog-container'>
                    <div className='loader-container'>
                        <div>
                            <div className='flex full-width justify-right' onClick={() => setShowDialog(false)}>
                                <img src={closeIcon}></img>
                                </div>
                                <h2>Dodaj parcelu</h2><br></br>
                                <br></br><br></br>
                            <div className='flex column gap-5'>
                                <form className='form-container full-width' onSubmit={handleSubmit}>
                            <div className='input-container'>
                                <div className='display-block'>
                                <div className='input-item'>
                                    <div className='label-container'>
                                        <label htmlFor='name'><strong>Ime</strong> </label>
                                    </div>
                                    <div className='.iui-input-container'>
                                        <input type='text' name='name' value={formData['name']} onChange={hadnleChange}></input>
                                    </div>
                                    </div>
                                    </div>
                                    </div>

                                    <div className='input-container'>
                                    <div className='display-block'>
                                    <div className='input-item'>
                                    <div className='label-container'>
                                        <label htmlFor='vrsta_useva'><strong>vrste useva</strong> </label>
                                    </div>
                                    <div className='.iui-input-container'>
                                        <input type='text' name='vrsta_useva' value={formData['vrsta_useva']} onChange={hadnleChange}></input>
                                    </div>
                                    </div>
                                    </div>
                                    </div>

                                    <div className='input-container'>
                                    <div className='display-block'>
                                    <div className='input-item'>
                                    <div className='label-container'>
                                        <label htmlFor='povrsina'><strong>povrsina u hektarima</strong> </label>
                                    </div>
                                    <div className='.iui-input-container'>
                                        <input type='text' name='povrsina' value={formData['povrsina']} onChange={hadnleChange}></input>
                                    </div>
                                    </div>
                                    </div>
                                    </div>

                                



                        

                                    
                                    <div className='bar'>
                <button className='bar-button' type="submit" > Dodaj parcelu </button>
                </div>

                                    
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
                
            </div>

    )
}


export default Parcele