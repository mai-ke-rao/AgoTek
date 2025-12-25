import './Bucket.css'
import { useEffect } from 'react'

const BucketQuery = ({query, queryBucket, queryField, page}) => {
/*
       useEffect(() => {
const temp = queryBucket.filter(el => String(el[queryField]).substring(0, query.length)  == query)

const prunedRes = temp.slice(0 + (page - 1) * 15, 15 + (page - 1) * 15)
    }, [page])*/

const temp = queryBucket.filter(el => String(el[queryField]).substring(0, query.length)  == query)

const prunedRes = temp.slice(0 + (page - 1) * 15, 15 + (page - 1) * 15)
    
   

return(<>


{prunedRes.map(el => 
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
                </tr>)
                }

</>

)

}



export default BucketQuery