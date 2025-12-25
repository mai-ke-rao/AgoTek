import { useState, useEffect } from 'react'
import './Bucket.css'
import devicesService from '../services/devices'
import { io } from 'socket.io-client';
import BucketQuery from './BucketQuery'

const FetchTypes = {
  name : "name",
  value : "value",
  date : "date_time"
}

const Bucket = ({chosenDev}) => {

    const [bucket, setBucket] = useState([])
    const [queryBucket, setQueryBucket] = useState([])
    const [page, setPage] = useState('1')
    const [searchQ, setSearchQ] = useState("")
    const [queryField, setQueryField] = useState()

useEffect(() => {
    devicesService.getDataPage(chosenDev.dev_id, page).then((data) => 
    setBucket([...data]))
      console.log("bucket", bucket);
      
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


useEffect(() => {

  
  if(queryBucket.length < 1 && searchQ.length > 0) {
    const data = devicesService.getDataPage(chosenDev.dev_id, "all").then((data) => 
      setQueryBucket([...data])
    )
    
  }


},[searchQ])

function SearchName (e){
  e.preventDefault;
  setQueryField(FetchTypes.name)
  setSearchQ(e.target.value)
  setPage(1)
}

function SearchValue (e){
  e.preventDefault;
  setQueryField(FetchTypes.value)
  setSearchQ(e.target.value)
  setPage(1)
}

function SearchDate (e){
e.preventDefault;
setQueryField(FetchTypes.date)
setSearchQ(e.target.value)
setPage(1)


}

console.log("bucket", bucket);

    return(
        <div>
        <table>
        <thead>
            <tr >
                <th className='tName'>name
                 
                   <br></br>
                  <input placeholder='search...' className='bucket-search' type='search' name='n' value={queryField == "name" ? searchQ : ""} onChange={SearchName}/>
                  </th>
                
                <th className='tInput'>value
                  
                   <br></br>
                   <input placeholder='search...' className='bucket-search' type='search' name='v' value={queryField == "value" ? searchQ : ""} onChange={SearchValue}/>
                  </th> 
                
                <th className='tconnection'>date time
                  
                   <br></br>
                
                 <input  placeholder='search...' className='bucket-search' type='date' name='d' value={queryField == "date_time" ? searchQ : ""} onChange={SearchDate}/>
                
                  </th> 
              
            </tr>
            </thead>
            <tbody>

            {(searchQ.length < 1) ? bucket.map(el => 
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
                 ):  <BucketQuery query={searchQ} queryBucket={queryBucket} queryField={queryField} page={page}/>}
          
                
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