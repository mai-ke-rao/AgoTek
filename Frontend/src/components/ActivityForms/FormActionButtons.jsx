import { useDispatch } from 'react-redux'
import  {setActivities, addActivitiy, deleteItem, updateItem} from '../../reducers/activitiesReducer'
import {setNotification} from '../../reducers/notificationReducer'

const FormActionButtons = ({disableForm, setDisableForm, submitEnable, setShowA, handleDelete, formData}) => {
 const dispatch = useDispatch()
 

//izmeni will have to give some cue for the fact that we are in the edit mode now and not in save mode
 
  

    if(disableForm){
        return(
            <div className='border-bottom'>
            
           
           
             <button id="odustani"  className='bar-button' type='button' onClick={() => {setShowA(false)}}>Odustani</button>
              <button id="odustani"  className='bar-button' type='button' onClick={() => {setShowA(false); handleDelete();
                dispatch(deleteItem(formData.id));  dispatch(setNotification({message: "Uspeno obriasna aktivnost", type: "success", visible: true}));
              }}>Obrisi</button>
              <button id="sacuvaj" className='bar-button' type="button" onClick={() => setDisableForm(false)}> Izmeni</button>
          </div>
        )
    }
    else{
    return(
        <div className='border-bottom'>
            
            <button id="odustani"  className='bar-button' type='button' onClick={() => {setShowA(false)}}>Odustani</button>
            <button id="sacuvaj" className='bar-button' type="submit" disabled={!submitEnable} > Sacuvaj</button>
          </div>
    )
}
}


export default FormActionButtons