import SideBar from './SideBar'
import './Activities.css'
import {useState} from 'react'
import activitiesReducer, {createActivity} from '../reducers/activitiesReducer'
import { useDispatch, useSelector } from 'react-redux'




const Activities = () => {

    const [showA, setShowA] = useState(true)

    return(
        <div className="flex p3">
        <SideBar />
        <div className='full-width'>
            
            <h1>Aktivnosti</h1>
            <div className='bar'>
                <button className='bar-button' onClick={() => setShowA(!showA)}><h4>Nova aktivnost</h4></button>
            </div>
            <div className='activities-container'>
            <div  className='group'>
            <div className='sub-item'></div>
             </div>
           

            <ActivityForm showA={showA}/>

            </div>
 
            <div  className='group'> 
            <div className='sub-item'></div>
            </div>
        </div>

        </div>
    )


}


const ActivityForm = ({showA}) => {

    const [vrstaAktivnost, setVrstaAktivnosti] = useState("")
    const dispatch = useDispatch()
    

   if(!showA){
    
    return (<></>)
   }

    return(
        <div className='form-container group'>
        <div className='border'>
        <button className='border-button'><strong>Nova aktivnost </strong>
        </button>
        
        
        <form onSubmit={(event) => {
  event.preventDefault();
  dispatch(createActivity({
    activityType: 'obrada',
    datum_od: '26-02-2025',
    datum_do: '26-02-2025',
    tip_obrade: 'drljanje'
  }));
}}>
    <div className='form-grid'>
        

    <div  className='grid-form-el'>

    <label htmlFor='datum od' >Datum od:</label><label htmlFor='datum od' style={{color:'red'}}>*</label><br></br>
    <input type='date' name='datum od' id='datum od'>
    </input>
    </div>

    <div  className='grid-form-el'>

    <label htmlFor='datum do'>Datum do:</label><label htmlFor='datum do' style={{color:'red'}}>*</label><br></br>
    <input type='date' name='datum do' id='datum do'>
    </input>
    </div>

    <div className='grid-form-el'>
        <label htmlFor="Vrsta aktivnosti">Vrsta aktivnosti:</label><label htmlFor='Vrsta aktivnosti' style={{color:'red'}}>*</label><br></br>
    <select name='Vrsta aktivnosti' id='Vrsta aktivnosti' value={vrstaAktivnost} onChange={e => setVrstaAktivnosti(e.target.value)}>
    <option value=""></option>
        <option value="djubrenje">Djubrenje</option>
        <option value="obrada">Obrada zemljista</option>
    </select>
    </div>
    
    <div className='grid-form-el'>
    </div>
    <DynamicForms vrstaAktivnost={vrstaAktivnost}/>

   
    




    </div>
   
        

        


          <div className='border-bottom'>
            
            <button id="odustani"  className='bar-button'>Odustani</button>
            <button id="sacuvaj" className='bar-button' type="submit"> Sacuvaj</button>
          </div>
        </form>
    </div>
    </div>


    )
}


const DynamicForms = ({vrstaAktivnost}) =>{

switch (vrstaAktivnost){
    case 'obrada':
        return(
        <Obrada/>
        )
    default:
        return

}

}

const Obrada = () => {
    

    return(
             
    <>
        
        <div  className='grid-form-el'>

        <label htmlFor='cena o h'>Cena operacije / hektaru (RSD): </label><br></br>
        <input type='text' name='cena o h' id='cena o h'>
        </input>
        </div>
        
    <div  className='grid-form-el'>

    <label htmlFor='cena o p'>Cena operacije / parcela (RSD): </label><br></br>
    <input type='text' name='cena o p' id='cena o p'>
    </input>
    </div>
    <div  className='grid-form-el'></div>
<div  className='grid-form-el'></div>

    <div  className='grid-form-el'>

<label htmlFor='tip obrade'>Tip obrade: </label> <label htmlFor='tip obrade' style={{color:'red'}}>*</label><br></br>
<select type='text' name='tip obrade' id='tip obrade'>
    <option value='oranje'>Oranje</option>
    <option value='drljanje'>Drljanje</option>
</select>
</div>

    <div  className='grid-form-el'>

    <label htmlFor='dubina o'>Dubina (cm): </label>
<input type='text' name='dubina o' id='dubina o'>
</input>
</div>


<div  className='komentar'>
<label htmlFor='komentar'>Komentar: </label><br></br>
    <textarea name='komentar' id='komentar'>
        
    </textarea>
</div>
    </>
    )
}

export default Activities