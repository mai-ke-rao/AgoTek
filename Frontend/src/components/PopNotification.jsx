   

import closeIcon from '../assets/cancel.png'
import {
    useNavigate
 } from 'react-router-dom'

const PopNotification = ({message}) => {
 const navigate = useNavigate()
  
   return(
            <div className='dialog'>
                <div className='dialog-container'>
                    <div className='loader-container'></div>
<div>
                            <div className='flex full-width justify-right' onClick={() => navigate(-1)}>
                                <img src={closeIcon}></img>
                                </div>
                            <h2>{message}</h2>
                      </div>
                    </div>
                    </div>
   )

}


export default PopNotification