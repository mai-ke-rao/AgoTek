import SideBar from './SideBar'
import './Activities.css'
import {useState, useEffect} from 'react'
import activitiesReducer, {setActivities, addActivitiy} from '../reducers/activitiesReducer'
import { useDispatch, useSelector } from 'react-redux'
import activitiesService from '../services/activities'

import ActivitiesPreview from './activitiesPreview'






const Activities = ({chosenParcId}) => {

    const [showA, setShowA] = useState(true)
    const [disableForm, setDisableForm] = useState(false)
    const dispatch = useDispatch()

    const [formData, setFormData] = useState({
        'datum od':"",
        'datum do':"",
        'Vrsta aktivnosti':"",
        'tip obrade':"",
        'dubina o':"",
        'komentar':"",
        'cena o h':"",
        'cena o p':"",
       'chosenParcId':""
      });

    useEffect(() => {

        activitiesService.getAll(chosenParcId).then(activities => dispatch(setActivities(activities)))
    }, [])
   
    

    return(
        <div className="flex p3">
        <SideBar />
        <div className='full-width'>
            
            <h1>Aktivnosti</h1>
            <div className='bar'>
                <button className='bar-button' onClick={() => {setShowA(!showA); setDisableForm(false); setFormData({
        'datum od':"",
        'datum do':"",
        'Vrsta aktivnosti':"",
        'tip obrade':"",
        'dubina o':"",
        'komentar':"",
        'cena o h':"",
        'cena o p':"",
       'chosenParcId':""
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
      

      const handleChange = (event) => {
        const { name, value } = event.target;
        setFormData((prevState) => ({ ...prevState, [name]: value }));
        commonValidate(formData);
      };
    

      
const validateHelper = (formObject) => {
    if(formObject['datum od'].length > 0 && formObject['datum do'].length > 0){
        return true;

    }
    else {
        return false;
    }
}

const commonValidate = (formObject) => {

    const dates = validateHelper(formObject)
switch (formObject['Vrsta aktivnosti']){
    case 'obrada':
        if(formObject['tip obrade'].length > 0 && dates)
        {
            setSubmitEnable(true)
            return 
        }
        else{
            setSubmitEnable(false)
        return 
        }

    default:
        setSubmitEnable(false)
        return 
}


    

}


   if(!showA){
    
    return (<div className='form-container group'>
    
    
    <ActivitiesPreview setFormData={setFormData} setShowA={setShowA} setDisableForm={setDisableForm}/>
    </div>)
   }



   const handleSubmit = async (event) => {
    event.preventDefault();
    
    const formObject = 
    {
        
        "datum_od": formData['datum od'],
        "datum_do": formData['datum do'],
        
        "tip_obrade": formData['tip obrade'],
        "dubina": formData['dubina o'],
        "komentar": formData['komentar'],
        "cena_operacije_h": formData['cena o h'],
        "parcel":chosenParcId
    
    }

    
    const newActivity = await activitiesService.addNew(formObject, formData['Vrsta aktivnosti'])
    dispatch(addActivitiy(newActivity))

    //common validate here, and specific validate (later add)


    
  };

  

    return(
        <div className='form-container group'>
        <div className='border'>
        <button className='border-button'><strong>Nova aktivnost </strong>
        </button>
        
        
        <form onSubmit={handleSubmit}>
    <div className='form-grid'>
        

    <div  className='grid-form-el'>

    <label htmlFor='datum od' >Datum od:</label><label htmlFor='datum od' style={{color:'red'}}>*</label><br></br>
    <input type='date' name='datum od' id='datum od'   onChange={handleChange} value={formData['datum od']} disabled={disableForm}>
    </input>
    
    </div>

    <div  className='grid-form-el'>

    <label htmlFor='datum do'>Datum do:</label><label htmlFor='datum do' style={{color:'red'}}>*</label><br></br>
    <input type='date' name='datum do' id='datum do' onChange={handleChange} value={formData['datum do']}  disabled={disableForm}>
    </input>
    </div>

    <div className='grid-form-el'>
        <label htmlFor="Vrsta aktivnosti">Vrsta aktivnosti:</label><label htmlFor='Vrsta aktivnosti' style={{color:'red'}}>*</label><br></br>
    <select name='Vrsta aktivnosti' id='Vrsta aktivnosti' value={formData['Vrsta aktivnosti']} onChange={handleChange}  disabled={disableForm}>
    <option value=""></option>
        <option value="djubrenje">Djubrenje</option>
        <option value="obrada">Obrada zemljista</option>
    </select>
    </div>
    
    <div className='grid-form-el'>
    </div>
    <DynamicForms vrstaAktivnost={formData['Vrsta aktivnosti']} handleChange={handleChange} formData={formData} disableForm={disableForm}/>

   
    




    </div>
        
        

        


          <div className='border-bottom'>
            
            <button id="odustani"  className='bar-button'>Odustani</button>
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
    default:
        return

}

}

const Obrada = ({handleChange, formData, disableForm}) => {
    

    return(
             
    <>
        
        <div  className='grid-form-el'>

        <label htmlFor='cena o h'>Cena operacije / hektaru (RSD): </label><br></br>
        <input type='text' name='cena o h' id='cena o h' onChange={handleChange} value={formData['cena o h']}  disabled={disableForm}>
        </input>
        </div>
        
    <div  className='grid-form-el'>

    <label htmlFor='cena o p'>Cena operacije / parcela (RSD): </label><br></br>
    <input type='text' name='cena o p' id='cena o p' value={formData['cena o h']} disabled={disableForm}>
    </input>
    </div>
    <div  className='grid-form-el'></div>
<div  className='grid-form-el'></div>

    <div  className='grid-form-el'>

<label htmlFor='tip obrade'>Tip obrade: </label> <label htmlFor='tip obrade' style={{color:'red'}} >*</label><br></br>
<select type='text' name='tip obrade' id='tip obrade' onChange={handleChange} value={formData['tip obrade']}  disabled={disableForm}>
    <option value=""></option>
    <option value='oranje'>Oranje</option>
    <option value='drljanje'>Drljanje</option>
</select>
</div>

    <div  className='grid-form-el'>

    <label htmlFor='dubina o'>Dubina (cm): </label>
<input type='text' name='dubina o' id='dubina o' onChange={handleChange} value={formData['dubina o']}  disabled={disableForm}>
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