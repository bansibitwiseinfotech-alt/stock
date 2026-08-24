const express =
require("express");


const router =
express.Router();


const Store =
require("../models/Store");


const syncOrders =
require("../services/orderSync");
const { parseScopes, hasRequiredScopes } = require("../utils/shopifyAuth");



router.get(
"/sync",
async(req,res)=>{


try{


const shop =
req.query.shop;



if(!shop){

return res.status(400).json({

success:false,

message:
"Shop required"

});

}



const store =
await Store.findOne({

shop

});



if(!store){

return res.status(404).json({

success:false,

message:
"Store not found"

});

}


const grantedScopes = store.scope || "";
const parsedScopes = parseScopes(grantedScopes);

if (!hasRequiredScopes(grantedScopes, ["read_orders"])) {
    return res.status(403).json({
        success: false,
        message: "The stored Shopify token is missing read_orders. Reinstall the app to grant the required scope.",
        grantedScopes: parsedScopes,
    });
}

const orders =
await syncOrders(

store.shop,

store.accessToken

);



res.json({

success:true,

message:
"Orders synced",

count:
orders.length

});



}

catch(error){


res.status(500).json({

success:false,

message:
error.message

});


}


});



module.exports =
router;