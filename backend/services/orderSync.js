const shopifyGraphQL =
require("./shopifyGraphql");


const Order =
require("../models/Order");



async function syncOrders(
    shop,
    accessToken
){

try{


const query = `

query {

 orders(first:50){

  nodes{

   id

   name

   createdAt

   currencyCode


   totalPriceSet{

    shopMoney{

     amount

    }

   }


   customer{

    id

    displayName

    email

   }


   lineItems(first:50){

    nodes{

     title

     quantity


     variant{

      id

      sku


      product{

       id

      }


     }


     originalUnitPriceSet{

      shopMoney{

       amount

      }

     }

    }

   }


  }

 }

}

`;



const data =
await shopifyGraphQL(

shop,

accessToken,

query

);



const orders =
data.orders.nodes;



let result=[];



for(const order of orders){



const items =
order.lineItems.nodes.map(
item=>({


productId:
item.variant?.product?.id || "",


variantId:
item.variant?.id || "",


title:
item.title,


sku:
item.variant?.sku || "",


quantity:
item.quantity,


price:
Number(
item.originalUnitPriceSet.shopMoney.amount
)


})
);



const saved =
await Order.findOneAndUpdate(

{

orderId:
order.id

},

{

shop,


orderId:
order.id,


orderNumber:
order.name,


customer:{

id:
order.customer?.id || "",


name:
order.customer?.displayName || "",


email:
order.customer?.email || ""

},


items,


totalPrice:
Number(
order.totalPriceSet.shopMoney.amount
),


currency:
order.currencyCode,


orderDate:
order.createdAt,


lastSyncedAt:
new Date()

},

{

upsert:true,

new:true

}

);



result.push(saved);



}



return result;



}

catch(error){

console.log(
"ORDER SYNC FAILED:",
error.message
);


throw error;


}



}



module.exports =
syncOrders;