// import express from "express"
// import cors from "cors"

// import createRouter from "./router/createRouter.mjs";
// import readRouter from './router/readRouter.mjs';
// import updateRouter from "./router/updateRouter.mjs";
// import deleteRouter from "./router/deleteRouter.mjs";

// const app = express();


// // ---- Middleware ----
// app.use(cors()); // Tillåter anrop från annan domän
// app.use(express.urlencoded({extended: true})); // body urlencoded
// app.use(express.json()); // body i json-formatet


// app.use(createRouter);
// app.use(readRouter);
// app.use(updateRouter);
// app.use(deleteRouter);
// // -- End Middleware --


// /** Startar servern och lyssnar på port 5000 */
// app.listen(5000);

import express from "express"
import cors from "cors"
import router from "./mongodb/router.mjs"


const app = express()


// ---- Middleware ----
app.use(cors()) // Tillåter anrop från annan domän
app.use(router)
// -- End Middleware --


/** Startar servern och lyssnar på port 5000 */
app.listen(5000)
