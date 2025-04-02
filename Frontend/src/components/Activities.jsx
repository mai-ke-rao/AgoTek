import SideBar from './SideBar'
import './Activities.css'


const Activities = () => {



    return(
        <div className="flex p3">
        <SideBar />
        <div className='full-width'>
            
            <h1>Aktivnosti</h1>
            <div className='bar'>
                <button className='bar-button'><h4>Nova aktivnost</h4></button>
            </div>
            <div className='activities-container'>
            <div  className='group'>
            <div className='sub-item'></div>
             </div>
            <div className='form-container group'>
                <div className='border'>
                <button className='border-button'><strong>Nova aktivnost </strong>
                </button>
                
                
            <from>
            <div className='form-grid'>
                <div className='grid-form-el'>
                <label for="Vrsta aktivnosti">Vrsta aktivnosti: </label><br></br>
            <select name='Vrsta aktivnosti' id='Vrsta aktivnosti'>

                <option value="djubrenje">Djubrenje</option>
            </select>
            </div>

            <div  className='grid-form-el'>

            <label for='datum od' >Datum od:</label><br></br>
            <input type='date' name='datum od' id='datum od'>
            </input>
            </div>

            <div  className='grid-form-el'>

            <label for='datum do'>Datum do:</label><br></br>
            <input type='date' name='datum do' id='datum do'>
            </input>
            </div>

            </div>
            </from>
                

                <p>lorem ipsum Loreim aindsiansfiahnjsfoiahn aa fa fasdfe asdfasg arharwghawrge lorem ipsum Loreim aindsiansfiahnjsfoiahn aa fa fasdfe asdfasg
                 arharwghawrge lorem ipsum Loreim aindsiansfiahnjsfoiahn aa fa fasdfe asdfasg arharwghawrge lorem ipsum Loreim aindsiansfiahnjsfoiahn aa
                  fa fasdfe asdfasg arharwghawrge</p>


                  <button className='border-bottom'>

                  </button>
            </div>
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