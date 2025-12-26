
import ChirpLogo from '../assets/chirp.png'
import TTNLogo from '../assets/TTN.png'
import SideBar from './SideBar'
import './integrations.css'
import CreateTTN from './CreateTTN'
import CreateChirp from './CreateChirp'
import { useState } from 'react'


const Integrations = ({deviceList, setDeviceList}) => {

const [intPick, setIntPick] = useState()

 return(
        <div>
        <div className="flex p3">
        <SideBar />
        <div className='full-width'>
            
            <h1>Integracije</h1>  
               <div className='YnYqf'>
               <div className='grid'>


            <div className="lbFOcn connector-box"  onClick={() => setIntPick('chirp')} >
            <div className="img-container">
            <div className="icon">
            <img src={ChirpLogo} alt=""/>

            </div>
            </div>
            <div className="info">
           <div className="title">Custom Chirpstack</div><div className="description">Use this custom connector if your device using Chirpstack doesn’t show up in the list. </div></div></div>
           
           
           
  <div className="lbFOcn connector-box"  onClick={() => setIntPick('ttn')} >
            <div className="img-container">
            <div className="icon">
            <img src={TTNLogo} alt=""/>

            </div>
            </div>
            <div className="info">
           <div className="title">Custom TTI/TTN</div><div className="description">Use this custom connector if your device using TTI/TTN doesn’t show up in the list. </div></div></div>

           
           
           </div></div>
            
        </div>
        </div>

            {intPick == 'ttn'? <CreateTTN setIntPick={setIntPick} devList={deviceList} setDeviceList={setDeviceList}/>: null}
            {intPick == 'chirp'? <CreateChirp setIntPick={setIntPick} devList={deviceList} setDeviceList={setDeviceList}/>: null}

            </div>

    )
}

export default Integrations
