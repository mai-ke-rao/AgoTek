import './DeviceMenu.css'
import SideBar from './SideBar'
import {useState} from 'react'
import Bucket from './Bucket'


const DeviceMenu = ({chosenDev}) => {


    const [chosenTab, setChosenTab] = useState("data")

    return(

        <div className="flex p3">
        <SideBar />
        <div className='full-width'>
        <p className='header'>{chosenDev.name}</p>
        <div className='container'>
            <div className='menu'>
                <button className={`menu-item ${chosenTab == "data"? "clicked" : ""}`} onClick={() => setChosenTab("data")}>data</button>
                <button className={`menu-item ${chosenTab == "downlink"? "clicked" : ""}`} onClick={() => setChosenTab("downlink")}>send downlink</button>
            </div>

            {chosenTab == "data"? <Bucket/>: ""}
        </div>
        </div>
        </div>
    )
}


export default DeviceMenu