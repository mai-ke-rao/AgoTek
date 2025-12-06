
import SideBar from './SideBar'
import './Devices.css'
import devicesSerivce from '../services/devices'

import { useEffect } from 'react'
import DeviceMenu from './DeviceMenu'
import {
    useNavigate
 } from 'react-router-dom'
import CreateTTN from './CreateTTN'



const Devices = ({setChosenDev, deviceList, setDeviceList}) => {
    let navigate = useNavigate();
    
    useEffect(() =>{
        devicesSerivce.getAll().then(devList => 
            setDeviceList([...devList])
        )
    }, [setDeviceList])

console.log("dev list: ", deviceList);




    return(
        <div>
        <div className="flex p3">
        <SideBar />
        <div className='full-width'>
            
            <h1>Uredjaji</h1>  
                <div className='bar'>
                <button className='bar-button' onClick={()=>{ navigate('/integrations')}}> Dodaj uredjaj </button>
                </div>
            
            <table>
                <thead>
                    <tr >
                        <th className='tName'>name</th>
                        <th className='tInput'>last input</th>
                        <th className='tconnection'>connection</th>
                        <th className='tstatus'>status</th>
                        <th className='tbattery'>battery</th>
                        <th className='tdate-created'>date created</th>
                    </tr>
                    </thead>
                <tbody>
                { deviceList.map((el) =>
                 <tr id={el.id} onClick={() => {
                    setChosenDev(el)
                    navigate('/device_menu')
                 } }>
                    <td>{el.name}</td>
                    <td>NaN</td>
                    <td>NaN</td>
                    <td>NaN</td>
                    <td>NaN</td>
                    <td>NaN</td>
                 </tr>)}
                
                    </tbody>
                
            </table>
        </div>
        </div>
        

            </div>

    )

}

export default Devices