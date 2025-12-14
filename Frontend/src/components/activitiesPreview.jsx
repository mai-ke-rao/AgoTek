
import { useSelector } from "react-redux"
import './Activities.css'
import spadeImg from '../assets/shovel-Photoroom.png'
import truckImg from '../assets/truck.png'
import commentImg from '../assets/comments.png'
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
       <div className="left" >
        <Icon activityType={el['activityType']}/>
        <div className="text">
        <div className="title">{el['activityType']}</div>  
        <div className="subtitle">{el['tip_obrade']} </div>
        </div></div>
        <div className="date"> {el['datum_do']}</div>
    </div> )}
   

    </div>
)


}

const Icon = ({activityType}) => {

    switch (activityType) {
            case 'obrada':
                return (<>
                    <img src={spadeImg} className="icon"></img> 
                    </>
                );
            case 'zetva/berba':
                return(<>
                <img src={truckImg} className="icon"></img> 
                </>)
            case 'komentar':
                return(<>
                <img src={commentImg} className="icon"></img> 
                </>)
                                

    }


   
}

export default ActivitesPreview