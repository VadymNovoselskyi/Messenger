import express from 'express'
import users from '../data.mjs'

const router = express.Router();

router.delete('/api/users', async function(req, res){
    users.splice(req.body.uid-1,1)
 
 
    res.json( {success: true} )
});
export default router;