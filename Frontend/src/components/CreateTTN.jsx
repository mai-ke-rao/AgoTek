import devicesSerivce from '../services/devices'
import { useState } from 'react'
import closeIcon from '../assets/cancel.png'
import {
    useNavigate
 } from 'react-router-dom'

const CreateTTN = ({setIntPick, devList, setDeviceList}) => {

    let navigate = useNavigate();
    
    const [formData, setFormData] = useState(
        {
            name:"",
            apikey:"",
            dev_id: "",
        }
    )
    const handleSubmit = async (event) => {
        event.preventDefault();
        
        const newDevice = await devicesSerivce.addNew(formData)
        setDeviceList([...devList, newDevice])
        console.log("device list in hanlde submit: ",devList);
        setIntPick("")
        navigate("/uredjaji")
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
                            <div className='flex full-width justify-right' onClick={() => setIntPick("")}>
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
                                        <label htmlFor='dev_id'><strong>End device ID</strong> </label>
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

export default CreateTTN