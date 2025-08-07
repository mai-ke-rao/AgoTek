import './SideBar.css'
import {
     Link
  } from 'react-router-dom'



const SideBar = () => {




    return(
        <>
        
            <div className="sticky flex column half-width">

            <Link to='/vremenska' className='reset-link'>
                <div className="sidebar-link">
                    Vremenska prognoza
                </div>
                </Link>

        


    <div className="sidebar-link disabled">
        Meteo podaci
    </div>


        <Link to='/parcele' className='reset-link'>
    <div className="sidebar-link">
        Parcele
    </div>
    </Link>


    <div className="sidebar-link disabled">
        Analiza zemljista
    </div>



        <Link to='/aktivnosti' className='reset-link'>
    <div className="sidebar-link">
        Aktivnosti
    </div>
    </Link>



        <Link to='/uredjaji' className='reset-link'>
    <div className="sidebar-link">
        Uredjaji
    </div>
    </Link>
</div>



</>
    )


}


export default SideBar


