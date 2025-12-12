import { createSlice, current} from '@reduxjs/toolkit'





const notificationSlice = createSlice({
    name: 'notification',
    initialState: {
    message: "",
    type: 'success', // success | error | warning
    visible: false,
  },
    reducers: {
        setNotification(state, action){
            state.message = action.payload.message
      state.type = action.payload.type || 'success'
      state.visible = true
        },
        hideNotification: (state) => {
      state.visible = false
      state.message = null
    },
       

    }

})

export const {setNotification, hideNotification} = notificationSlice.actions
export default notificationSlice.reducer