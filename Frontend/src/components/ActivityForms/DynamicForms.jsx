import ZetvaBerba from './ZetvaBerba'
import Obrada from './Obrada'

const DynamicForms = ({vrstaAktivnost, handleChange, formData, disableForm={disableForm}}) =>{

switch (vrstaAktivnost){
    case 'obrada':
        return(
        <Obrada handleChange={handleChange} formData={formData} disableForm={disableForm}/>
        )
        case 'zetva/berba':
            return(
                <ZetvaBerba handleChange={handleChange} formData={formData} disableForm={disableForm}/>
            )
        case 'komentar':
            return(
                
<div  className='komentar'>
<label htmlFor='komentar'>Komentar: </label><br></br>
    <textarea name='komentar' id='komentar' onChange={handleChange} value={formData['komentar']}  disabled={disableForm}>
        
    </textarea>
</div>
            )    
    default:
        return

}

}

export default DynamicForms