import { createSlice, current} from '@reduxjs/toolkit'



const generateId = () =>
    Number((Math.random() * 1000000).toFixed(0))

const activitiesSlice = createSlice({
    name: 'activities',
    initialState: [],
    reducers: {
        createActivity(state, action){
            const content = action.payload
            state.push({
                ...content,
                id: generateId(),
            })
            console.log(current(state))
            return state
        },
        addActivitiy(state, action){
            state.push(action.payload)
        },
        setActivities(state, action){
            return action.payload
        },
         deleteItem(state, action) {
           

     return state.filter(
        item => item._id !== action.payload
      )
     
    },
    updateItem(state, action){
        const index = state.findIndex(el => el.id === action.payload.id)
  if (index !== -1) {
    state[index] = action.payload
  }


}

        
    

    }

})

export const {createActivity, addActivitiy, setActivities, deleteItem, updateItem} = activitiesSlice.actions
export default activitiesSlice.reducer