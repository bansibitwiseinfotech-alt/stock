const express = require("express");

const router = express.Router();


const shopifyGraphQL =
require("../services/shopifyGraphql");


const Store =
require("../models/Store");



// =================================
// Test Shopify GraphQL Connection
// =================================

router.get(
"/graphql-test",
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



    // Get Store From MongoDB

    const store =
    await Store.findOne({

        shop:shop

    });



    if(!store){

        return res.status(404).json({

            success:false,

            message:
            "Store not installed"

        });

    }




    const query = `

    {
        shop {

            name

            email

            myshopifyDomain

        }
    }

    `;



    const data =
    await shopifyGraphQL(

        store.shop,

        store.accessToken,

        query

    );





    res.json({

        success:true,

        data:data

    });




}
catch(error){


    res.status(500).json({

        success:false,

        message:error.message

    });


}


});





module.exports = router;