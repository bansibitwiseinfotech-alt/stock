const shopifyGraphQL =
require("./shopifyGraphql");


const Inventory =
require("../models/Inventory");



async function syncInventory(
    shop,
    accessToken
){


try{


const query = `

{
 productVariants(first:50){

  nodes{

   id

   title

   sku

   inventoryQuantity


   product{

    id

    title

   }

  }

 }

}

`;



const response =
await shopifyGraphQL(
    shop,
    accessToken,
    query
);



if(!response.productVariants){

    throw new Error(
        "No inventory data found"
    );

}



const variants =
response.productVariants.nodes;



let result=[];



for(const variant of variants){



const inventory =
await Inventory.findOneAndUpdate(

{
    variantId:variant.id
},


{

shop,

productId:
variant.product.id,


variantId:
variant.id,


productTitle:
variant.product.title,


variantTitle:
variant.title,


sku:
variant.sku,


availableQuantity:
variant.inventoryQuantity || 0,


lastSyncedAt:
new Date()

},


{
    upsert:true,
    new:true
}

);



result.push(inventory);



}



return result;



}

catch(error){


console.log(
"Inventory Sync Error:",
error.message
);


throw error;


}



}



module.exports =
syncInventory;