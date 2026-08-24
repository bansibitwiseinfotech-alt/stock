const shopifyGraphQL = require("./shopifyGraphql");

const Product = require("../models/Product");


// =====================================
// Sync Shopify Products
// =====================================

async function syncProducts(shop, accessToken) {


    try {


        const query = `

        {
            products(first:50) {

                nodes {

                    id

                    title

                    handle

                    description

                    status


                    featuredImage {

                        url

                    }


                    variants(first:50) {

                        nodes {

                            id

                            title

                            sku

                            price


                            inventoryQuantity

                        }

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



        const products =
        response.products.nodes;



        let savedProducts = [];



        for(const item of products){



            let totalInventory = 0;



            const variants =
            item.variants.nodes.map((variant)=>{


                totalInventory +=
                variant.inventoryQuantity || 0;



                return {

                    variantId:
                    variant.id,


                    title:
                    variant.title,


                    sku:
                    variant.sku,


                    price:
                    Number(variant.price),


                    inventoryQuantity:
                    variant.inventoryQuantity

                };


            });





            const product =
            await Product.findOneAndUpdate(


                {

                    productId:item.id

                },


                {


                    shop,


                    productId:item.id,


                    title:item.title,


                    handle:item.handle,


                    description:
                    item.description,


                    image:
                    item.featuredImage?.url || "",


                    status:item.status,


                    variants,


                    totalInventory,


                    lastSyncedAt:
                    new Date()


                },


                {


                    upsert:true,


                    new:true

                }


            );



            savedProducts.push(product);


        }




        return savedProducts;



    }

    catch(error){



        console.log(

            "Product Sync Error:",

            error.message

        );


        throw error;


    }


}



module.exports = syncProducts;