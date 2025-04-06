
import { useSelector } from "react-redux"
import './Activities.css'
import spadeImg from '../assets/shovel-Photoroom.png'
const ActivitesPreview = ({setFormData, setShowA, setDisableForm}) => {

    
const activitiesArray = useSelector(state => {
  
    return state.activities
}
)

const activitesAbridged = activitiesArray.map((Aobject) =>  ({['datum do']: Aobject.datum_do,
    ['Vrsta aktivnosti']: Aobject.activityType, ['tip obrade']:Aobject.tip_obrade, ['id']: Aobject.id
 }))
 console.log("activitesAbridged: ", activitesAbridged);

 const expandHandler = (activityId) => {
    
    const pickedActivity = activitiesArray.find((element) => element.id == activityId)
    console.log("picked activty", pickedActivity);
    
    setFormData(  {
        'datum od': pickedActivity[        "datum_od"],
        'datum do': pickedActivity[        "datum_do"],
        'Vrsta aktivnosti': pickedActivity[        "activityType"],
        'tip obrade': pickedActivity[        "tip_obrade"],
        'dubina o':pickedActivity[        "dubina"],
        'komentar': pickedActivity[        "komentar"],
        'cena o h':pickedActivity[        "cena_operacije_h"],
       'chosenParcId': pickedActivity[        "parcel"]
 })
    setShowA(true)
    setDisableForm(true)
    


 }

return(
<div>
    {activitesAbridged.map(el => <div id={el.id} className="card" onClick={() => expandHandler(el.id)}>
       <div className="left" ><img src={spadeImg} className="icon"></img> <div className="text">
        <div className="title">{el['Vrsta aktivnosti']}</div>  
        <div className="subtitle">{el['tip obrade']} </div>
        </div></div>
        <div className="date"> {el['datum do']}</div>
    </div> )}
   

    </div>
)


}

export default ActivitesPreview