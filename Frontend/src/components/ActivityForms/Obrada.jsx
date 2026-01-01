import '../Activities.css'


const Obrada = ({handleChange, formData, disableForm}) => {
    

    return(
             
    <>
        
        <div  className='grid-form-el'>

        <label htmlFor='cena_operacije_h'>Cena operacije / hektaru (RSD): </label><br></br>
        <input type='text' name='cena_operacije_h' id='cena_operacije_h' onChange={handleChange} value={formData['cena_operacije_h']}  disabled={disableForm}>
        </input>
        </div>
        
    <div  className='grid-form-el'>

    <label htmlFor='cena_operacije_p'>Cena operacije / parcela (RSD): </label><br></br>
    <input type='text' name='cena_operacije_p' id='cena_operacije_p' onChange={handleChange} value={formData['cena_operacije_p']} disabled={disableForm}>
    </input>
    </div>
    <div  className='grid-form-el'></div>
<div  className='grid-form-el'></div>

   
    <div  className='grid-form-el'>
<label htmlFor='tip_obrade'>tip_obrade: </label> <label htmlFor='tip_obrade' style={{color:'red'}} >*</label><br></br>
<select type='text' name='tip_obrade' id='tip_obrade' onChange={handleChange} value={formData['tip_obrade']}  disabled={disableForm}>
    <option value=""></option>
    <option value='oranje'>Oranje</option>
    <option value='drljanje'>Drljanje</option>
    <option value='rigolovanje'>Rigolovanje</option>
    <option value='freziranje'>Freziranje</option>
    <option value='tanjiranje'>Tanjiranje</option>
    <option value='podrivanje'>Podrivanje</option>
</select>
</div>

    <div  className='grid-form-el'>
<label htmlFor='dubina'>Dubina (cm): </label>
<input type='text' name='dubina' id='dubina' onChange={handleChange} value={formData['dubina']}  disabled={disableForm}>
</input>
</div>


<div  className='komentar'>
<label htmlFor='komentar'>Komentar: </label><br></br>
    <textarea name='komentar' id='komentar' onChange={handleChange} value={formData['komentar']}  disabled={disableForm}>
        
    </textarea>
</div>
    </>
    )
}


export default Obrada