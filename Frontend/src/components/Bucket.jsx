import { useState, useEffect } from 'react'
import './Bucket.css'
import devicesService from '../services/devices'

const Bucket = ({chosenDev}) => {

    const [bucket, setBucket] = useState([])
    const [page, setPage] = useState('1')

useEffect(() => {
    devicesService.getDataPage(chosenDev.dev_id, page).then((data) => 
    setBucket([...data]))

},[page])

    return(
        <div>
        <table>
        <thead>
            <tr >
                <th className='tName'>name</th>
                <th className='tInput'>value</th>
                <th className='tconnection'>date time</th>
              
            </tr>
            </thead>
            <tbody>
            {bucket.map(el => 
                <tr id='el.id'>
                    <td>
                        {el.name}
                    </td>
                    <td>
                        {el.value}
                    </td>
                    <td>
                        {el.date_time}
                    </td>
                </tr>
                 )}
         
                
                    </tbody>
                
            </table>
       <br></br>
       <br></br>
       <br></br>
       <button onClick={() => setPage((Number(page) - 1))} className='middle-margin'>Prev</button> <button onClick={() => setPage((Number(page) + 1))}>Next</button>
                 </div>                  
    )
}

export default Bucket