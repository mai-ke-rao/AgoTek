
import './SendDownlink.css'
import devicesService from '../services/devices'

const SendDownlink = ({chosenDev}) => {

const handleSubmit = () => {

}

    return(<div>

        <form className='form-container' onSubmit={handleSubmit}>
        <div className='flex'>
            <label htmlFor='downlink'>Downlink: </label><input name='downlink'></input>
            <button className='bar-button' type='submit'> Posalji </button>
            </div>
        </form>
    </div>

    )


}


export default SendDownlink