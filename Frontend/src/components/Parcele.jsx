import SideBar from './SideBar'
import emptyImage from '../assets/placeholder.png'
import './Parcele.css'


const Parcele = () => {




    return(
        <div className="flex p3">
        <SideBar />
        <div className='full-width'>
            <div className='widget-page'>
            <h1>Parcele</h1>


            <div className='content-widget-section'>
                <div className='widget-section'>
                    <div className='widget-widget-section'>
                        <div className='widget-title-widget-section'>
                            <h2>Dedina njiva</h2>
                        </div>

                        <div className='widget-content-widget-section'>
                            <div className='sub-section-content-widget-section'>
                                <div className='widget-content-widget-section'>
                                    <img src={emptyImage}/>
                                    <p> Kreirano dana: 27/3/2025</p>




                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        </div>
        </div>
    )
}


export default Parcele