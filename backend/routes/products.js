const express = require("express");

const router = express.Router();

const Store = require("../models/Store");

const syncProducts = require("../services/productSync");



// =================================
// Shopify Product Sync
// =================================

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
            "Shop parameter required"

        });

    }



    // Find Store

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




    const products =
    await syncProducts(

        store.shop,

        store.accessToken

    );




    res.json({

        success:true,

        message:
        "Products synced successfully",

        count:
        products.length,

        products

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



module.exports = router;