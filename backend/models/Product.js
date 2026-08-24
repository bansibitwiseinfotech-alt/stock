const mongoose = require("mongoose");


const ProductSchema = new mongoose.Schema(

{

    // Shopify Store

    shop: {

        type: String,

        required: true,

        index: true

    },


    // Shopify Product ID

    productId: {

        type: String,

        required: true,

        unique: true

    },


    // Product Information

    title: {

        type: String,

        required: true

    },


    handle: {

        type: String

    },


    description: {

        type: String,

        default: ""

    },



    // Product Images

    image: {

        type: String,

        default: ""

    },



    // Product Status

    status: {

        type: String,

        default: "ACTIVE"

    },



    // Variants Data

    variants: [

        {

            variantId: {

                type: String

            },


            title: {

                type: String

            },


            sku: {

                type: String,

                default: ""

            },


            price: {

                type: Number,

                default: 0

            },


            inventoryQuantity: {

                type: Number,

                default: 0

            }


        }

    ],



    // Total Inventory

    totalInventory: {

        type: Number,

        default: 0

    },



    // Last Shopify Sync

    lastSyncedAt: {

        type: Date,

        default: Date.now

    }



},

{

    timestamps:true

}

);



// Index For Fast Search

ProductSchema.index({

    shop:1,

    productId:1

});



module.exports =
mongoose.model(
    "Product",
    ProductSchema,
    "tbl_products"
);