import '../Activities.css'



const ZetvaBerba = ({handleChange, formData, disableForm}) => {










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
    <label htmlFor='prinos_h'>Prinos/ha (kg): </label><br></br>
    <input type='text' name='prinos_h' id='prinos_h' onChange={handleChange} value={formData['prinos_h']} disabled={disableForm}>
    </input>
    </div>


      <div  className='grid-form-el'>
    <label htmlFor='prinos_p'>Prinos/parcela (kg): </label><br></br>
    <input type='text' name='prinos_p' id='prinos_p' onChange={handleChange}  value={formData['prinos_p']} disabled={disableForm}>
    </input>
    </div>

    <div  className='grid-form-el'>
    <label htmlFor='vlaga'>Vlaga (%): </label><br></br>
    <input type='text' name='vlaga' id='vlaga' onChange={handleChange} value={formData['vlaga']} disabled={disableForm}>
    </input>
    </div>

<div  className='grid-form-el'>
    <label htmlFor='primese'>Primese (%): </label><br></br>
    <input type='text' name='primese' id='primese' onChange={handleChange} value={formData['primese']} disabled={disableForm}>
    </input>
    </div>

   

   
     <div  className='grid-form-el'>
    <label htmlFor='hektolitarska_masa'>Hektolitarska masa(%): </label><br></br>
    <input type='text' name='hektolitarska_masa' id='hektolitarska_masa' onChange={handleChange} value={formData['hektolitarska_masa']} disabled={disableForm}>
    </input>
    </div>




      <div  className='grid-form-el'>
    <label htmlFor='digestija'>Digestija (%): </label><br></br>
    <input type='text' name='digestija' id='digestija'  onChange={handleChange} value={formData['digestija']} disabled={disableForm}>
    </input>
    </div>
   
   
      <div  className='grid-form-el'>
    <label htmlFor='ulje'>Sadrzaj Ulja (%): </label><br></br>
    <input type='text' name='ulje' id='ulje'  onChange={handleChange} value={formData['ulje']} disabled={disableForm}>
    </input>
    </div>



      <div  className='grid-form-el'>
    <label htmlFor='protein'>Sadrzaj proteina (%): </label><br></br>
    <input type='text' name='protein' id='protein' onChange={handleChange} value={formData['protein']} disabled={disableForm}>
    </input>
    </div>


<div  className='grid-form-el'></div>
<div  className='komentar'>
<label htmlFor='komentar'>Komentar: </label><br></br>
    <textarea name='komentar' id='komentar' onChange={handleChange} value={formData['komentar']}  disabled={disableForm}>
        
    </textarea>
</div>
    </>
    )
}


export default ZetvaBerba