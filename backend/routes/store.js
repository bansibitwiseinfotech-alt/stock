const express = require("express");

const router = express.Router();

const Store = require("../models/Store");


// =================================
// CREATE STORE
// POST /api/stores
// =================================

router.post("/", async (req, res) => {

    try {

        const {
            shop,
            accessToken,
            scope,
            shopName,
            email
        } = req.body;



        const store = await Store.create({

            shop,
            accessToken,
            scope,
            shopName,
            email

        });



        res.status(201).json({

            success:true,

            message:"Store created successfully",

            data:store

        });


    } catch(error){


        res.status(500).json({

            success:false,

            message:error.message

        });


    }

});




// =================================
// GET ALL STORES
// GET /api/stores
// =================================

router.get("/", async(req,res)=>{


    try{


        const stores =
        await Store.find();



        res.json({

            success:true,

            count:stores.length,

            data:stores

        });



    }catch(error){


        res.status(500).json({

            success:false,

            message:error.message

        });


    }


});




// =================================
// CHECK SINGLE STORE
// GET /api/stores/check/:shop
// =================================

router.get(
"/check/:shop",
async(req,res)=>{


    try{


        const store =
        await Store.findOne({

            shop:req.params.shop

        });



        if(!store){


            return res.status(404).json({

                success:false,

                message:"Store not found"

            });


        }



        res.json({

            success:true,

            data:store

        });



    }catch(error){


        res.status(500).json({

            success:false,

            message:error.message

        });


    }


});





module.exports = router;