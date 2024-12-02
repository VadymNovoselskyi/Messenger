import express from 'express'
import users from '../data.mjs'

const router = express.Router();

router.get('/', async function(req, res){
    res.json({data: null})
 });
 
 
 router.get('/users', async function(req, res){
    res.json(users)
 });
 
 
 router.get('/users/:uid', async function(req, res){
    res.json(users[parseInt(req.params.uid - 1)])
 });

export default router;