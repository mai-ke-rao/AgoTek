const parcelReducer = (state = [], action) => {

    switch(action.type){
        case 'pick':
            const id = action.payload.id
           
           const newState = []
            state.forEach(n => n.id == id ? newState.push([n.picked = true, ...n]) :newState.push([n.picked = false, ...n]))
            return newState

        default:
            return state    
    }
}


export default parcelReducer