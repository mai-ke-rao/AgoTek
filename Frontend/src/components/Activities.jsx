import SideBar from './SideBar'
import './Activities.css'
import {useState, useEffect} from 'react'
import  {setActivities, addActivitiy} from '../reducers/activitiesReducer'
import { useDispatch } from 'react-redux'
import activitiesService from '../services/activities'

import ActivitiesPreview from './activitiesPreview'
import PopNotification from './PopNotification'
import ZetvaBerba from './ActivityForms/ZetvaBerba'




const Activities = ({chosenParcId}) => {

  
    const [showA, setShowA] = useState(false)
    const [disableForm, setDisableForm] = useState(false)
    const dispatch = useDispatch()

    const [formData, setFormData] = useState({
        'datum_od':"",
        'datum_do':"",
        'activityType':"",
        
      });

    useEffect(() => {
        //nalazi sve aktinvosti izabrane parcele i setuje aktivnosti sa tom vrednoscu
        const loggedUserJSON = window.localStorage.getItem('loggedFarmAppUser')
    if (loggedUserJSON) {
      const user = JSON.parse(loggedUserJSON)
       activitiesService.setToken(user.token)
       if(!chosenParcId) 
        {
             
            return
        }

        activitiesService.getAll(chosenParcId).then(activities => dispatch(setActivities(activities)))
    }
       
    }, [])
   
    
    if(!chosenParcId) return(
        <PopNotification message={"Moras odabrati parcelu za ovu funkcionalnost"} />
    )

    return(
        <div className="flex p3">
        <SideBar />
        <div className='full-width'>
            
            <h1>Aktivnosti</h1>
            <div className='bar'>
                <button className='bar-button' onClick={() => {setShowA(!showA); setDisableForm(false); setFormData({
        'datum_od':"",
        'datum_do':"",
        'activityType':"",
       
      })}}><h4>Nova aktivnost</h4></button>
            </div>
            <div className='activities-container'>
            <div  className='group'>
            <div className='sub-item'></div>
             </div>
           

            <ActivityForm showA={showA} chosenParcId={chosenParcId} setShowA={setShowA} disableForm={disableForm} setDisableForm={setDisableForm} setFormData={setFormData} formData={formData}/>
            <div>

            </div>
           

            </div>
            
 
            <div  className='group'> 
            <div className='sub-item'></div>
            </div>
        </div>

        </div>
    )


}



const ActivityForm = ({showA, chosenParcId, setShowA, disableForm, setDisableForm, formData, setFormData}) => {

    /*const [vrstaAktivnost, setVrstaAktivnosti] = useState("")*/
    const dispatch = useDispatch()
  
    const [submitEnable, setSubmitEnable] = useState(false)

    useEffect(() => {


    const dates = validateHelper(formData)
switch (formData['activityType']){
    case 'obrada':
        if(formData['tip_obrade'].length > 0 && dates)
        {
            setSubmitEnable(true)
            return 
        }
        else{
            setSubmitEnable(false)
        return 
        }

    default:
        setSubmitEnable(true)
        return 
}


    }, [formData])
      

      const handleChange = (event) => {
        const { name, value } = event.target;
        setFormData((prevState) => ({ ...prevState, [name]: value }));
        
      };
    

      
const validateHelper = (formObject) => {
    if(formObject['datum_od'] != "" && formObject['datum_do'] != ""){
        return true;

    }
    else {
        return false;
    }
}



    




   if(!showA){
    
    return (<div className='act-form-container group'>
    
    
    <ActivitiesPreview setFormData={setFormData} setShowA={setShowA} setDisableForm={setDisableForm}/>
    </div>)
   }



   const handleSubmit = async (event) => {
    event.preventDefault();
    
    const finalObject = formData
    finalObject["parcel"] = chosenParcId
    /*const formObject = 
    {
        
        "datum_od": formData['datum_od'],
        "datum_do": formData['datum_do'],
        "activityType": formData['activityType'],
        "tip_obrade": formData['tip_obrade'],
        "dubina": formData['dubina'],
        "komentar": formData['komentar'],
        "cena_operacije_h": formData['cena_operacije_h'],
        "cena_operacije_p": formData['cena_operacije_p'],
        "parcel":chosenParcId
    
    }*/

    console.log("final object", finalObject);
    
    const newActivity = await activitiesService.addNew(finalObject)
    dispatch(addActivitiy(newActivity))
    setShowA(false)

    //common validate here, and specific validate (later add)


    
  };

  

    return(
        <div className='act-form-container group'>
        <div className='border'>
        <button className='border-button'><strong>Nova aktivnost </strong>
        </button>
        
        
        <form onSubmit={handleSubmit}>
    <div className='form-grid'>
        

    <div  className='grid-form-el'>

    <label htmlFor='datum_od' >datum od:</label><label htmlFor='datum_od' style={{color:'red'}}>*</label><br></br>
    <input type='date' name='datum_od' id='datum_od'   onChange={handleChange} value={formData['datum_od']} disabled={disableForm}>
    </input>
    
    </div>

    <div  className='grid-form-el'>

    <label htmlFor='datum_do'>datum do:</label><label htmlFor='datum_do' style={{color:'red'}}>*</label><br></br>
    <input type='date' name='datum_do' id='datum_do' onChange={handleChange} value={formData['datum_do']}  disabled={disableForm}>
    </input>
    </div>

    <div className='grid-form-el'>
        <label htmlFor="activityType">Vrsta aktivnosti:</label><label htmlFor='activityType' style={{color:'red'}}>*</label><br></br>
    <select name='activityType' id='activityType' value={formData['activityType']} onChange={handleChange}  disabled={disableForm}>
    <option value=""></option>
        <option value="djubrenje">Djubrenje</option>
        <option value="obrada">Obrada zemljista</option>
        <option value="zetva/berba">Zetva/berba</option>
    </select>
    </div>
    
    <div className='grid-form-el'>
    </div>
    <DynamicForms vrstaAktivnost={formData['activityType']} handleChange={handleChange} formData={formData} disableForm={disableForm}/>

   
    




    </div>
        
        

        


          <div className='border-bottom'>
            
            <button id="odustani"  className='bar-button' type='button' onClick={() => {setShowA(false)}}>Odustani</button>
            <button id="sacuvaj" className='bar-button' type="submit" disabled={!submitEnable}> Sacuvaj</button>
          </div>
        </form>
        
    </div>
    <ActivitiesPreview setFormData={setFormData} setShowA={setShowA} setDisableForm={setDisableForm}/>
    </div>


    )
}


const DynamicForms = ({vrstaAktivnost, handleChange, formData, disableForm={disableForm}}) =>{

switch (vrstaAktivnost){
    case 'obrada':
        return(
        <Obrada handleChange={handleChange} formData={formData} disableForm={disableForm}/>
        )
        case 'zetva/berba':
            return(
                <ZetvaBerba handleChange={handleChange} formData={formData} disableForm={disableForm}/>
            )
    default:
        return

}

}

const Obrada = ({handleChange, formData, disableForm}) => {
    

    return(
             
    <>
        
        <div  className='grid-form-el'>

        <label htmlFor='cena_operacije_h'>Cena operacije / hektaru (RSD): </label><br></br>
        <input type='text' name='cena_operacije_h' id='cena_operacije_h' onChange={handleChange} value={formData['cena_operacije_h']}  disabled={disableForm}>
        </input>
        </div>
        
    <div  className='grid-form-el'>

    <label htmlFor='cena_operacije_p'>Cena operacije / parcela (RSD): </label><br></br>
    <input type='text' name='cena_operacije_p' id='cena_operacije_p' onChange={handleChange} value={formData['cena_operacije_p']} disabled={disableForm}>
    </input>
    </div>
    <div  className='grid-form-el'></div>
<div  className='grid-form-el'></div>

   
    <div  className='grid-form-el'>
<label htmlFor='tip_obrade'>tip_obrade: </label> <label htmlFor='tip_obrade' style={{color:'red'}} >*</label><br></br>
<select type='text' name='tip_obrade' id='tip_obrade' onChange={handleChange} value={formData['tip_obrade']}  disabled={disableForm}>
    <option value=""></option>
    <option value='oranje'>Oranje</option>
    <option value='drljanje'>Drljanje</option>
</select>
</div>

    <div  className='grid-form-el'>
<label htmlFor='dubina'>Dubina (cm): </label>
<input type='text' name='dubina' id='dubina' onChange={handleChange} value={formData['dubina']}  disabled={disableForm}>
</input>
</div>


<div  className='komentar'>
<label htmlFor='komentar'>Komentar: </label><br></br>
    <textarea name='komentar' id='komentar' onChange={handleChange} value={formData['komentar']}  disabled={disableForm}>
        
    </textarea>
</div>
    </>
    )
}

export default Activities