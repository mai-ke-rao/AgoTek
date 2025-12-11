
import { useSelector } from "react-redux"
import './Activities.css'
import spadeImg from '../assets/shovel-Photoroom.png'
const ActivitesPreview = ({setFormData, setShowA, setDisableForm}) => {

    
const activitiesArray = useSelector(state => {
  
    return state.activities
}
)

const activitesAbridged = activitiesArray.map((Aobject) =>  ({['datum_do']: Aobject.datum_do,
    ['activityType']: Aobject.activityType, ['tip_obrade']:Aobject.tip_obrade, ['id']: Aobject.id
 }))
 console.log("activitesAbridged: ", activitesAbridged);

 const expandHandler = (activityId) => {
    
    const pickedActivity = activitiesArray.find((element) => element.id == activityId)
    console.log("picked activty", pickedActivity);
    
    setFormData(  pickedActivity,
       )
    setShowA(true)
    setDisableForm(true)
    


 }

return(
<div>
    {activitesAbridged.map(el => <div id={el.id} className="card" onClick={() => expandHandler(el.id)}>
       <div className="left" ><img src={spadeImg} className="icon"></img> <div className="text">
        <div className="title">{el['activityType']}</div>  
        <div className="subtitle">{el['tip_obrade']} </div>
        </div></div>
        <div className="date"> {el['datum_do']}</div>
    </div> )}
   

    </div>
)


}

export default ActivitesPreview