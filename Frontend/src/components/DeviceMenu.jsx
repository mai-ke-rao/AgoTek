import './DeviceMenu.css'
import SideBar from './SideBar'
import {useState} from 'react'
import Bucket from './Bucket'
import SendDownlink from './SendDownlink'


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

            {chosenTab == "data"? <Bucket chosenDev={chosenDev}/>: ""}
            {chosenTab == "downlink"? <SendDownlink chosenDev={chosenDev}/>: "" }
        </div>
        </div>
        </div>
    )
}


export default DeviceMenu