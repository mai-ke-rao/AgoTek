import { useState, useEffect } from 'react'
import './Bucket.css'
import devicesService from '../services/devices'
import { io } from 'socket.io-client';

const Bucket = ({chosenDev}) => {

    const [bucket, setBucket] = useState([])
    const [page, setPage] = useState('1')

useEffect(() => {
    devicesService.getDataPage(chosenDev.dev_id, page).then((data) => 
    setBucket([...data]))

},[page, chosenDev?.dev_id])


 useEffect(() => {
    if (!chosenDev?.dev_id || page != 1) return;

    //get the auth 
    const loggedUserJSON = window.localStorage.getItem('loggedFarmAppUser')
     if (!loggedUserJSON) return

      const user = JSON.parse(loggedUserJSON)
     
    // Create socket connection
    const socket = io('http://localhost:3001', {
      withCredentials: true,
      auth: {
        token: user.token, 
      },
    })
  
    
    // Join device room
    socket.emit('join-device', chosenDev.dev_id);

    //error reporting
    socket.on('connect_error', (err) => {
  console.error('Socket connect_error:', err.message);
});

    // Listen for uplink events
    socket.on('uplink', ({ dev_id, rows }) => {
      // Extra safety: only handle if this is our device
      if (dev_id !== chosenDev.dev_id) return;

      // Decide what to do depending on pagination:
      // common pattern: only live-update first page
     setBucket((prev) => {
  const highlighted = rows.map(r => ({
    ...r,
    __new: true,   // 👈 flag only on new rows
  }));


  return [...highlighted, ...prev].slice(0, 17);
});
    });

    // Cleanup on unmount or dev_id change
    return () => {
      socket.emit('leave-device', chosenDev.dev_id);
      socket.disconnect();
    };
  }, [chosenDev?.dev_id, page]);



useEffect(() => {
  if (!bucket.length) return;

  const timer = setTimeout(() => {
    setBucket(prev =>
      prev.map(row => ({ ...row, __new: false }))
    );
  }, 2500); // matches animation duration

  return () => clearTimeout(timer);
}, [bucket]);


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
                <tr key={el._id} className={el.__new ? 'new-row' : 'rows'}>
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