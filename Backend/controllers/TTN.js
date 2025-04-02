const TTNRouter = require('express').Router()


//apikey NNSXS.523DYXOLFLU5C25C5VYOUIVAJUF5CKDCSB6JWZY.ERBFIWIOA24ALXZFLKTTDRDJ7ADRA77VRK7WMOUMEIBHYBKEM4OQ
TTNRouter.get('/', async(request, response) => {
    response.set()
    response.status(200).json({"captain_teemo":"on duty"})
})




module.exports = TTNRouter