
import SideBar from './SideBar'

import './Activities.css'

const Weather = () => {

const cont = {
    display: 'block',
    height: 500
}

    return(
        <div className="flex p3">
        <SideBar />
        <div className='full-width'>
            
            <h1>Vremenska prognoza</h1>


            <div className='activities-container'>
            <div className='form-container'>
            <div className='cont'>
        <iframe src="https://www.yr.no/en/content/2-3194360/meteogram.svg" style={{width: 782, display: 'block' , marginTop: 10, align:'center', height: 400}}></iframe>
        </div>
        <div className='cont'>
        <iframe src="https://www.yr.no/en/content/2-3194360/table.html" style={{minWidth: 700, width: '70%', display: 'block', marginTop: 50, height: 500}}></iframe>
        
        </div>
        </div>
        </div>
        </div>
        </div>
    )
}


export default Weather