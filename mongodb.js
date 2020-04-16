const {MongoClient} = require("mongodb");

async function main(){
    const uri = "mongodb+srv://mRidge:duzSEpQQh4fTIqSm@cluster0-2dcbj.mongodb.net/test?retryWrites=true&w=majority";
    const client = new MongoClient(uri, {useNewUrlParser:true, useUnifiedTopology: true});
    try{
        await client.connect();
        
        const result = await client.db("userdb").collection("users").updateOne(
            {username: "user"},
            {$set: {cart: [
                ["Charmander", 10000, 3],
                ["Pikachu", 5000, 2]]}}
        );
        
        
        client.db("userdb").collection("users").deleteOne({name: "user"})
        
        console.log(`${result.matchedCount} document(s) matched the query criteria`);
        console.log(`${result.modifiedCount} document(s) was/were updated`);
        
        
    } catch(e){
        console.error(e);
    } finally {
        await client.close();
    }
}

main().catch(console.err);

async function deleteListingScrapedBeforeDate(client, date){
    const result = await client.db("sample_airbnb").collection("listingsAndReviews")
        .deleteMany({"last_scraped": {$lt: date}});
    console.log(`${result.deletedCount} document(s) was/were deleted`);
}

async function deletePokemonByName(client, nameOfPokemon){
    const result = await client.db("pokemondb").collection("pokemon").deleteOne({name: nameOfPokemon});
    console.log(`${result.deletedCount} pokemon was/were deleted`);
}

async function updateAllListingsToHavePropertyType(client){
    const result = await client.db("sample_airbnb").collection("listingsAndReviews")
        .updateMany({ property_type: {$exists: false}},
            {$set: {property_type: "Unknown"}});
    console.log(`${result.matchedCount} document(s) matched the query criteria`);
    console.log(`${result.modifiedCount} document(s) was/were updated`);
}

async function upsertListingByName(client, nameOfListing, updatedListing){
    const result = await client.db("sample_airbnb").collection("listingsAndReviews").updateOne(
        {name: nameOfListing},
        {$set: updatedListing},
        {upsert: true}
    );
    
    console.log(`${result.matchedCount} document(s) matched the query criteria`);
    
    if(result.upsertedCount > 0){
        console.log(`One document was inserted with id ${result.upsertedId._id}`)
    } else{
        console.log(`${result.modifiedCount} document(s) was/were updated`);
    }
}

async function updatePokemonByName(client, nameOfPokemon, updatedPokemon){
    const result = await client.db("pokemondb").collection("pokemon").updateOne(
        {name: nameOfPokemon},
        {$set: updatedPokemon}
    );
    
    console.log(`${result.matchedCount} document(s) matched the query criteria`);
    console.log(`${result.modifiedCount} document(s) was/were updated`);
}

async function findListingsWithMinumumBedroomsBathroomsAndMostRecentReviews(client, {
    minimumNumberOfBedrooms = 0, 
    minimumNumberOfBathrooms = 0,
    maximumNumberOfResults = Number.MAX_SAFE_INTEGER
    } = {}){
    const cursor = client.db("sample_airbnb").collection("listingsAndReviews").find({
        bedrooms: { $gte: minimumNumberOfBedrooms},
        bathrooms: { $gte: minimumNumberOfBathrooms}
    })
    .sort({ last_review: -1 })
    .limit(maximumNumberOfResults);
    
    const results = await cursor.toArray();
    
    if(results.length > 0){
        console.log(`Found listing(s) with at least ${minimumNumberOfBedrooms} bedrooms and ${minimumNumberOfBathrooms} bathrooms`);
        results.forEach((result, i) => {
            const date = new Date(result.last_review).toDateString();
            
            console.log();
            console.log(`${i + 1}. name: ${result.name}`);
            console.log(`   _id: ${result._id}`);
            console.log(`   bedrooms: ${result.bedrooms}`);
            console.log(`   bathrooms: ${result.bathrooms}`);
            console.log(`   most recent review date: ${new Date(result.last_review).toDateString()}`);
        })
    }
}

async function findOnePokemonByName(client, nameOfPokemon){
    const result = await client.db("pokemondb").collection("pokemon").findOne({ name: nameOfPokemon });
    if(result){
        console.log(`Found a Pokemon in the collection with the name '${nameOfPokemon}': `);
        console.log(result);
    }else{
        console.log(`No listings found with the name '${nameOfPokemon}'`);
    }
}

async function addMultiplePokemon(client, newPokemon){
    const result = await client.db("pokemondb").collection("pokemon").insertMany(newPokemon);
    console.log(`${result.insertedCount} new pokemon created with the following id(s): `);
    console.log(result.insertedIds)
}

async function addPokemon(client, newPokemon){
    const result = await client.db("pokemondb").collection("pokemon").insertOne(newPokemon);
    console.log(`New Pokemon added with the following id: ${result.insertedId}`);
}

async function listDatabases(client){
    const databasesList = await client.db().admin().listDatabases();
    
    console.log("Databases:");
    databasesList.databases.forEach(db => console.log(` - ${db.name}`));
}