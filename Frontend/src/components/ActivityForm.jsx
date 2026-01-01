
import './Activities.css'
import {useState, useEffect} from 'react'
import  {setActivities, addActivitiy, deleteItem, updateItem} from '../reducers/activitiesReducer'
import {setNotification} from '../reducers/notificationReducer'
import { useDispatch, useSelector } from 'react-redux'
import activitiesService from '../services/activities'
import ActivitiesPreview from './activitiesPreview'

import Notfication from './Notification'
import DynamicForms from './ActivityForms/DynamicForms'
import FormActionButtons from './ActivityForms/FormActionButtons'
import NotficationSA from './NotificationSA'



const ActivityForm = ({showA, chosenParcId, setShowA, disableForm, setDisableForm, formData, setFormData}) => {

    /*const [vrstaAktivnost, setVrstaAktivnosti] = useState("")*/
    const dispatch = useDispatch()
   
    const [submitEnable, setSubmitEnable] = useState(false)

    const activitiesArray = useSelector(state => {
  
    return state.activities
}
)

    useEffect(() => {


    const dates = validateHelper(formData)
switch (formData['activityType']){
    case 'obrada':
        if(formData.tip_obrade? formData.tip_obrade.length > 0: true && dates)
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
    


        const handleDelete = async() =>{

            const res = activitiesService.deleteOne(formData.id)
            if(res.status != 200)
            {
                    return(<>
                    <Notfication message={res?.message} mistake={true}/>
                    </>
                    )
            }
            else {
                return res.data
            }
        }
      
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
    
    <NotficationSA/>
    <ActivitiesPreview setFormData={setFormData} setShowA={setShowA} setDisableForm={setDisableForm}/>
    </div>)
   }



   const handleSubmit = async (event) => {
    event.preventDefault();
    
    const finalObject = formData
    finalObject["parcel"] = chosenParcId
    

    console.log("final object", finalObject);
    const found = activitiesArray.find(el => el.id == finalObject.id)
    if(found){
        console.log("icice updated");
        const updatedOne = await activitiesService.updateOne(finalObject.id, finalObject)
        console.log("updatedONE", updatedOne);
        
        dispatch(updateItem(updatedOne))
         setShowA(false)
        dispatch(setNotification({message: "Uspeno izmenjena aktivnost", type: "success", visible: true}))
        return 
    }
    console.log("activies in submit", activitiesArray);
    console.log("final object", finalObject);
    
    
    const newActivity = await activitiesService.addNew(finalObject)
    dispatch(addActivitiy(newActivity))
    setShowA(false)
    dispatch(setNotification({message: "Uspeno kreirana aktivnost", type: "success", visible: true}));

    //common validate here, and specific validate (later add)


    
  };

  

    return(
        <div className='act-form-container group'>
        <div className='border'>
        <button className='border-button'><strong>Nova aktivnost </strong>
        </button>
             <NotficationSA/>
        
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
        <option value="komentar">Komentar</option>
        <option value="obrada">Obrada zemljista</option>
        <option value="zetva/berba">Zetva/berba</option>
    </select>
    </div>
    
    <div className='grid-form-el'>
    </div>
    <DynamicForms vrstaAktivnost={formData['activityType']} handleChange={handleChange} formData={formData} disableForm={disableForm}/>

   
    




    </div>
        
        

        


       <FormActionButtons disableForm={disableForm} setDisableForm={setDisableForm} submitEnable={submitEnable} setShowA={setShowA} handleDelete={handleDelete} formData={formData}/>
        </form>
        
    </div>
    <ActivitiesPreview setFormData={setFormData} setShowA={setShowA} setDisableForm={setDisableForm}/>
    </div>


    )
}


export default ActivityForm