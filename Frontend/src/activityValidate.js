
const validateHelper = (formObject) => {
    if(formObject['datum od'].length > 0 && formObject['datum do'].length > 0){
        return true;

    }
    else {
        return false;
    }
}

const commonValidate = (formObject) => {

    const dates = validateHelper(formObject)
switch (formObject['Vrsta aktivnosti']){
    case 'obrada':
        if(formObject['tip obrade'].length > 0 && dates)
            return true
        else
        return false
    

    default:
        return false
}


    

}

export default commonValidate