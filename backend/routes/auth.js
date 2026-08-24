const express = require("express");
const axios = require("axios");

const router = express.Router();

const Store = require("../models/Store");
const { buildInstallUrl, parseScopes, hasRequiredScopes } = require("../utils/shopifyAuth");



// =================================
// SHOPIFY INSTALL
// GET /auth/install
// =================================

router.get("/install", (req, res) => {

    const shop = req.query.shop;

    if (!shop) {
        return res.status(400).send("Shop parameter missing");
    }

    const requiredScopes = ["read_orders", "write_products", "write_inventory", "read_inventory", "read_locations", "write_discounts"];
    const installUrl = buildInstallUrl({
        shop,
        apiKey: process.env.SHOPIFY_API_KEY,
        scopes: process.env.SHOPIFY_SCOPES || requiredScopes.join(","),
        appUrl: process.env.SHOPIFY_APP_URL,
    });

    console.log("SHOPIFY INSTALL URL:", installUrl);

    res.redirect(installUrl);
});




// =================================
// SHOPIFY CALLBACK
// GET /auth/callback
// =================================

router.get("/callback", async(req,res)=>{


try{


    const {
        shop,
        code
    } = req.query;



    console.log(
        "SHOP:",
        shop
    );


    console.log(
        "CODE:",
        code
    );



    if(!shop || !code){


        return res.status(400).json({

            success:false,

            message:"Missing Shopify Data"

        });


    }



    // Exchange code for access token

    const response =
    await axios.post(

        `https://${shop}/admin/oauth/access_token`,

        {

            client_id:
            process.env.SHOPIFY_API_KEY,


            client_secret:
            process.env.SHOPIFY_API_SECRET,


            code

        }

    );



    console.log(
        "TOKEN RESPONSE:",
        response.data
    );



    const accessToken =
    response.data.access_token;



    const grantedScopes = response.data.scope || "";
    const parsedScopes = parseScopes(grantedScopes);
    const hasOrdersScope = hasRequiredScopes(grantedScopes, ["read_orders"]);

    if (!hasOrdersScope) {
        return res.status(403).json({
            success: false,
            message: "The installed token does not include read_orders. Reinstall the app and grant the orders scope.",
            grantedScopes: parsedScopes,
        });
    }

    // Save Store

    const store =
    await Store.findOneAndUpdate(

        {
            shop
        },


        {

            shop,

            accessToken,

            scope: grantedScopes,

            active:true,

            installedAt:new Date()

        },


        {

            upsert:true,

            new:true

        }

    );



    console.log(
        "STORE SAVED:",
        store
    );



    res.send(
        "Shopify App Installed Successfully 🚀"
    );



}

catch(error){


    console.log(
        "OAUTH ERROR:",
        error.response?.data || error.message
    );



    res.status(500).json({

        success:false,

        message:
        error.response?.data || error.message

    });


}



});



module.exports = router;