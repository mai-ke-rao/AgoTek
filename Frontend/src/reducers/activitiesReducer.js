import { createSlice, current} from '@reduxjs/toolkit'

const initialState = [
    {
        activityType: 'obrada',
        id: 1,
        datum_od: '11-12-2024',
        datum_do: '11-12-2024',
        tip_obrade: 'oranje'
    },
    {
        activityType: 'obrada',
        id: 2,
        datum_od: '22-02-2025',
        datum_do: '22-02-2025',
        tip_obrade: 'drljanje'
    }
]

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
        }

    }

})

export const {createActivity, addActivitiy, setActivities} = activitiesSlice.actions
export default activitiesSlice.reducer