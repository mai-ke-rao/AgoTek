
import SideBar from './SideBar'
import './Devices.css'
import devicesSerivce from '../services/devices'


const FormDialog = () => {

    
    
    return(
            <div>
                
            </div>

    )
}

const Devices = ({deviceList, setDeviceList}) => {

devicesSerivce.getAll().then(devList => 
    setDeviceList(...devList)
)
console.log("dev list: ", deviceList);



    return(

        <div className="flex p3">
        <SideBar />
        <div className='full-width'>
            
            <h1>Uredjaji</h1>  
                <div className='bar'>
                <button className='bar-button'> Dodaj uredjaj </button>
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
                    <tr>
                         <td>name</td>
                        <td>last input</td>
                        <td>connection</td>
                        <td>last input</td>
                        <td>connection</td>
                        <td>date created</td>
                    </tr>
                    </tbody>
                
            </table>
        </div>

            </div>

    )

}

export default Devices