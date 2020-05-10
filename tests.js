const MongoClient = require('mongodb').MongoClient;

const scrypt = require('scrypt');

const uri = "mongodb+srv://mRidge:duzSEpQQh4fTIqSm@cluster0-2dcbj.mongodb.net/test?retryWrites=true&w=majority";
const database_name = "RateADate";
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
client.connect(
    (err) => {
        userTest();
        reviewTest();
        hashTest();
    }
);



async function userTest() {
    let result = await client.db(database_name).collection("users").insertOne({
        "username": "user1",
        "email": "eee",
        "profile": {
            "firstname": "1",
            "lastname": "2",
            "bio": "3",
            "avatar_id": "4"
        }
    });

    let result2 = await client.db(database_name).collection("users").findOne({
        "username": "user1"
    });


    console.log(result2);

    let result3 = await client.db(database_name).collection("users").removeOne({
        "username": "user1"
    });

    console.log(result3);
}

async function reviewTest() {
    var result = await client.db("RateADate").collection("reviews").updateOne(
        {
            "by": "user1",
            "for": "user2"

        },
        {
            $set: {
                "by": "user1",
                "for": "user2",
                "rating": 3,
                "text": "areview"

            },
        }, { upsert: true });

    let result2 = await client.db(database_name).collection("reviews").findOne({
        "by": "user1"
    });


    console.log(result2);

    let result3 = await client.db(database_name).collection("reviews").removeOne({
        "by": "user1"
    });

    console.log(result3);
}

function hashTest() {
    let params = { "N": 32, "r": 4, "p": 4 };
    let length = 128;
    let result = scrypt.hashSync(
        "abalabahaha",
        params,
        length,
        "abalabahaha").toString("base64");

    console.log(result);
}