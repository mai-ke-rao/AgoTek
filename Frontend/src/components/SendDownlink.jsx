import { createRef } from 'react'
import './SendDownlink.css'
import devicesService from '../services/devices'

const SendDownlink = ({chosenDev}) => {

    const inputRef = createRef();

const handleSubmit = (event) => {
    event.preventDefault();
     console.log("sending request data",  inputRef.current.value)
     console.log("to device", chosenDev );
     
    devicesService.sendDownlink(chosenDev, inputRef.current.value).then((result) => 
       { console.log("response from ttn", result);}
        
    )
}

    return(<div>

        <form className='form-container' onSubmit={handleSubmit}>
        <div className='flex'>
            <label htmlFor='downlink'>Downlink: </label><input name='downlink' ref={inputRef}></input>
            <button className='bar-button' type='submit'> Posalji </button>
            </div>
        </form>
    </div>

    )


}


export default SendDownlink