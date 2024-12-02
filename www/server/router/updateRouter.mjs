import express from 'express'
import users from '../data.mjs'

const router = express.Router();

router.patch('/api/users', async function(req, res){
    let user = users[req.body.uid-1];
 
    if(req.body.name.trim())
       user.name = req.body.name.trim()
    if(req.body.email.trim())
       user.mail = req.body.email.trim()
 
    res.json( {success: true} );
});

export default router;