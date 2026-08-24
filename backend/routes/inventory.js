const express =
require("express");


const router =
express.Router();


const Store =
require("../models/Store");


const syncInventory =
require("../services/inventorySync");



// GET /api/inventory/sync

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
"Store not installed"

});


}



const inventory =
await syncInventory(

store.shop,

store.accessToken

);



res.json({

success:true,

message:
"Inventory synced successfully",

count:
inventory.length,

inventory


});



}
catch(error){


console.log(error);



res.status(500).json({

success:false,

message:error.message

});

}


});



module.exports =
router;