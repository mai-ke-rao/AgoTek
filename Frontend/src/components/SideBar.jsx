import './SideBar.css'
import {
     Link
  } from 'react-router-dom'



const SideBar = () => {




    return(
        <>
        
            <div className="sticky flex column half-width">
                <div className="sidebar-link disabled">
                    Vremenska prognoza
                </div>
          

        


    <div className="sidebar-link disabled">
        Meteo podaci
    </div>



    <div className="sidebar-link">
        Parcele
    </div>


    <div className="sidebar-link disabled">
        Analiza zemljista
    </div>




    <div className="sidebar-link disabled">
        Aktivnosti
    </div>




    <div className="sidebar-link disabled">
        Uredjaji
    </div>
</div>



</>
    )


}


export default SideBar


