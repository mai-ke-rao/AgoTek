import SideBar from './SideBar'
import './Activities.css'
import {useState, useEffect} from 'react'
import  {setActivities, addActivitiy, deleteItem, updateItem} from '../reducers/activitiesReducer'

import { useDispatch, useSelector } from 'react-redux'
import activitiesService from '../services/activities'

import PopNotification from './PopNotification'

import ActivityForm from './ActivityForm'





const Activities = ({chosenParcId}) => {

  const notify = useSelector(state => {
  
    return state.notification
}
)
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





export default Activities