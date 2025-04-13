
import SideBar from './SideBar'
import './Devices.css'
import devicesSerivce from '../services/devices'
import { useState, useEffect } from 'react'
import closeIcon from '../assets/cancel.png'
import DeviceMenu from './DeviceMenu'
import {
    useNavigate
 } from 'react-router-dom'



const FormDialog = ({setShowDialog, devList, setDeviceList}) => {

    const [formData, setFormData] = useState(
        {
            name:"",
            apikey:"",
            app_id: "",
            hook_id: "",
            dev_id: "",
        }
    )
    const handleSubmit = async (event) => {
        event.preventDefault();
        
        const newDevice = await devicesSerivce.addNew(formData)
        setDeviceList([...devList, newDevice])
        console.log("device list in hanlde submit: ",devList);
        
    }


    const hadnleChange = (event) => {
        const { name , value } = event.target;
        setFormData((prevState) =>  ({ ...prevState, [name]: value}))
    }
    
    return(
            <div className='dialog'>
                <div className='dialog-container'>
                    <div className='loader-container'>
                        <div>
                            <div className='flex full-width justify-right' onClick={() => setShowDialog(false)}>
                                <img src={closeIcon}></img>
                                </div>
                                <h2>Dodaj novi uredjaj</h2><br></br>
                                <br></br><br></br>
                            <div className='flex column gap-5'>
                                <form className='form-container full-width' onSubmit={handleSubmit}>
                            <div className='input-container'>
                                <div className='display-block'>
                                <div className='input-item'>
                                    <div className='label-container'>
                                        <label htmlFor='name'><strong>Ime</strong> </label>
                                    </div>
                                    <div className='.iui-input-container'>
                                        <input type='text' name='name' value={formData['name']} onChange={hadnleChange}></input>
                                    </div>
                                    </div>
                                    </div>
                                    </div>

                                    <div className='input-container'>
                                    <div className='display-block'>
                                    <div className='input-item'>
                                    <div className='label-container'>
                                        <label htmlFor='name'><strong>apikey</strong> </label>
                                    </div>
                                    <div className='.iui-input-container'>
                                        <input type='text' name='apikey' value={formData['apikey']} onChange={hadnleChange}></input>
                                    </div>
                                    </div>
                                    </div>
                                    </div>



                                    <div className='input-container'>
                                    <div className='display-block'>
                                    <div className='input-item'>
                                    <div className='label-container'>
                                        <label htmlFor='name'><strong>hook id</strong> </label>
                                    </div>
                                    <div className='.iui-input-container'>
                                        <input type='text' name='hook_id' value={formData['hook_id']} onChange={hadnleChange}></input>
                                    </div>
                                    </div>
</div>
                                    </div>


                                    <div className='input-container'>
                                <div className='display-block'>
                                    <div className='input-item'>
                                    <div className='label-container'>
                                        <label htmlFor='name'><strong>End device ID</strong> </label>
                                    </div>
                                    <div className='.iui-input-container'>
                                        <input type='text' name='dev_id' value={formData['dev_id']} onChange={hadnleChange}></input>
                                    </div>
                                    </div>
                                    </div>
                                    </div>

                        

                                    
                                    <div className='bar'>
                <button className='bar-button' type="submit"> Dodaj uredjaj </button>
                </div>

                                    
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
                
            </div>

    )
}

const Devices = ({setChosenDev}) => {
    let navigate = useNavigate();
    const [deviceList, setDeviceList] = useState([])
    useEffect(() =>{
        devicesSerivce.getAll().then(devList => 
            setDeviceList([...devList])
        )
    }, [])

console.log("dev list: ", deviceList);


const [showDialog, setShowDialog] = useState(false)

    return(
        <div>
        <div className="flex p3">
        <SideBar />
        <div className='full-width'>
            
            <h1>Uredjaji</h1>  
                <div className='bar'>
                <button className='bar-button' onClick={()=>setShowDialog(true)}> Dodaj uredjaj </button>
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
        {showDialog? <FormDialog setShowDialog={setShowDialog} devList={deviceList} setDeviceList={setDeviceList}/>:null}

            </div>

    )

}

export default Devices