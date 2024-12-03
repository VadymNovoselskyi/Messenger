import express from 'express'
import users from '../data.mjs'

const router = express.Router();

router.post('/users', async (req, res) => {
    let user = {};
    user.uid = users.length + 1
    user.name = req.body.namn
    user.mail = req.body.email
    users.push(user)
 
    res.json({success: true})
});

export default router;