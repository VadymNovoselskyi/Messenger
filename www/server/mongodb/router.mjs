import express from 'express'
import { country, city } from './connect.mjs';

const router = express.Router()

router.get('/countries', async (req, res) => {
    const result = await country.find().toArray();
   res.json(result)
})


router.get('/countries/:continent', async (req, res) => {
   const result = await country.find({Continent: req.params.continent}).toArray();
   res.json(result)
})


router.get('/country/:code', async (req, res) => {
   const result = await country.findOne({Code: req.params.code.toUpperCase()});
   res.json(result)
})

router.get('/cities', async (req, res) => {
    const result = await city.find().toArray();
    res.json(result);
})

router.get('/cities/:code', async function (req, res) {
   const result = await city.find({CountryCode: req.params.code.toUpperCase()}).toArray();
   res.json(result)
})


export default router;