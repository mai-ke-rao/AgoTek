const mongoose = require('mongoose')


const BaseSchema = new mongoose.Schema({
    datum_od: {
        type: String,
        required: true
    },
    datum_do: {
        type: String,
        required: true
    },
    activityType: {
        type: String,
        enum: ["obrada", "djubrenje", "setva/sadnja", "nega useva", "zetva/berba", "komentar"],
        required: true
    },
    cena_operacije_h: Number,
    komentar: String,
    user: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    parcel: {type: mongoose.Schema.Types.ObjectId, ref: 'Parcel' }
 }, { 
  timestamps: true, 
  discriminatorKey: 'kind', // default: __t
});
const Base = mongoose.model('Item', BaseSchema);


const Komentar = Base.discriminator('komentar', new mongoose.Schema({
  datum_od: { type: String, required: true },
  datum_do: { type: String, required: true },
  activityType: {
    type: String,
    enum: ["obrada", "djubrenje", "setva/sadnja", "nega useva", "zetva/berba", "komentar"],
    required: true
  },
  komentar: String
}));

// Child: Article
const Obrada = Base.discriminator('obrada', new mongoose.Schema({
    tip_obrade: {
        type: String,
        enum: ["zaoravanje zetvenih ostataka", "oranje", "zatvaranje zimske brazde", "tanjiranje", "drljanje", "setvospremanje", "podrivanje", "rigolovanje", "freziranje", "kultiviranje", "razrivanje", "ostalo"],
        required: true
    },
    dubina: Number,
  
})
);

const Djubrenje = Base.discriminator('djubrenje', new mongoose.Schema({
    cena_repromaterijala_h: Number,
    tip_djubrenja: {type: String, enum: ["osnovno", "predsetveno", "dopunsko", "fertigacija"], required: true},
    pojedinacno_djubrivo: [{
        vrsta_djubriva: String,
        kolicina_h: Number, 
        jedinica_mere: {type: String, enum: ["kg", "l"]},
        cena_po_jedinici: Number,
        napomena: String
       
    }]
})
);
const SetvaSadnja = Base.discriminator('setvaSadnja', new mongoose.Schema({
     cena_repromaterijala_h: Number,
    vrsta_proizvodnje:{
        type: String,
        enum: ["ratarstvo", "povrtarstvo", "vocarstvo", "vinogradarstvo", "ostalo"],
        required: true
    },
    usev: {
        type: String,
        required: true
    },
    biljaka_po_h: {
        type: Number,
        required: true
    },
    dubina: Number,
    razmak: Number,
    sorta: {
        type: String,
        required: true
    },
})
);

const NegaUseva = Base.discriminator('negaUseva', new mongoose.Schema({
    cena_repromaterijala_h: Number,
    agrotehnicka_mera_cbox: Boolean,
    agrotehnicka_mera: {
        type: String,
        enum: ["navodnjavanje", "plevljenje", "okopavanje", "valjenje", "medjuredno kultiviranje", "zagrtanje", "malcovanje", "proredjivanje", "rezidba", "ostalo"],
        
    },
    zalivna_norma: Number,
    zastita:[{
    tip_zastite:{
        type: String,
        enum: ["herbicidi", "zastita od stetocina i bolesti", "regulatori rasta" , "ostalo"]
    },
    sredstvo: String,
    aktivna_materija: String,
    kolicina_h: Number,
     jedinica_mere: {type: String, enum: ["kg", "l"], required: true},
        cena_po_jedinici: Number,
        napomena: String

    }]

})
);

const ZetvaBerba  = Base.discriminator('zetvaBerba', new mongoose.Schema({
    prinos_h: Number,
    vlaga: Number,
    primese: Number,
    hektolitarska_masa: Number,
    digestija: Number,
    ulje: Number,
    protein: Number,
})
);
const Analiza =  Base.discriminator('analiza', new mongoose.Schema({
        datum_od: {
        type: String,
        required: true
    },
    datum_do: {
        type: String,
        required: true
    },
    activityType: {
        type: String,
        enum: ["obrada", "djubrenje", "setva/sadnja", "nega useva", "zetva/berba", "komentar"],
        required: true
    },
    oznaka_uzorka: String,
    dubina: Number,
    ph_KCl: Number,
    ph_H20: Number,
    CaCO3: {
        kolicina: Number,
        jedinica: {type: String, enum: ['%', 'g/kg']}
    },
    Humus:{
        kolicina: Number,
        jedinica: {type: String, enum: ['%', 'g/kg']}
    },
    Ukupni_N: {
        kolicina: Number,
        jedinica: {type: String, enum: ['%', 'g/kg']}
    },
    AlP2O5: {
        kolicina: Number,
        jedinica: {type: String, enum: ['mg/100g', 'ppm']}
    },
    AlK2O: {
        kolicina: Number,
        jedinica: {type: String, enum: ['mg/100g', 'ppm']}
    },
    komentar: String
    }
)
);

BaseSchema.set('toJSON', {
    transform:(document, returnedObject) => {
        returnedObject.id = returnedObject._id.toString()
        delete returnedObject._id
        delete returnedObject.__v
      }
})

module.exports =  {Obrada, ZetvaBerba, NegaUseva ,SetvaSadnja ,Djubrenje, Komentar ,Analiza ,Base}
 




