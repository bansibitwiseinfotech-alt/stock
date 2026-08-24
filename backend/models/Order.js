const mongoose = require("mongoose");


const OrderSchema = new mongoose.Schema({

    shop:{
        type:String,
        required:true,
        index:true
    },


    orderId:{
        type:String,
        required:true,
        unique:true
    },


    orderNumber:{
        type:String
    },


    customer:{

        id:String,

        name:String,

        email:String

    },


    items:[

        {

            productId:String,

            variantId:String,

            title:String,

            sku:String,

            quantity:Number,

            price:Number

        }

    ],


    totalPrice:{
        type:Number,
        default:0
    },


    currency:{
        type:String,
        default:"USD"
    },


    orderDate:{
        type:Date
    },


    lastSyncedAt:{
        type:Date,
        default:Date.now
    }


},{

    timestamps:true

});



module.exports =
mongoose.model(
    "Order",
    OrderSchema,
    "tbl_orders"
);