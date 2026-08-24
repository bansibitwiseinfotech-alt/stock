const mongoose = require("mongoose");


const InventorySchema = new mongoose.Schema(
{

    shop:{
        type:String,
        required:true,
        index:true
    },


    productId:{
        type:String,
        required:true
    },


    variantId:{
        type:String,
        required:true,
        unique:true
    },


    productTitle:{
        type:String,
        default:""
    },


    variantTitle:{
        type:String,
        default:""
    },


    sku:{
        type:String,
        default:""
    },


    availableQuantity:{
        type:Number,
        default:0
    },


    location:{
        id:{
            type:String,
            default:""
        },

        name:{
            type:String,
            default:""
        }
    },


    lastSyncedAt:{
        type:Date,
        default:Date.now
    }

},
{
    timestamps:true
});


module.exports =
mongoose.model(
    "Inventory",
    InventorySchema,
    "tbl_inventories"
);